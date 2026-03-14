# Thales — Multiplayer Computer

Thales is a 100% local, Docker-based collaborative computing environment where multiple humans and AI agents work together in real-time on the same shell, filesystem, and running processes. Built for macOS with Apple Silicon support.

## Overview

Thales implements the concept of a "Multiplayer Computer" — a shared workspace where every participant (human or AI) sees and interacts with the exact same environment simultaneously. All keystrokes in the terminal are shared, all file edits are synchronized, and all screen interactions are visible to everyone.

The system uses a local Ethereum Virtual Machine (Anvil) for future token-based conflict resolution and Ollama for local AI model inference, ensuring complete privacy with no external API calls required.

## Architecture

```
+-----------------------------------------------------------------------+
|                        THALES DOCKER STACK                            |
+-----------------------------------------------------------------------+
|  +-----------+  +-----------+  +---------------+  +----------------+  |
|  |   ANVIL   |  |  OLLAMA   |  |  WEB SERVER   |  |  COMPUTER-USE  |  |
|  |(Local EVM)|  | (Local AI)|  |(WebSocket+PTY)|  | (Vision+Ctrl)  |  |
|  | Port 8545 |  | Port 11434|  |   Port 3000   |  | Ports 5001,    |  |
|  |           |  |           |  |               |  |  5900, 6080    |  |
|  +-----+-----+  +-----+-----+  +-------+-------+  +-------+--------+  |
|        |              |                |                  |           |
|        +--------------+----------------+------------------+           |
|                                |                                      |
|                        +-------v-------+                              |
|                        | SHARED VOLUME |                              |
|                        |  /workspace   |                              |
|                        +---------------+                              |
+-----------------------------------------------------------------------+
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| **Web Server** | 3000 | Express.js server with WebSocket for real-time collaboration, shared PTY terminal sessions, file operations API, and static file serving |
| **Anvil** | 8545 | Foundry's local Ethereum blockchain for token staking and deterministic settlement (Phase 4+) |
| **Ollama** | 11434 | Local LLM inference server for AI agents (Phase 3+) |
| **Computer-Use** | 5001, 5900, 6080 | Virtual desktop with X11, VNC server, noVNC web viewer, and REST API for programmatic control |

## Features

### Phase 1: Real-time Collaboration (Complete)

- **Shared Terminal**: Every keystroke is broadcast to all connected clients via a shared PTY session
- **Monaco Editor**: Full VS Code-style editing with syntax highlighting for 50+ languages
- **File Explorer**: Browse, open, and save files in the shared workspace
- **Live Presence**: See who is connected (humans and AI agents) in real-time
- **File Watching**: Automatic synchronization when files change on disk

### Phase 2: Computer-Use Layer (Complete)

- **Virtual Desktop**: Xvfb-based headless X11 display at 1280x720 resolution
- **Window Manager**: Fluxbox lightweight window manager with custom Thales menu
- **VNC Access**: x11vnc server on port 5900 for native VNC clients
- **Web Viewer**: noVNC on port 6080 for browser-based desktop access
- **Control API**: REST endpoints for programmatic mouse, keyboard, and screen control
- **Pre-installed Applications**: Terminal (xterm), Firefox ESR, File Manager (PCManFM), Text Editor (gedit)

## Requirements

- macOS (tested on Apple Silicon M1/M2/M3)
- Docker Desktop 4.0+ with Docker Compose
- 16GB+ RAM recommended (18GB optimal for running AI models)
- 10GB+ free disk space

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/akashp3128/Thales.git
cd Thales
```

### 2. Start All Services

```bash
docker-compose up -d
```

Wait for all services to become healthy (approximately 30-60 seconds on first run):

```bash
docker-compose ps
```

### 3. Access the Web Interface

Open your browser to: http://localhost:3000

### 4. Access the Virtual Desktop

Option A - Browser (noVNC):
```
http://localhost:6080/vnc.html?autoconnect=true&resize=scale
```

Option B - Native VNC client:
```
vnc://localhost:5900
```

