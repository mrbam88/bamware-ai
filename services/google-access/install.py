#!/usr/bin/env python3
"""Root installer; reuses server-held authorization without exposing it."""
import json, os, pathlib, pwd, shutil, socket, subprocess, time
ROOT=pathlib.Path('/opt/bamware-google')
SRC=pathlib.Path(__file__).resolve().parent

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def rpc(request):
    with socket.socket(socket.AF_UNIX) as s:
        s.settimeout(60); s.connect('/run/bamware-google/access.sock')
        s.sendall(json.dumps(request).encode()+b'\n')
        response=json.loads(s.makefile('rb').readline(8*1024*1024))
    if not response.get('ok'): raise RuntimeError(response.get('error'))
    return response

def main():
    if os.geteuid()!=0: raise SystemExit('Run with sudo on the server.')
    service=pwd.getpwnam('bamware-google')
    owner=pwd.getpwnam('bilal')
    env={'PATH':'/usr/bin:/bin','HOME':'/var/lib/bamware-google','GOG_KEYRING_BACKEND':'file',
         'GOG_KEYRING_PASSWORD':pathlib.Path('/etc/bamware-google/keyring.passphrase').read_text()}
    args=['runuser','-u','bamware-google','--',str(ROOT/'bin/gog'),'--home',
          '/var/lib/bamware-google/gog-managed','--no-input','--json','auth','list']
    accounts=json.loads(run(args,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout)
    def find(value):
        if isinstance(value,dict):
            if 'email' in value and 'scopes' in value: yield value
            else:
                for v in value.values(): yield from find(v)
        elif isinstance(value,list):
            for v in value: yield from find(v)
    matches=list(find(accounts))
    if len(matches)!=1: raise SystemExit('Expected exactly one authorized Google account; nothing installed.')
    account=matches[0]
    scopes=set(account['scopes'])
    allowed={'openid','email','https://www.googleapis.com/auth/userinfo.email',
             'https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/drive.readonly'}
    required={'https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/drive.readonly'}
    if not required <= scopes or not scopes <= allowed:
        raise SystemExit('Stored permissions do not match the read-only policy. Nothing installed.')
    for name in ('broker.py','client.py'):
        shutil.copyfile(SRC/name,ROOT/name); os.chmod(ROOT/name,0o755); os.chown(ROOT/name,0,0)
    cfg=pathlib.Path('/etc/bamware-google/broker.json')
    cfg.write_text(json.dumps({'account':account['email'],'owner_uid':owner.pw_uid})+'\n')
    os.chmod(cfg,0o640); os.chown(cfg,0,service.pw_gid)
    # Config directory is traversable only by the service group; key stays root-only.
    os.chown(cfg.parent,0,service.pw_gid); os.chmod(cfg.parent,0o750)
    shutil.copyfile(SRC/'bamware-google.service','/etc/systemd/system/bamware-google.service')
    run(['systemd-analyze','verify','/etc/systemd/system/bamware-google.service'])
    run(['systemctl','daemon-reload']); run(['systemctl','enable','--now','bamware-google.service'])
    run(['systemctl','restart','bamware-google.service'])
    for _ in range(30):
        if pathlib.Path('/run/bamware-google/access.sock').exists(): break
        time.sleep(.1)
    rpc({'op':'status'})
    rpc({'op':'gmail_search','query':'newer_than:1d','limit':1})
    rpc({'op':'drive_list','limit':1})
    # Prove the ordinary build/SSH user cannot use the broker.
    denied=subprocess.run(['runuser','-u','bilal','--','python3',str(ROOT/'client.py')],
        input=b'{"op":"status"}',stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    denial=json.loads(denied.stdout)
    if denied.returncode!=1 or denial.get('ok') is not False:
        run(['systemctl','stop','bamware-google.service'])
        raise SystemExit('Worker isolation check failed; broker stopped.')
    skill=pathlib.Path(owner.pw_dir)/'.hermes/skills/google-chief-of-staff'
    skill.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(SRC/'SKILL.md',skill/'SKILL.md')
    os.chown(skill,owner.pw_uid,owner.pw_gid); os.chown(skill/'SKILL.md',owner.pw_uid,owner.pw_gid)
    status=pathlib.Path('/var/lib/bamware-google-status/broker.json')
    status.write_text(json.dumps({'service_ready':True,'gmail_read_verified':True,'drive_read_verified':True,
       'stored_scopes_readonly':True,'ordinary_worker_denied':True,'skill_installed':True,
       'assistant_turn_verified':False,'device_sync_enabled':False})+'\n')
    os.chmod(status,0o644)
    print('Google read service is running. Gmail/Drive reads passed. Ordinary worker access denied.')
    print('Chief of Staff skill installed. A real Assistant/Discord turn still needs verification.')
if __name__=='__main__': main()
