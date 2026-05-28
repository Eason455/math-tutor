
import http.server, socketserver, os
os.chdir(r'C:\Users\1\Desktop\数学私教')
h = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(('0.0.0.0', 8080), h)
with open(r'C:\Users\1\Desktop\数学私教\server.log', 'w') as f:
    f.write('Server started on port 8080\n')
httpd.serve_forever()
