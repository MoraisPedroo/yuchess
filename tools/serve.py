"""Servidor local sem cache para desenvolvimento: python tools/serve.py [porta]"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
