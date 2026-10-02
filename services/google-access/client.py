#!/usr/bin/env python3
"""Read a single broker JSON request from stdin. No credential access."""
import json, socket, sys
request = json.load(sys.stdin)
wire = json.dumps(request).encode()+b'\n'
if len(wire) > 8192: sys.exit('Request too large')
with socket.socket(socket.AF_UNIX) as sock:
    sock.settimeout(60)
    sock.connect('/run/bamware-google/access.sock')
    sock.sendall(wire)
    with sock.makefile('rb') as stream:
        data = stream.readline(8*1024*1024)
response = json.loads(data)
print(json.dumps(response))
sys.exit(0 if response.get('ok') else 1)