## API Reference

### Web Server API (Port 3000)

#### Health and Status

```bash
# Health check
GET /health

# System status with all service health
GET /api/status
```

#### File Operations

```bash
# List directory contents
GET /api/files?path=/

# Read file content
GET /api/file?path=filename.txt

# Write file content
PUT /api/file
Content-Type: application/json
{"path": "filename.txt", "content": "file contents"}
```

#### WebSocket Messages (ws://localhost:3000/ws)

| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `identify` | Client -> Server | Identify as human or agent |
| `terminal_input` | Client -> Server | Send keystrokes to shared PTY |
| `terminal_output` | Server -> Client | Receive PTY output |
| `terminal_resize` | Client -> Server | Resize PTY dimensions |
| `player_list` | Server -> Client | Current connected players |
| `file_changed` | Server -> Client | File modification notification |
| `cursor` | Bidirectional | Cursor position updates |

### Computer-Use API (Port 5001)

#### Screenshots

```bash
# Capture full screen (returns PNG)
GET /screenshot

# Capture full screen as base64
GET /screenshot?format=base64

# Capture specific region
POST /screenshot/region
Content-Type: application/json
{"x": 0, "y": 0, "width": 400, "height": 300}
```

#### Mouse Control

```bash
# Move mouse to absolute position
POST /mouse/move
Content-Type: application/json
{"x": 640, "y": 360}

# Click at current or specified position
POST /mouse/click
Content-Type: application/json
{"x": 100, "y": 200, "button": 1, "clicks": 1}
# button: 1=left, 2=middle, 3=right

# Drag from one position to another
POST /mouse/drag
Content-Type: application/json
{"from_x": 100, "from_y": 100, "to_x": 300, "to_y": 300}

# Scroll up or down
POST /mouse/scroll
Content-Type: application/json
{"direction": "down", "amount": 3}
```

#### Keyboard Control

```bash
# Type text string
POST /keyboard/type
Content-Type: application/json
{"text": "Hello, World!", "delay": 12}

# Press single key or key combination
POST /keyboard/key
Content-Type: application/json
{"key": "Return"}
# Examples: "Return", "Tab", "Escape", "ctrl+c", "alt+Tab"

# Press hotkey combination
POST /keyboard/hotkey
Content-Type: application/json
{"keys": ["ctrl", "shift", "t"]}
```

#### Window Management

```bash
# List all windows
GET /windows

# Focus window by ID or name
POST /window/focus
Content-Type: application/json
{"id": "12345678"}
# or
{"name": "Firefox"}
```

#### Clipboard

```bash
# Get clipboard contents
GET /clipboard

# Set clipboard contents
POST /clipboard
Content-Type: application/json
{"content": "text to copy"}
```

#### Command Execution

```bash
# Execute command in graphical environment
POST /exec
Content-Type: application/json
{"command": "firefox https://example.com &", "wait": false}

# Execute and wait for result
POST /exec
Content-Type: application/json
{"command": "ls -la /workspace", "wait": true}
```

## Project Structure

```
Thales/
|-- THALES_CONTEXT.md       # Project context and phase documentation
|-- README.md               # This file
|-- docker-compose.yml      # Main orchestration file
|-- .gitignore
|-- frontend/               # Web UI and server
|   |-- Dockerfile          # Node.js 20 Alpine with PTY support
|   |-- package.json        # Dependencies (express, ws, node-pty, etc.)
|   |-- src/
|   |   +-- server.js       # Express + WebSocket + PTY server
|   +-- public/
|       +-- index.html      # Full collaborative UI (Monaco, xterm.js)
|-- computer-use/           # Virtual desktop container
|   |-- Dockerfile          # Python 3.11 with Xvfb, Fluxbox, noVNC
|   |-- api.py              # Flask REST API for computer control
|   |-- supervisord.conf    # Process manager configuration
|   +-- startup.sh          # Container entrypoint
|-- shared/                 # Shared workspace volume
|-- scripts/                # Management scripts
|   |-- start.sh
|   |-- stop.sh
|   |-- reset.sh
|   +-- status.sh
|-- agents/                 # AI agent definitions (Phase 3+)
+-- contracts/              # Solidity smart contracts (Phase 4+)
```

