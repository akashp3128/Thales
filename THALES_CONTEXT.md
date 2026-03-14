# THALES CONTEXT — Living Brain Document

> **Last Updated:** Phase 1 — Complete
> **Status:** 🟢 Phase 1 Done — Ready for Phase 2

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
├── agents/              # AI agent definitions & logic
├── contracts/           # Solidity smart contracts
├── shared/              # Shared volume mount point
├── utils/               # Helper scripts & tools
└── scripts/             # Startup & management scripts
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    THALES DOCKER STACK                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   ANVIL     │  │   OLLAMA    │  │    WEB SERVER       │  │
│  │ (Local EVM) │  │  (Local AI) │  │  (WebSocket + PTY)  │  │
│  │  Port 8545  │  │  Port 11434 │  │     Port 3000       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │              │
│         └────────────────┴────────────────────┘              │
│                          │                                   │
│                  ┌───────▼───────┐                          │
│                  │ SHARED VOLUME │                          │
│                  │  /workspace   │                          │
│                  └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    WEB UI LAYOUT (Phase 1)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     HEADER                          │    │
│  │  🖥️ Thales [Phase 1]    ● Connected    👥 2 online  │    │
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
│  └──────────┴─────────────────────────────┴──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Current Phase

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

# Check status
docker-compose ps

# View logs
docker-compose logs -f thales-web

# Test API
curl http://localhost:3000/api/status | jq

# Test file listing
curl http://localhost:3000/api/files | jq

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
| 2 | Computer-Use Layer | ⚪ Not Started |
| 3 | Ollama Multi-Agent Loop | ⚪ Not Started |
| 4 | Solidity Contracts | ⚪ Not Started |
| 5 | Token Economy | ⚪ Not Started |
| 6 | Polish & Safety | ⚪ Not Started |
