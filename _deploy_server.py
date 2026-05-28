
import http.server, socketserver, os
os.chdir(r'C:\Users\1\Desktop\数学私教')
h = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(('127.0.0.1', 8080), h)
open(r'C:\Users\1\Desktop\数学私教\server_ready.txt', 'w').write('ready')
httpd.serve_forever()
