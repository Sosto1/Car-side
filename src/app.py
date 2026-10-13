import http.server, socketserver, webbrowser, os, sys

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        elif self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    if "--test" in sys.argv or "--skeleton" in sys.argv:
        from walking_skeleton import run_walking_skeleton
        sys.exit(0 if run_walking_skeleton() else 1)

    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Server spuštěn na http://localhost:{PORT}")
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer byl ukončen.")