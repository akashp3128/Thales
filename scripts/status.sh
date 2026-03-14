#!/bin/bash
# =============================================================================
# THALES — Status Check Script
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  🖥️  THALES STATUS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Docker status
echo "📦 Docker Containers:"
docker-compose ps
echo ""

# Service health
echo "🏥 Service Health:"

# Web server
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "  ✅ Web Server:  healthy"
else
    echo "  ❌ Web Server:  unreachable"
fi

# Anvil
if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://localhost:8545 > /dev/null 2>&1; then
    echo "  ✅ Anvil (EVM): healthy"
else
    echo "  ❌ Anvil (EVM): unreachable"
fi

# Ollama
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "  ✅ Ollama (AI): healthy"
    echo ""
    echo "🤖 Available Models:"
    curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sed 's/^/     /'
else
    echo "  ❌ Ollama (AI): unreachable"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