## Configuration

### Environment Variables

The following environment variables can be configured in `docker-compose.yml`:

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `NODE_ENV` | web | development | Node.js environment |
| `WORKSPACE_PATH` | web | /workspace | Shared workspace path |
| `ANVIL_RPC_URL` | web | http://anvil:8545 | Anvil RPC endpoint |
| `OLLAMA_URL` | web | http://ollama:11434 | Ollama API endpoint |
| `COMPUTER_USE_URL` | web | http://computer-use:5001 | Computer-Use API endpoint |
| `DISPLAY` | computer-use | :99 | X11 display number |
| `RESOLUTION` | computer-use | 1280x720x24 | Virtual display resolution |

### Recommended AI Models (for Phase 3+)

With 18GB RAM, the following quantized models work well:

| Role | Model | Memory Usage |
|------|-------|--------------|
| General Agent | mistral:7b-instruct-v0.3-q4_K_M | ~4-5GB |
| Code Agent | codellama:7b-code-q4_K_M | ~4-5GB |
| Verifier Agent | mistral:7b-instruct-v0.3-q4_K_M | ~4-5GB |

## Development

### Rebuilding Containers

```bash
# Rebuild all containers
docker-compose down && docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build web
docker-compose up -d --build computer-use
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f thales-web
docker-compose logs -f thales-computer-use
docker-compose logs -f thales-ollama
docker-compose logs -f thales-anvil
```

### Full Reset

```bash
# Stop and remove all containers, volumes, and images
docker-compose down -v --rmi local

# Start fresh
docker-compose up -d --build
```

## Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 0 | Git + Docker Base | Complete |
| 1 | Real-time Web UI | Complete |
| 2 | Computer-Use Layer | Complete |
| 3 | Ollama Multi-Agent Loop | Planned |
| 4 | Solidity Contracts | Planned |
| 5 | Token Economy | Planned |
| 6 | Polish and Safety | Planned |

### Phase 3: Multi-Agent System (Next)

- Agent registration and lifecycle management
- Task assignment and coordination
- Inter-agent communication via shared workspace
- Ollama integration for local LLM inference

### Phase 4: Smart Contracts

- Token staking mechanism for resource allocation
- Proposal and voting system for conflict resolution
- Audit trail on local blockchain

### Phase 5: Token Economy

- Resource metering and billing
- Reputation system for agents
- Incentive alignment mechanisms

## Troubleshooting

### Port 5000 Already in Use (macOS)

macOS uses port 5000 for AirPlay Receiver. Thales uses port 5001 instead. If you see port conflicts:

```bash
# Check what's using port 5000
lsof -i :5000

# Disable AirPlay Receiver: System Settings > General > AirDrop & Handoff > AirPlay Receiver
```

### Container Health Check Failures

```bash
# Check container status
docker-compose ps

# View specific container logs
docker-compose logs thales-computer-use

# Restart unhealthy container
docker-compose restart computer-use
```

### noVNC Connection Issues

1. Ensure the computer-use container is healthy: `docker-compose ps`
2. Check that port 6080 is not blocked by firewall
3. Try connecting via native VNC client to port 5900

### Ollama Model Download

On first run, Ollama container starts empty. To download models:

```bash
# Enter Ollama container
docker exec -it thales-ollama bash

# Pull models
ollama pull mistral:7b-instruct-v0.3-q4_K_M
ollama pull codellama:7b-code-q4_K_M
```

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- [Foundry](https://github.com/foundry-rs/foundry) for Anvil local blockchain
- [Ollama](https://ollama.ai) for local LLM inference
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for code editing
- [xterm.js](https://xtermjs.org/) for terminal emulation
- [noVNC](https://novnc.com/) for web-based VNC
- [Fluxbox](http://fluxbox.org/) for lightweight window management
