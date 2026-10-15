"""
PassWish — Native Desktop App Launcher (PyWebView Prototype)
Wraps PassWish Flask application in a standalone native Windows desktop window.
"""
import os
import sys
import time
import socket
import threading
import webview
from app import app
from database import init_db

def find_free_port(start_port=5000):
    """Find a free TCP port to prevent port conflicts."""
    port = start_port
    while port < start_port + 50:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            port += 1
    return 5000

def start_flask_server(port):
    """Runs the Flask server."""
    try:
        from werkzeug.serving import make_server
        server = make_server('127.0.0.1', port, app, threaded=True)
        server.serve_forever()
    except Exception as e:
        # Fallback to app.run
        app.run(host='127.0.0.1', port=port, debug=False, threaded=True, use_reloader=False)

def main():
    # 1. Initialize Database
    init_db()

    # 2. Pick port and start background server
    port = find_free_port(5000)
    server_thread = threading.Thread(target=start_flask_server, args=(port,), daemon=True)
    server_thread.start()

    # Wait for server to bind
    time.sleep(0.8)

    # 3. App Window Configuration
    window_title = "PassWish — Client CRM & Automated Wishes Desk"
    target_url = f"http://127.0.0.1:{port}"

    # Custom window icon if present
    icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'passwish_icon.ico')

    # 4. Create Native Desktop Window
    window = webview.create_window(
        title=window_title,
        url=target_url,
        width=1280,
        height=820,
        min_size=(960, 620),
        text_select=True,
        zoomable=True
    )

    print(f"🚀 PassWish Desktop App launching at {target_url}...")
    
    # 5. Start WebView Engine (Uses native Edge WebView2 on Windows)
    webview.start(debug=False, icon=icon_path if os.path.exists(icon_path) else None)
    
    print("👋 PassWish Desktop App closed.")
    sys.exit(0)

if __name__ == '__main__':
    main()
