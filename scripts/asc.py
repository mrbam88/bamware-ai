import base64, json, os, subprocess, sys, time, urllib.request, urllib.error
def ssm(n): return subprocess.run(["aws","ssm","get-parameter","--profile","bamware","--name",n,"--with-decryption","--query","Parameter.Value","--output","text"],capture_output=True,text=True,check=True).stdout.strip()
iss, kid = ssm("/bamware/shared/asc-issuer-id"), ssm("/bamware/shared/asc-key-id")
key=os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{kid}.p8")
b64=lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def token():
    now=int(time.time())
    h=b64(json.dumps({"alg":"ES256","kid":kid,"typ":"JWT"},separators=(",",":")).encode()); p=b64(json.dumps({"iss":iss,"iat":now,"exp":now+600,"aud":"appstoreconnect-v1"},separators=(",",":")).encode())
    der=subprocess.run(["openssl","dgst","-sha256","-sign",key],input=f"{h}.{p}".encode(),capture_output=True,check=True).stdout
    i=[2 if der[1]<0x80 else 2+(der[1]&0x7F)]
    def rd():
        l=der[i[0]+1]; v=der[i[0]+2:i[0]+2+l]; i[0]+=2+l; return v.lstrip(b"\0").rjust(32,b"\0")
    return f"{h}.{p}.{b64(rd()+rd())}"
def get(path):
    url=path if path.startswith("http") else "https://api.appstoreconnect.apple.com"+path
    try: return json.load(urllib.request.urlopen(urllib.request.Request(url,headers={"Authorization":"Bearer "+token()}),timeout=60))
    except urllib.error.HTTPError as e: return {"_error":e.code,"_body":e.read().decode()[:300]}
if __name__=="__main__": print(json.dumps(get(sys.argv[1]),indent=1)[:6000])

# Usage:
#   python3 scripts/asc.py "/v1/builds?filter[app]=6802930990&sort=-uploadedDate&limit=5"
#   python3 scripts/asc.py "/v1/apps/6802930990/betaFeedbackScreenshotSubmissions?limit=5&sort=-createdDate"
#   python3 scripts/asc.py "/v1/apps/6802930990/betaFeedbackCrashSubmissions?limit=5&sort=-createdDate"
# Screenshot URLs are in attributes.screenshots[].url (JPEG, expire after a few days).
# Credentials: scripts/asc-key.sh (vault /bamware/shared/asc-issuer-id + asc-key-id,
# key file in ~/.appstoreconnect/private_keys/). BrewDesk Apple ID: 6802930990.
