#!/bin/bash
# =============================================================================
# THALES COMPUTER-USE STARTUP
# =============================================================================

echo "Starting Thales Computer-Use Environment..."
echo "Display: $DISPLAY"
echo "Resolution: $RESOLUTION"

# Start supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
