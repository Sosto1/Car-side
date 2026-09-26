import http.server
import socketserver
import webbrowser
import os

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Pokud uživatel přistoupí na hlavní stránku `/`, naservíruje se `index.html`
        if self.path == '/':
            self.path = '/index.html'
        elif self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        return super().do_GET()

if __name__ == "__main__":
    # Nastavení pracovní složky na adresář se soubory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Server spuštěn na http://localhost:{PORT}")
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer byl ukončen.")