#!/usr/bin/env python3
"""Narrow Google read broker. No shell, arbitrary endpoint, mutation or token export."""
import base64
import json
import os
from pathlib import Path
import re
import socket
import socketserver
import struct
import subprocess
import tempfile

SOCKET = '/run/bamware-google/access.sock'
MAX_REQUEST = 8192
MAX_RESULT = 5 * 1024 * 1024
ALLOWED_UNITS = {'assistant-web.service', 'hermes-gateway.service'}
CONFIG = Path('/etc/bamware-google/broker.json')
ID = re.compile(r'^[A-Za-z0-9_-]{1,256}$')


def allowed_peer(pid, uid, owner_uid, cgroup_text):
    if uid == 0:
        return True
    if uid != owner_uid:
        return False
    return any(set(line.split(':', 2)[-1].split('/')) & ALLOWED_UNITS
               for line in cgroup_text.splitlines())


def command(request):
    if not isinstance(request, dict):
        raise ValueError('Request must be an object')
    op = request.get('op')
    if op == 'status':
        if set(request) != {'op'}: raise ValueError('Unexpected fields')
        return None
    if op in ('gmail_search', 'drive_search', 'drive_list'):
        if set(request) - {'op', 'query', 'limit'}: raise ValueError('Unexpected fields')
        limit = request.get('limit', 10)
        if type(limit) is not int or not 1 <= limit <= 50: raise ValueError('Limit must be 1..50')
        query = request.get('query', '')
        if not isinstance(query, str) or len(query) > 2048 or '\x00' in query:
            raise ValueError('Invalid query')
        if op == 'drive_list':
            if query: raise ValueError('Use drive_search for queries')
            return ['drive', 'ls', '--max', str(limit)]
        if not query.strip(): raise ValueError('A query is required')
        # -- ends flag parsing, so a query can never add gog flags.
        return (['gmail', 'messages', 'search'] if op == 'gmail_search' else ['drive', 'search']) + ['--max', str(limit), '--', query]
    if op in ('gmail_get', 'drive_get', 'drive_download'):
        if set(request) - {'op', 'id'}: raise ValueError('Unexpected fields')
        item = request.get('id', '')
        if not isinstance(item, str) or not ID.fullmatch(item): raise ValueError('Invalid item ID')
        if op == 'gmail_get': return ['gmail', 'get', item]
        if op == 'drive_get': return ['drive', 'get', item]
        return ['drive', 'download', item]
    raise ValueError('Unsupported operation; Google writes and email sending are unavailable')


def execute(request, config):
    args = command(request)
    if args is None:
        return {'service': 'ready', 'gmail_send_allowed': False, 'operations':
                ['gmail_search', 'gmail_get', 'drive_list', 'drive_search', 'drive_get', 'drive_download']}
    env = {'PATH': '/usr/bin:/bin', 'HOME': '/var/lib/bamware-google',
           'GOG_KEYRING_BACKEND': 'file',
           'GOG_KEYRING_PASSWORD': (Path(os.environ['CREDENTIALS_DIRECTORY'])/'keyring').read_text()}
    prefix = ['/opt/bamware-google/bin/gog', '--home', '/var/lib/bamware-google/gog-managed',
              '--account', config['account'], '--readonly', '--gmail-no-send', '--no-input', '--json']
    with tempfile.TemporaryDirectory(prefix='google-read-') as tmp:
        output = Path(tmp)/'result'
        download = request['op'] == 'drive_download'
        if download:
            args += ['--out', str(output), '--format', 'txt']
        with open(Path(tmp)/'stdout', 'wb') as stdout, open(Path(tmp)/'stderr', 'wb') as stderr:
            result = subprocess.run(prefix+args, env=env, stdout=stdout, stderr=stderr, timeout=45)
        if result.returncode:
            # Never return raw errors containing account details, URLs or tokens.
            raise RuntimeError('Google read failed; check API enablement, consent expiry or item access')
        source = output if download else Path(tmp)/'stdout'
        if source.stat().st_size > MAX_RESULT: raise ValueError('Result exceeds the 5 MiB limit')
        data = source.read_bytes()
        if download:
            try: return {'text': data.decode('utf-8')}
            except UnicodeDecodeError: return {'encoding': 'base64', 'data': base64.b64encode(data).decode()}
        return json.loads(data)


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        self.connection.settimeout(55)
        pid, uid, gid = struct.unpack('3i', self.connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        try:
            # Root verifier is trusted. Other callers must be descendants of the actual services.
            cgroup = Path(f'/proc/{pid}/cgroup').read_text() if uid else ''
            if not allowed_peer(pid, uid, self.server.config['owner_uid'], cgroup):
                raise PermissionError('Caller is not an approved Chief of Staff service')
            line = self.rfile.readline(MAX_REQUEST + 1)
            if len(line) > MAX_REQUEST or not line.endswith(b'\n'): raise ValueError('Invalid request length')
            result = execute(json.loads(line), self.server.config)
            response = {'ok': True, 'untrusted_external_data': True, 'result': result}
        except Exception as exc:
            response = {'ok': False, 'error': str(exc) if isinstance(exc, (ValueError, PermissionError, RuntimeError))
                        else 'Google broker request failed'}
        try: self.wfile.write(json.dumps(response).encode()+b'\n')
        except (BrokenPipeError, ConnectionResetError): pass


if __name__ == '__main__':
    config = json.loads(CONFIG.read_text())
    if Path(SOCKET).exists(): Path(SOCKET).unlink()
    with socketserver.UnixStreamServer(SOCKET, Handler) as server:
        server.config = config
        # Peer UID and service cgroup are validated for every request.
        os.chmod(SOCKET, 0o666)
        server.serve_forever()
