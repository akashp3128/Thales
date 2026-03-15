/**
 * =============================================================================
 * THALES WEB SERVER — Phase 1 Real-time Collaboration
 * =============================================================================
 *
 * Features:
 *   - HTTP server for static files and API
 *   - WebSocket server for real-time collaboration
 *   - PTY terminal sessions shared across clients
 *   - File system operations (read, write, list)
 *   - File watching for live updates
 *   - Player presence tracking
 *
 * =============================================================================
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pty = require('node-pty');
const chokidar = require('chokidar');

// Agent API (Phase 3)
let agentApi = null;
try {
  // Try Docker path first, then relative path
  agentApi = require('/app/agents/api');
} catch (e) {
  try {
    agentApi = require('../../agents/api');
  } catch (e2) {
    console.log('[Server] Agent API not available:', e.message);
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = process.env.PORT || 3000;
const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/workspace';
const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL || 'http://anvil:8545';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const COMPUTER_USE_URL = process.env.COMPUTER_USE_URL || 'http://computer-use:5001';

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Register Agent API routes (Phase 3)
if (agentApi && agentApi.registerAgentRoutes) {
  agentApi.registerAgentRoutes(app);
  console.log('[Server] Agent API routes registered');
}

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'thales-web',
    phase: 2,
    timestamp: new Date().toISOString(),
    workspace: WORKSPACE_PATH,
    connections: {
      anvil: ANVIL_RPC_URL,
      ollama: OLLAMA_URL,
      computerUse: COMPUTER_USE_URL
    }
  });
});

// =============================================================================
// STATUS ENDPOINT — System Overview
// =============================================================================

app.get('/api/status', async (req, res) => {
  const status = {
    thales: 'running',
    version: '0.3.0',
    phase: 2,
    services: {
      web: 'healthy',
      anvil: 'unknown',
      ollama: 'unknown',
      computerUse: 'unknown'
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

  // Check Computer-Use
  try {
    const cuRes = await fetch(`${COMPUTER_USE_URL}/health`);
    if (cuRes.ok) status.services.computerUse = 'healthy';
  } catch (e) {
    status.services.computerUse = 'unreachable';
  }

  res.json(status);
});

// =============================================================================
// FILE LISTING API
// =============================================================================

app.get('/api/files', (req, res) => {
  const relativePath = req.query.path || '';
  const targetPath = path.join(WORKSPACE_PATH, relativePath);

  // Security: prevent path traversal
  if (!targetPath.startsWith(WORKSPACE_PATH)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Path not found' });
  }

  try {
    const stats = fs.statSync(targetPath);

    if (stats.isDirectory()) {
      const items = fs.readdirSync(targetPath)
        .filter(name => !name.startsWith('.')) // Hide hidden files
        .map(name => {
          const itemPath = path.join(targetPath, name);
          try {
            const itemStats = fs.statSync(itemPath);
            return {
              name,
              type: itemStats.isDirectory() ? 'directory' : 'file',
              size: itemStats.size,
              modified: itemStats.mtime
            };
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);

      res.json({ type: 'directory', path: relativePath || '/', items });
    } else {
      res.json({ type: 'file', path: relativePath, size: stats.size });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// FILE READ API
// =============================================================================

app.get('/api/file', (req, res) => {
  const relativePath = req.query.path || '';
  const targetPath = path.join(WORKSPACE_PATH, relativePath);

  // Security: prevent path traversal
  if (!targetPath.startsWith(WORKSPACE_PATH)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const stats = fs.statSync(targetPath);

    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot read directory as file' });
    }

    // Check if file is too large (10MB limit)
    if (stats.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large' });
    }

    const content = fs.readFileSync(targetPath, 'utf-8');
    res.json({
      path: relativePath,
      content,
      size: stats.size,
      modified: stats.mtime
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// FILE WRITE API
// =============================================================================

app.put('/api/file', (req, res) => {
  const { path: relativePath, content } = req.body;

  if (!relativePath) {
    return res.status(400).json({ error: 'Path required' });
  }

  const targetPath = path.join(WORKSPACE_PATH, relativePath);

  // Security: prevent path traversal
  if (!targetPath.startsWith(WORKSPACE_PATH)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    // Create parent directories if needed
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(targetPath, content, 'utf-8');

    // Broadcast file change to other clients
    broadcast({
      type: 'file_changed',
      path: relativePath,
      content,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, path: relativePath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// COMPUTER-USE API PROXY
// =============================================================================

// Screenshot endpoint
app.get('/api/computer/screenshot', async (req, res) => {
  try {
    const format = req.query.format || 'base64';
    const cuRes = await fetch(`${COMPUTER_USE_URL}/screenshot?format=${format}`);
    const data = await cuRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mouse move
app.post('/api/computer/mouse/move', async (req, res) => {
  try {
    const cuRes = await fetch(`${COMPUTER_USE_URL}/mouse/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await cuRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mouse click
app.post('/api/computer/mouse/click', async (req, res) => {
  try {
    const cuRes = await fetch(`${COMPUTER_USE_URL}/mouse/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await cuRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Keyboard type
app.post('/api/computer/keyboard/type', async (req, res) => {
  try {
    const cuRes = await fetch(`${COMPUTER_USE_URL}/keyboard/type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await cuRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Keyboard key
app.post('/api/computer/keyboard/key', async (req, res) => {
  try {
    const cuRes = await fetch(`${COMPUTER_USE_URL}/keyboard/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await cuRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Execute command in GUI environment
app.post('/api/computer/exec', async (req, res) => {
  try {
    const cuRes = await fetch(`${COMPUTER_USE_URL}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await cuRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Display info
app.get('/api/computer/display', async (req, res) => {
  try {
    const cuRes = await fetch(`${COMPUTER_USE_URL}/display`);
    const data = await cuRes.json();
    res.json(data);
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

// Shared terminal session
let sharedPty = null;

function createSharedTerminal() {
  if (sharedPty) {
    sharedPty.kill();
  }

  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

  sharedPty = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: WORKSPACE_PATH,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    }
  });

  sharedPty.onData((data) => {
    // Broadcast terminal output to all clients
    broadcast({
      type: 'terminal_output',
      data
    });
  });

  sharedPty.onExit(() => {
    console.log('[PTY] Terminal exited, restarting...');
    setTimeout(createSharedTerminal, 1000);
  });

  console.log('[PTY] Shared terminal created');
}

// Create terminal on startup
createSharedTerminal();

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  const clientInfo = {
    id: clientId,
    type: 'unknown',
    name: 'Anonymous',
    connectedAt: new Date().toISOString(),
    ip: req.socket.remoteAddress
  };

  clients.set(ws, clientInfo);
  console.log(`[WS] Client connected: ${clientId}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    message: 'Connected to Thales Multiplayer Computer',
    timestamp: new Date().toISOString()
  }));

  // Broadcast new player
  broadcast({
    type: 'player_joined',
    player: clientInfo
  }, ws);

  // Handle messages
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
      client.type = message.playerType || 'human';
      client.name = message.name || 'Anonymous';
      console.log(`[WS] Client identified: ${client.name} (${client.type})`);

      ws.send(JSON.stringify({
        type: 'identified',
        ...client
      }));

      broadcastPlayerList();
      break;

    case 'get_players':
      ws.send(JSON.stringify({
        type: 'player_list',
        players: Array.from(clients.values())
      }));
      break;

    case 'terminal_input':
      // Write to shared PTY - all users see output
      if (sharedPty && message.data) {
        sharedPty.write(message.data);
      }
      break;

    case 'terminal_resize':
      // Resize shared PTY
      if (sharedPty && message.cols && message.rows) {
        sharedPty.resize(message.cols, message.rows);
      }
      break;

    case 'chat':
      broadcast({
        type: 'chat',
        from: client.id,
        name: client.name,
        message: message.text,
        timestamp: new Date().toISOString()
      });
      break;

    case 'cursor':
      broadcast({
        type: 'cursor',
        playerId: client.id,
        name: client.name,
        position: message.position,
        file: message.file
      }, ws);
      break;

    case 'file_edit':
      // Broadcast file edit to other clients
      broadcast({
        type: 'file_edit',
        playerId: client.id,
        name: client.name,
        path: message.path,
        changes: message.changes
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
// FILE WATCHER
// =============================================================================

const watcher = chokidar.watch(WORKSPACE_PATH, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

watcher.on('change', (filePath) => {
  const relativePath = path.relative(WORKSPACE_PATH, filePath);
  console.log(`[WATCH] File changed: ${relativePath}`);

  // Read and broadcast new content
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    broadcast({
      type: 'file_changed',
      path: relativePath,
      content,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[WATCH] Error reading file:', e.message);
  }
});

watcher.on('add', (filePath) => {
  const relativePath = path.relative(WORKSPACE_PATH, filePath);
  console.log(`[WATCH] File added: ${relativePath}`);
  broadcast({
    type: 'file_added',
    path: relativePath,
    timestamp: new Date().toISOString()
  });
});

watcher.on('unlink', (filePath) => {
  const relativePath = path.relative(WORKSPACE_PATH, filePath);
  console.log(`[WATCH] File deleted: ${relativePath}`);
  broadcast({
    type: 'file_deleted',
    path: relativePath,
    timestamp: new Date().toISOString()
  });
});

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

This is your shared workspace. All connected humans and AI agents can see and modify files here in real-time.

## Features (Phase 1)

- **Shared Terminal**: Every keystroke is shared — all players see the same shell
- **Monaco Editor**: Full VS Code editing with syntax highlighting
- **File Explorer**: Browse and edit workspace files
- **Live Presence**: See who's connected in the sidebar
- **Real-time Sync**: Changes broadcast instantly via WebSocket

## Quick Start

1. Click any file in the explorer to open it
2. Use the terminal below to run commands
3. Watch the players panel to see who's online

## Architecture

\`\`\`
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Anvil     │  │   Ollama    │  │  Web Server │
│  (Local EVM)│  │  (Local AI) │  │  (This!)    │
│  Port 8545  │  │  Port 11434 │  │  Port 3000  │
└─────────────┘  └─────────────┘  └─────────────┘
        │                │                │
        └────────────────┴────────────────┘
                         │
                 ┌───────▼───────┐
                 │ SHARED VOLUME │
                 │  /workspace   │
                 └───────────────┘
\`\`\`

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
  console.log('  THALES MULTIPLAYER COMPUTER — Phase 1');
  console.log('═'.repeat(60));
  console.log(`  Web Server:    http://localhost:${PORT}`);
  console.log(`  WebSocket:     ws://localhost:${PORT}/ws`);
  console.log(`  Health:        http://localhost:${PORT}/health`);
  console.log(`  Status:        http://localhost:${PORT}/api/status`);
  console.log('─'.repeat(60));
  console.log(`  Workspace:     ${WORKSPACE_PATH}`);
  console.log(`  Anvil RPC:     ${ANVIL_RPC_URL}`);
  console.log(`  Ollama API:    ${OLLAMA_URL}`);
  console.log('─'.repeat(60));
  console.log('  Features:');
  console.log('    ✓ Shared PTY terminal');
  console.log('    ✓ Monaco code editor');
  console.log('    ✓ File explorer');
  console.log('    ✓ Live player presence');
  console.log('    ✓ Real-time file sync');
  console.log('═'.repeat(60));
});
