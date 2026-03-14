# THALES CONTEXT — Living Brain Document

> **Last Updated:** Phase 2 — Complete
> **Status:** 🟢 Phase 2 Done — Ready for Phase 3

---

## 🎯 Project Overview

**Thales** is a 100% local, Docker-based "Multiplayer Computer" where multiple humans and AI agents collaborate in real-time on the exact same shell, filesystem, and running processes. Conflict-free collaboration is achieved through a private local EVM ledger (Anvil) using token staking + deterministic settlement.

---

## 🖥️ Hardware Detected

| Component | Value |
|-----------|-------|
| **Chip** | Apple M3 Pro |
| **Cores** | 11 (5P + 6E) |
| **RAM** | 18 GB |
| **Docker** | v28.3.2 |
| **Platform** | macOS (darwin) |

---

## 🤖 Model Choices (Based on 18GB RAM)

| Role | Model | Reason |
|------|-------|--------|
| **General Agent** | `mistral:7b-instruct-v0.3-q4_K_M` | Fast, good instruction following |
| **Code Agent** | `codellama:7b-code-q4_K_M` | Optimized for code completion |
| **Verifier Agent** | `mistral:7b-instruct-v0.3-q4_K_M` | Verification/review tasks |

*With 18GB RAM, running 1-2 models concurrently is safe. 7B quantized models use ~4-6GB each.*

---

## 📁 Project Structure

