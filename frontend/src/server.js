/**
 * =============================================================================
 * THALES WEB SERVER — Phase 0 Foundation
 * =============================================================================
 *
 * Core responsibilities:
 *   - HTTP server for static files and API
 *   - WebSocket server for real-time collaboration
 *   - File system watching for shared workspace
 *   - Health checks for Docker orchestration
 *
 * Phase 0 scope: Basic server with WebSocket, ready for Phase 1 UI
 * =============================================================================
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = process.env.PORT || 3000;
const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/workspace';
const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL || 'http://anvil:8545';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'thales-web',
    timestamp: new Date().toISOString(),
    workspace: WORKSPACE_PATH,
    connections: {
      anvil: ANVIL_RPC_URL,
      ollama: OLLAMA_URL
    }
  });
});

// =============================================================================
// STATUS ENDPOINT — System Overview
// =============================================================================

app.get('/api/status', async (req, res) => {
  const status = {
    thales: 'running',
    version: '0.1.0',
    phase: 0,
    services: {
      web: 'healthy',
      anvil: 'unknown',
      ollama: 'unknown'
    },
    workspace: {
      path: WORKSPACE_PATH,
      exists: fs.existsSync(WORKSPACE_PATH)
    },
    clients: wss.clients.size,
    timestamp: new Date().toISOString()
  };

  // Check Anvil
  try {
    const anvilRes = await fetch(ANVIL_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
    });
    if (anvilRes.ok) status.services.anvil = 'healthy';
  } catch (e) {
    status.services.anvil = 'unreachable';
  }

  // Check Ollama
  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`);
    if (ollamaRes.ok) status.services.ollama = 'healthy';
  } catch (e) {
    status.services.ollama = 'unreachable';
  }

  res.json(status);
});

// =============================================================================
// WORKSPACE FILE LISTING
// =============================================================================

app.get('/api/files', (req, res) => {
  const targetPath = path.join(WORKSPACE_PATH, req.query.path || '');

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Path not found' });
  }

  try {
    const stats = fs.statSync(targetPath);

    if (stats.isDirectory()) {
      const items = fs.readdirSync(targetPath).map(name => {
        const itemPath = path.join(targetPath, name);
        const itemStats = fs.statSync(itemPath);
        return {
          name,
          type: itemStats.isDirectory() ? 'directory' : 'file',
          size: itemStats.size,
          modified: itemStats.mtime
        };
      });
      res.json({ type: 'directory', path: req.query.path || '/', items });
    } else {
      res.json({ type: 'file', path: req.query.path, size: stats.size });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// WEBSOCKET SERVER
// =============================================================================

const wss = new WebSocket.Server({ server, path: '/ws' });

// Connected clients with metadata
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  const clientInfo = {
    id: clientId,
    type: 'unknown', // 'human' or 'agent'
    name: 'Anonymous',
    connectedAt: new Date().toISOString(),
    ip: req.socket.remoteAddress
  };

  clients.set(ws, clientInfo);
  console.log(`[WS] Client connected: ${clientId}`);

  // Send welcome message with client ID
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    message: 'Connected to Thales Multiplayer Computer',
    timestamp: new Date().toISOString()
  }));

  // Broadcast new player to all clients
  broadcast({
    type: 'player_joined',
    player: clientInfo
  }, ws);

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (e) {
      console.error('[WS] Invalid message:', e.message);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    const info = clients.get(ws);
    console.log(`[WS] Client disconnected: ${info?.id}`);

    // Broadcast player left
    broadcast({
      type: 'player_left',
      playerId: info?.id
    });

    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });
});

// =============================================================================
// MESSAGE HANDLERS
// =============================================================================

function handleMessage(ws, message) {
  const client = clients.get(ws);

  switch (message.type) {
    case 'identify':
      // Client identifies as human or agent
      client.type = message.playerType || 'human';
      client.name = message.name || 'Anonymous';
      console.log(`[WS] Client identified: ${client.name} (${client.type})`);

      // Confirm identity
      ws.send(JSON.stringify({
        type: 'identified',
        ...client
      }));

      // Update all clients about player list
      broadcastPlayerList();
      break;

    case 'get_players':
      // Return list of connected players
      ws.send(JSON.stringify({
        type: 'player_list',
        players: Array.from(clients.values())
      }));
      break;

    case 'chat':
      // Broadcast chat message
      broadcast({
        type: 'chat',
        from: client.id,
        name: client.name,
        message: message.text,
        timestamp: new Date().toISOString()
      });
      break;

    case 'cursor':
      // Broadcast cursor position (for collaborative editing)
      broadcast({
        type: 'cursor',
        playerId: client.id,
        name: client.name,
        position: message.position
      }, ws);
      break;

    default:
      console.log(`[WS] Unknown message type: ${message.type}`);
  }
}

// =============================================================================
// BROADCAST UTILITIES
// =============================================================================

function broadcast(message, exclude = null) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function broadcastPlayerList() {
  broadcast({
    type: 'player_list',
    players: Array.from(clients.values())
  });
}

// =============================================================================
// WORKSPACE INITIALIZATION
// =============================================================================

function initWorkspace() {
  if (!fs.existsSync(WORKSPACE_PATH)) {
    console.log(`[WORKSPACE] Creating workspace at ${WORKSPACE_PATH}`);
    fs.mkdirSync(WORKSPACE_PATH, { recursive: true });
  }

  // Create a welcome file if workspace is empty
  const welcomePath = path.join(WORKSPACE_PATH, 'WELCOME.md');
  if (!fs.existsSync(welcomePath)) {
    fs.writeFileSync(welcomePath, `# Welcome to Thales Multiplayer Computer

This is your shared workspace. All connected humans and AI agents can see and modify files here.

## Getting Started

1. Open the terminal below to run commands
2. Edit files in the Monaco editor
3. Watch other players collaborate in real-time

## How It Works

- Every change is synced via WebSocket
- Agents stake tokens to propose changes
- The local blockchain (Anvil) settles conflicts
- You always have final approval

Happy collaborating!
`);
    console.log('[WORKSPACE] Created welcome file');
  }
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

initWorkspace();

server.listen(PORT, '0.0.0.0', () => {
  console.log('═'.repeat(60));
  console.log('  THALES MULTIPLAYER COMPUTER — Phase 0');
  console.log('═'.repeat(60));
  console.log(`  Web Server:    http://localhost:${PORT}`);
  console.log(`  WebSocket:     ws://localhost:${PORT}/ws`);
  console.log(`  Health:        http://localhost:${PORT}/health`);
  console.log(`  Status:        http://localhost:${PORT}/api/status`);
  console.log('─'.repeat(60));
  console.log(`  Workspace:     ${WORKSPACE_PATH}`);
  console.log(`  Anvil RPC:     ${ANVIL_RPC_URL}`);
  console.log(`  Ollama API:    ${OLLAMA_URL}`);
  console.log('═'.repeat(60));
});
