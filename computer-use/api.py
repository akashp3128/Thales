"""
=============================================================================
THALES COMPUTER-USE API
=============================================================================

Provides REST API for computer control:
  - Screenshot capture
  - Mouse control (move, click, drag)
  - Keyboard control (type, hotkeys)
  - Window management
  - Clipboard access

This enables AI agents to see and control the virtual desktop.
=============================================================================
"""

import os
import io
import base64
import subprocess
import time
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image

app = Flask(__name__)
CORS(app)

DISPLAY = os.environ.get('DISPLAY', ':99')


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'computer-use',
        'display': DISPLAY,
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    })


# =============================================================================
# SCREENSHOT
# =============================================================================

@app.route('/screenshot', methods=['GET'])
def screenshot():
    """Capture and return screenshot of the virtual display."""
    try:
        # Use scrot for screenshot
        filename = '/tmp/screenshot.png'
        result = subprocess.run(
            ['scrot', '-o', filename],
            env={**os.environ, 'DISPLAY': DISPLAY},
            capture_output=True,
            timeout=10
        )

        if result.returncode != 0:
            return jsonify({'error': 'Screenshot failed', 'details': result.stderr.decode()}), 500

        # Check if base64 requested
        if request.args.get('format') == 'base64':
            with open(filename, 'rb') as f:
                img_data = base64.b64encode(f.read()).decode()
            return jsonify({
                'image': img_data,
                'format': 'png',
                'encoding': 'base64'
            })

        return send_file(filename, mimetype='image/png')

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/screenshot/region', methods=['POST'])
def screenshot_region():
    """Capture screenshot of a specific region."""
    try:
        data = request.json
        x = data.get('x', 0)
        y = data.get('y', 0)
        width = data.get('width', 400)
        height = data.get('height', 300)

        filename = '/tmp/screenshot_region.png'
        result = subprocess.run(
            ['scrot', '-a', f'{x},{y},{width},{height}', '-o', filename],
            env={**os.environ, 'DISPLAY': DISPLAY},
            capture_output=True,
            timeout=10
        )

        if result.returncode != 0:
            return jsonify({'error': 'Screenshot failed'}), 500

        if request.args.get('format') == 'base64':
            with open(filename, 'rb') as f:
                img_data = base64.b64encode(f.read()).decode()
            return jsonify({'image': img_data, 'format': 'png', 'encoding': 'base64'})

        return send_file(filename, mimetype='image/png')

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# MOUSE CONTROL
# =============================================================================

@app.route('/mouse/move', methods=['POST'])
def mouse_move():
    """Move mouse to absolute position."""
    try:
        data = request.json
        x = data.get('x', 0)
        y = data.get('y', 0)

        subprocess.run(
            ['xdotool', 'mousemove', str(x), str(y)],
            env={**os.environ, 'DISPLAY': DISPLAY},
            timeout=5
        )

        return jsonify({'success': True, 'x': x, 'y': y})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/mouse/click', methods=['POST'])
def mouse_click():
    """Click at current or specified position."""
    try:
        data = request.json or {}
        x = data.get('x')
        y = data.get('y')
        button = data.get('button', 1)  # 1=left, 2=middle, 3=right
        clicks = data.get('clicks', 1)

        cmd = ['xdotool']

        if x is not None and y is not None:
            cmd.extend(['mousemove', str(x), str(y)])
            cmd.append('click')
        else:
            cmd.append('click')

        if clicks > 1:
            cmd.extend(['--repeat', str(clicks)])

        cmd.append(str(button))

        subprocess.run(
            cmd,
            env={**os.environ, 'DISPLAY': DISPLAY},
            timeout=5
        )

        return jsonify({'success': True, 'button': button, 'clicks': clicks})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/mouse/drag', methods=['POST'])
def mouse_drag():
    """Drag from one position to another."""
    try:
        data = request.json
        from_x = data.get('from_x', 0)
        from_y = data.get('from_y', 0)
        to_x = data.get('to_x', 100)
        to_y = data.get('to_y', 100)

        # Move to start, mouse down, move to end, mouse up
        subprocess.run(
            ['xdotool', 'mousemove', str(from_x), str(from_y),
             'mousedown', '1',
             'mousemove', str(to_x), str(to_y),
             'mouseup', '1'],
            env={**os.environ, 'DISPLAY': DISPLAY},
            timeout=5
        )

        return jsonify({'success': True, 'from': [from_x, from_y], 'to': [to_x, to_y]})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/mouse/scroll', methods=['POST'])
def mouse_scroll():
    """Scroll up or down."""
    try:
        data = request.json or {}
        direction = data.get('direction', 'down')
        amount = data.get('amount', 3)

        button = '5' if direction == 'down' else '4'

        subprocess.run(
            ['xdotool', 'click', '--repeat', str(amount), button],
            env={**os.environ, 'DISPLAY': DISPLAY},
            timeout=5
        )

        return jsonify({'success': True, 'direction': direction, 'amount': amount})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# KEYBOARD CONTROL
# =============================================================================