```
~/Thales/
├── THALES_CONTEXT.md    # This file — living brain
├── docker-compose.yml   # Main orchestration
├── .gitignore
├── frontend/            # Web UI (xterm.js, Monaco, file tree)
│   ├── Dockerfile       # Node.js with PTY support
│   ├── package.json
│   ├── src/server.js    # Express + WebSocket + PTY server
│   └── public/index.html # Full collaborative UI
├── computer-use/        # Virtual desktop with vision & control
│   ├── Dockerfile       # Xvfb + Fluxbox + noVNC + API
│   ├── api.py           # Flask REST API for computer control
│   ├── supervisord.conf # Process manager config
│   └── startup.sh       # Container entrypoint
├── agents/              # AI agent definitions & logic
├── contracts/           # Solidity smart contracts
├── shared/              # Shared volume mount point
├── utils/               # Helper scripts & tools
└── scripts/             # Startup & management scripts
```

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        THALES DOCKER STACK                            │
├───────────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │   ANVIL   │  │  OLLAMA   │  │  WEB SERVER   │  │  COMPUTER-USE  │  │
│  │(Local EVM)│  │ (Local AI)│  │(WebSocket+PTY)│  │ (Vision+Ctrl)  │  │
│  │ Port 8545 │  │ Port 11434│  │   Port 3000   │  │ Ports 5001,    │  │
│  │           │  │           │  │               │  │  5900, 6080    │  │
│  └─────┬─────┘  └─────┬─────┘  └───────┬───────┘  └───────┬────────┘  │
│        │              │                │                  │           │
│        └──────────────┴────────────────┴──────────────────┘           │
│                                │                                      │
│                        ┌───────▼───────┐                             │
│                        │ SHARED VOLUME │                             │
│                        │  /workspace   │                             │
│                        └───────────────┘                             │
└───────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    WEB UI LAYOUT (Phase 2)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     HEADER                          │    │
│  │  🖥️ Thales [Phase 2]    ● Connected    👥 2 online  │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌──────────┬─────────────────────────────┬──────────┐      │
│  │ EXPLORER │         EDITOR              │ PLAYERS  │      │
│  │          │  ┌───────────────────────┐  │          │      │
│  │ 📁 files │  │     Monaco Editor     │  │ 👤 User1 │      │
│  │ 📄 doc.md│  │   (syntax highlight)  │  │ 🤖 Agent │      │
│  │          │  └───────────────────────┘  │          │      │
│  │          │  ┌───────────────────────┐  │ SERVICES │      │
│  │          │  │   xterm.js TERMINAL   │  │ ● Web    │      │
│  │          │  │   (shared PTY)        │  │ ● Anvil  │      │
│  │          │  └───────────────────────┘  │ ● Ollama │      │
│  │          │                             │ ● Screen │      │
│  │          │                             │[Desktop] │      │
│  │          │                             │[Screensht│      │
│  └──────────┴─────────────────────────────┴──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Current Phase

### Phase 2: Computer-Use Layer ✅ COMPLETE

**Objectives:**
- [x] Add virtual desktop container (Xvfb + Fluxbox)
- [x] Add VNC server with noVNC web viewer
- [x] Create REST API for computer control (screenshot, mouse, keyboard)
- [x] Update docker-compose with computer-use service
- [x] Integrate screen view into web UI
- [x] Test all computer-use capabilities — ALL WORKING

**Features Delivered:**
- **Virtual Desktop**: Xvfb display at 1280x720 with Fluxbox window manager
- **noVNC Viewer**: Web-based VNC at http://localhost:6080
- **Screenshot API**: Capture screen as PNG or base64
- **Mouse Control**: Move, click (left/right/middle), drag, scroll
- **Keyboard Control**: Type text, press keys, hotkey combinations
- **Window Management**: List windows, focus by ID or name
- **Clipboard Access**: Get/set clipboard contents
- **Command Execution**: Run commands in graphical environment
- **Pre-installed Apps**: Terminal, Firefox, File Manager, Text Editor

**Computer-Use API Endpoints (Port 5001):**
- `GET /health` — Health check
- `GET /screenshot` — Capture full screen
- `POST /screenshot/region` — Capture specific region
- `POST /mouse/move` — Move mouse to position
- `POST /mouse/click` — Click at position
- `POST /mouse/drag` — Drag from A to B
- `POST /mouse/scroll` — Scroll up/down
- `POST /keyboard/type` — Type text string
- `POST /keyboard/key` — Press single key
- `POST /keyboard/hotkey` — Press key combination
- `GET /windows` — List all windows
- `POST /window/focus` — Focus window
- `GET /clipboard` — Get clipboard
- `POST /clipboard` — Set clipboard
- `POST /exec` — Execute shell command
- `GET /display` — Get display info

**Web UI Proxy Endpoints:**
- `GET /api/computer/screenshot` — Proxy to screenshot API
- `POST /api/computer/mouse/*` — Proxy to mouse APIs
- `POST /api/computer/keyboard/*` — Proxy to keyboard APIs
- `POST /api/computer/exec` — Proxy to exec API
- `GET /api/computer/display` — Proxy to display API

---

### Phase 1: Real-time Web UI ✅ COMPLETE

**Objectives:**
- [x] Update Dockerfile with PTY build dependencies (python3, make, g++)
- [x] Add xterm.js terminal with shared PTY session
- [x] Add Monaco editor with syntax highlighting
- [x] Add file tree explorer with file operations
- [x] Add live player presence sidebar
- [x] Update WebSocket server for terminal/editor sync
- [x] Add file watching with chokidar
- [x] Test full UI functionality — ALL WORKING

**Features Delivered:**
- **Shared Terminal**: Every keystroke shared via PTY → all players see same shell
- **Monaco Editor**: Full VS Code editing with auto language detection
- **File Explorer**: Browse workspace, click to open, Cmd+S to save
- **Live Presence**: Real-time player list with human/agent distinction
- **Service Status**: Live health indicators for Web, Anvil, Ollama
- **File Sync**: chokidar watches workspace, broadcasts changes via WebSocket

**API Endpoints:**
- `GET /health` — Health check
- `GET /api/status` — Full system status with service health
- `GET /api/files?path=` — List directory contents
- `GET /api/file?path=` — Read file content
- `PUT /api/file` — Write file content
- `WS /ws` — WebSocket for real-time collaboration

**WebSocket Messages:**
- `identify` — Client identifies as human/agent
- `terminal_input` — Send keystrokes to shared PTY
- `terminal_output` — Receive PTY output
- `terminal_resize` — Resize PTY dimensions
- `player_list` — Current connected players
- `file_changed` — File modification notification

---

### Phase 0: Git Init + Docker-Compose Base ✅ COMPLETE

**Objectives:**
- [x] Detect hardware (M3 Pro, 18GB RAM, Docker 28.3.2)
- [x] Create git repo
- [x] Create folder structure
- [x] Create .gitignore
- [x] Create docker-compose.yml (Anvil, Ollama, Web)
- [x] Create basic web server (Express + WebSocket)
- [x] Create startup scripts (start.sh, stop.sh, reset.sh, status.sh)
- [x] Test docker-compose up — ALL SERVICES HEALTHY
- [x] Git commit

---

## 🧪 Testing Commands

```bash
# Start Thales
cd ~/Thales && docker-compose up -d

# Open UI in browser
open http://localhost:3000

# Open noVNC desktop viewer
open http://localhost:6080/vnc.html?autoconnect=true

# Check status
docker-compose ps

# View logs
docker-compose logs -f thales-web
docker-compose logs -f thales-computer-use

# Test API
curl http://localhost:3000/api/status | jq

# Test file listing
curl http://localhost:3000/api/files | jq

# Test computer-use API
curl http://localhost:5001/health | jq
curl -s 'http://localhost:5001/screenshot?format=base64' | jq '.format'

# Test mouse control
curl -X POST http://localhost:5001/mouse/move -H 'Content-Type: application/json' -d '{"x": 640, "y": 360}'
curl -X POST http://localhost:5001/mouse/click -H 'Content-Type: application/json' -d '{"button": 1}'

# Test keyboard control
curl -X POST http://localhost:5001/keyboard/type -H 'Content-Type: application/json' -d '{"text": "hello"}'
curl -X POST http://localhost:5001/keyboard/key -H 'Content-Type: application/json' -d '{"key": "Return"}'

# Open app in virtual desktop
curl -X POST http://localhost:5001/exec -H 'Content-Type: application/json' -d '{"command": "firefox &"}'

# Stop Thales
docker-compose down

# Full rebuild
docker-compose down -v && docker-compose up -d --build
```

---

## 🔧 Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| Phase 0 | Use 7B models | 18GB RAM constraint |
| Phase 0 | Anvil for EVM | Free, fast, local, deterministic |
| Phase 0 | Node.js for web server | WebSocket support, fast dev |
| Phase 1 | node-pty for terminal | True PTY for shared shell sessions |
| Phase 1 | Monaco via CDN | Avoid bundling, fast load |
| Phase 1 | xterm.js via CDN | Industry standard terminal emulator |
| Phase 1 | chokidar for file watch | Cross-platform, efficient |
| Phase 2 | Xvfb for display | Headless, no GPU required |
| Phase 2 | Fluxbox for WM | Lightweight, minimal resources |
| Phase 2 | noVNC for web viewer | Browser-based, no client install |
| Phase 2 | xdotool for control | Standard X11 automation tool |
| Phase 2 | Flask for API | Simple, Python native, easy to extend |
| Phase 2 | Port 5001 for API | Port 5000 used by AirPlay on macOS |

---

## ⚠️ Known Issues

*None yet*

---

## 🔙 Rollback Commands

```bash
# Undo last commit
git reset --hard HEAD~1

# Create test branch
git checkout -b test-fix

# Return to main
git checkout main

# Nuclear reset (careful!)
cd ~/Thales && docker-compose down -v && git reset --hard HEAD~1
```

---

## 📊 Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 0 | Git + Docker Base | ✅ Complete |
| 1 | Real-time Web UI | ✅ Complete |
| 2 | Computer-Use Layer | ✅ Complete |
| 3 | Ollama Multi-Agent Loop | ⚪ Not Started |
| 4 | Solidity Contracts | ⚪ Not Started |
| 5 | Token Economy | ⚪ Not Started |
| 6 | Polish & Safety | ⚪ Not Started |
