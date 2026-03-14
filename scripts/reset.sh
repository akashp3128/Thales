#!/bin/bash
# =============================================================================
# THALES — Full Reset Script
# =============================================================================
# WARNING: This removes all data including blockchain state and Ollama models
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "⚠️  This will remove ALL Thales data including:"
echo "   - Anvil blockchain state"
echo "   - Downloaded Ollama models"
echo "   - Shared workspace files"
echo ""
read -p "Are you sure? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing Thales data..."
    docker-compose down -v --remove-orphans
    rm -rf "$PROJECT_DIR/shared/*"
    echo "✅ Full reset complete"
else
    echo "❌ Reset cancelled"
fi
