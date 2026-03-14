#!/bin/bash
# =============================================================================
# THALES — Stop Script
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🛑 Stopping Thales services..."
docker-compose down

echo "✅ Thales stopped"
