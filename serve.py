#!/usr/bin/env python3
"""
Zero-dependency static web server for the AlphaFlow Quant Terminal.
Run: python3 serve.py
"""

import http.server
import socketserver
import os
import webbrowser
import sys

PORT = 8080
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    # check if data exists
    data_path = os.path.join(DIRECTORY, "public", "data", "pipeline_data.json")
    if not os.path.exists(data_path):
        print("Exporting pipeline data from Parquet...")
        import subprocess
        subprocess.run([sys.executable, "scripts/export_data.py"], check=True)

    # create a symlink or copy of data into frontend/data if needed
    os.makedirs(os.path.join(DIRECTORY, "data"), exist_ok=True)
    import shutil
    shutil.copy(data_path, os.path.join(DIRECTORY, "data", "pipeline_data.json"))

    print(f"\n=======================================================")
    print(f"  ⚡ AlphaFlow Quant Alpha Terminal is Running!")
    print(f"  URL: http://localhost:{PORT}")
    print(f"=======================================================\n")

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    main()
