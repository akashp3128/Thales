#!/bin/bash
# =============================================================================
# THALES — Startup Script
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  🖥️  THALES — Multiplayer Computer"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"

# Create shared workspace if needed
mkdir -p "$PROJECT_DIR/shared"
echo "✅ Shared workspace ready"

# Start services
echo ""
echo "🚀 Starting Thales services..."
echo ""

docker-compose up -d --build

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Thales is starting up!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  🌐 Web UI:       http://localhost:3000"
echo "  🔗 WebSocket:    ws://localhost:3000/ws"
echo "  ⛓️  Anvil RPC:    http://localhost:8545"
echo "  🤖 Ollama API:   http://localhost:11434"
echo ""
echo "  📁 Workspace:    $PROJECT_DIR/shared"
echo ""
echo "  📊 View logs:    docker-compose logs -f"
echo "  🛑 Stop:         ./scripts/stop.sh"
echo ""
echo "═══════════════════════════════════════════════════════════════"
