#!/usr/bin/env python3
"""Export only provider quota metadata from local Codex events; never copy transcripts."""
import argparse, json, math, os, subprocess
from datetime import datetime, timezone
from pathlib import Path

def collect(root):
    latest = {}
    for path in sorted(root.rglob('*.jsonl'), key=lambda p:p.stat().st_mtime, reverse=True)[:20]:
        with path.open('rb') as stream:
            start=max(0,path.stat().st_size-2*1024*1024)
            stream.seek(start)
            if start: stream.readline()
            for line in stream:
                try:
                    event=json.loads(line); payload=event.get('payload',{})
                    if payload.get('type') != 'token_count': continue
                    limits=payload.get('rate_limits')
                    if not isinstance(limits,dict): continue
                    observed=event.get('timestamp')
                    stamp=datetime.fromisoformat(observed.replace('Z','+00:00')).timestamp()
                    for key in ('primary','secondary'):
                        bucket=limits.get(key)
                        if not isinstance(bucket,dict): continue
                        used=bucket.get('used_percent'); minutes=bucket.get('window_minutes'); reset=bucket.get('resets_at')
                        if type(used) not in (int,float) or not math.isfinite(used) or used<0: continue
                        if type(minutes) not in (int,float) or not math.isfinite(minutes) or minutes<=0: continue
                        reset_at=datetime.fromtimestamp(reset,timezone.utc).isoformat() if type(reset) in (int,float) and math.isfinite(reset) else None
                        scope=f'{key}-{minutes:g}min'
                        if scope not in latest or stamp > latest[scope][0]:
                            latest[scope]=(stamp, {'provider':'codex','scope':scope,'utilizationPct':used,
                                'resetAt':reset_at,'resetTimezone':'America/New_York',
                                'source':{'kind':'live','label':'Codex provider quota event · X1','fetchedAt':observed},
                                'notes':'Last provider reading from Codex on the X1; may become stale when the laptop is offline.'})
                except (ValueError,TypeError,AttributeError,OverflowError): continue
    return {'windows':[v[1] for v in latest.values()]}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--sessions',type=Path,default=Path.home()/'.codex/sessions'); parser.add_argument('--destination')
    args=parser.parse_args(); data=json.dumps(collect(args.sessions))
    if not args.destination: print(data); return
    # Fixed receiver stores sanitized JSON only. No shell interpolation of payload.
    receiver="import pathlib,sys,os,json; p=pathlib.Path.home()/'.local/state/bamware/codex-quota.json'; d=json.load(sys.stdin); p.parent.mkdir(parents=True,exist_ok=True); t=p.with_suffix('.tmp'); t.write_text(json.dumps(d)); t.chmod(0o600); os.replace(t,p)"
    import shlex
    result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',args.destination,'python3 -c '+shlex.quote(receiver)],input=data,text=True,capture_output=True,timeout=25)
    if result.returncode: raise SystemExit('Quota sync failed; previous reading retains its timestamp.')
    print('Sanitized Codex quota snapshot synced.')
if __name__=='__main__': main()