@app.route('/keyboard/type', methods=['POST'])
def keyboard_type():
    """Type text."""
    try:
        data = request.json
        text = data.get('text', '')
        delay = data.get('delay', 12)  # ms between keystrokes

        subprocess.run(
            ['xdotool', 'type', '--delay', str(delay), text],
            env={**os.environ, 'DISPLAY': DISPLAY},
            timeout=30
        )

        return jsonify({'success': True, 'text': text})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/keyboard/key', methods=['POST'])
def keyboard_key():
    """Press a key or key combination."""
    try:
        data = request.json
        key = data.get('key', '')  # e.g., 'Return', 'ctrl+c', 'alt+Tab'

        subprocess.run(
            ['xdotool', 'key', key],
            env={**os.environ, 'DISPLAY': DISPLAY},
            timeout=5
        )

        return jsonify({'success': True, 'key': key})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/keyboard/hotkey', methods=['POST'])
def keyboard_hotkey():
    """Press a hotkey combination."""
    try:
        data = request.json
        keys = data.get('keys', [])  # e.g., ['ctrl', 'shift', 't']

        combo = '+'.join(keys)
        subprocess.run(
            ['xdotool', 'key', combo],
            env={**os.environ, 'DISPLAY': DISPLAY},
            timeout=5
        )

        return jsonify({'success': True, 'keys': keys})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# WINDOW MANAGEMENT
# =============================================================================

@app.route('/windows', methods=['GET'])
def list_windows():
    """List all windows."""
    try:
        result = subprocess.run(
            ['xdotool', 'search', '--name', ''],
            env={**os.environ, 'DISPLAY': DISPLAY},
            capture_output=True,
            timeout=5
        )

        window_ids = result.stdout.decode().strip().split('\n')
        windows = []

        for wid in window_ids:
            if wid:
                name_result = subprocess.run(
                    ['xdotool', 'getwindowname', wid],
                    env={**os.environ, 'DISPLAY': DISPLAY},
                    capture_output=True,
                    timeout=5
                )
                windows.append({
                    'id': wid,
                    'name': name_result.stdout.decode().strip()
                })

        return jsonify({'windows': windows})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/window/focus', methods=['POST'])
def focus_window():
    """Focus a window by ID or name."""
    try:
        data = request.json
        window_id = data.get('id')
        name = data.get('name')

        if window_id:
            subprocess.run(
                ['xdotool', 'windowactivate', str(window_id)],
                env={**os.environ, 'DISPLAY': DISPLAY},
                timeout=5
            )
        elif name:
            subprocess.run(
                ['xdotool', 'search', '--name', name, 'windowactivate'],
                env={**os.environ, 'DISPLAY': DISPLAY},
                timeout=5
            )

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# CLIPBOARD
# =============================================================================

@app.route('/clipboard', methods=['GET'])
def get_clipboard():
    """Get clipboard contents."""
    try:
        result = subprocess.run(
            ['xclip', '-selection', 'clipboard', '-o'],
            env={**os.environ, 'DISPLAY': DISPLAY},
            capture_output=True,
            timeout=5
        )

        return jsonify({'content': result.stdout.decode()})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/clipboard', methods=['POST'])
def set_clipboard():
    """Set clipboard contents."""
    try:
        data = request.json
        content = data.get('content', '')

        proc = subprocess.Popen(
            ['xclip', '-selection', 'clipboard'],
            env={**os.environ, 'DISPLAY': DISPLAY},
            stdin=subprocess.PIPE
        )
        proc.communicate(input=content.encode())

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# EXECUTE COMMAND
# =============================================================================

@app.route('/exec', methods=['POST'])
def exec_command():
    """Execute a command in the graphical environment."""
    try:
        data = request.json
        command = data.get('command', '')
        wait = data.get('wait', False)

        if wait:
            result = subprocess.run(
                command,
                shell=True,
                env={**os.environ, 'DISPLAY': DISPLAY},
                capture_output=True,
                timeout=30
            )
            return jsonify({
                'success': result.returncode == 0,
                'stdout': result.stdout.decode(),
                'stderr': result.stderr.decode(),
                'returncode': result.returncode
            })
        else:
            subprocess.Popen(
                command,
                shell=True,
                env={**os.environ, 'DISPLAY': DISPLAY}
            )
            return jsonify({'success': True, 'started': command})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# DISPLAY INFO
# =============================================================================

@app.route('/display', methods=['GET'])
def display_info():
    """Get display information."""
    try:
        result = subprocess.run(
            ['xdpyinfo'],
            env={**os.environ, 'DISPLAY': DISPLAY},
            capture_output=True,
            timeout=5
        )

        output = result.stdout.decode()

        # Parse dimensions
        dimensions = None
        for line in output.split('\n'):
            if 'dimensions:' in line:
                dimensions = line.split(':')[1].strip().split()[0]
                break

        return jsonify({
            'display': DISPLAY,
            'dimensions': dimensions,
            'healthy': result.returncode == 0
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print('=' * 60)
    print('  THALES COMPUTER-USE API')
    print('=' * 60)
    print(f'  Display: {DISPLAY}')
    print(f'  API: http://0.0.0.0:5001')
    print('=' * 60)

    app.run(host='0.0.0.0', port=5001, debug=False)
