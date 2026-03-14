# =============================================================================
# THALES COMPUTER-USE CONTAINER
# =============================================================================
# Provides:
#   - Xvfb virtual display
#   - Fluxbox lightweight window manager
#   - x11vnc for VNC access
#   - noVNC for web-based viewing
#   - Python API for computer control (screenshot, click, type)
#   - Common GUI apps for testing
# =============================================================================

FROM python:3.11-slim-bookworm

# Environment
ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV VNC_PORT=5900
ENV NOVNC_PORT=6080
ENV RESOLUTION=1280x720x24

# Install system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    # X11 and display
    xvfb \
    x11vnc \
    fluxbox \
    xterm \
    # noVNC dependencies
    novnc \
    websockify \
    # Screenshot and control tools
    scrot \
    xdotool \
    xclip \
    imagemagick \
    # GUI apps for testing
    firefox-esr \
    gedit \
    pcmanfm \
    # Utilities
    curl \
    wget \
    procps \
    supervisor \
    dbus-x11 \
    # Fonts
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir \
    flask \
    flask-cors \
    pillow \
    pyautogui \
    pyscreenshot \
    python-xlib \
    requests

# Create directories
RUN mkdir -p /app /workspace /var/log/supervisor /root/.fluxbox

# Fluxbox configuration
RUN echo '[begin] (Thales)\n\
  [exec] (Terminal) {xterm -fa "Monospace" -fs 12}\n\
  [exec] (File Manager) {pcmanfm}\n\
  [exec] (Firefox) {firefox-esr}\n\
  [exec] (Text Editor) {gedit}\n\
  [separator]\n\
  [exit] (Exit)\n\
[end]' > /root/.fluxbox/menu

RUN echo 'session.screen0.toolbar.visible: false\n\
session.screen0.workspaces: 1' > /root/.fluxbox/init

# Copy application files
WORKDIR /app
COPY api.py /app/
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY startup.sh /app/

RUN chmod +x /app/startup.sh

# Expose ports
EXPOSE 5900 6080 5000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
