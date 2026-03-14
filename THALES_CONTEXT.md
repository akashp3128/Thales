# THALES CONTEXT — Living Brain Document

> **Last Updated:** Phase 0 — Complete
> **Status:** 🟢 Phase 0 Done — Ready for Phase 1

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
│  │ (Local EVM) │  │  (Local AI) │  │  (WebSocket + HTTP) │  │
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
```

---

## 🔄 Current Phase

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

**Verified Endpoints:**
- Web UI: http://localhost:3000
- Health: http://localhost:3000/health
- Status: http://localhost:3000/api/status
- Anvil RPC: http://localhost:8545
- Ollama: http://localhost:11434

**Next Phase:** Phase 1 — Real-time Web UI (xterm.js, Monaco, file tree)

---

## 🧪 Testing Commands

```bash
# Start Thales
cd ~/Thales && docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop Thales
docker-compose down

# Full reset
docker-compose down -v && docker-compose up -d --build
```

---

## 🔧 Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| Phase 0 | Use 7B models | 18GB RAM constraint |
| Phase 0 | Anvil for EVM | Free, fast, local, deterministic |
| Phase 0 | Node.js for web server | WebSocket support, fast dev |

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
| 1 | Real-time Web UI | ⚪ Not Started |
| 2 | Computer-Use Layer | ⚪ Not Started |
| 3 | Ollama Multi-Agent Loop | ⚪ Not Started |
| 4 | Solidity Contracts | ⚪ Not Started |
| 5 | Token Economy | ⚪ Not Started |
| 6 | Polish & Safety | ⚪ Not Started |
