#!/usr/bin/env bash
# asc-key.sh — (re)connect this Mac to the App Store Connect API so agents can
# read TestFlight builds and tester feedback (screenshots, crashes).
# Stores: issuer id + key id in the SSM vault, the .p8 in
# ~/.appstoreconnect/private_keys/. Verifies with a real API call. Never echoes
# the key. Needs: aws (profile bamware), openssl, python3.
set -euo pipefail
AWS="aws --profile ${AWS_PROFILE:-bamware}"
KEYDIR="$HOME/.appstoreconnect/private_keys"
open_url() { if command -v open >/dev/null; then open "$1"; elif command -v xdg-open >/dev/null; then xdg-open "$1"; else echo "  open: $1"; fi; }

echo "Stage 1/4 — open App Store Connect → Users and Access → Integrations → App Store Connect API (Team Keys)"
echo "  If no key exists: click +, name it 'bamware-agents', access 'App Manager', Generate, then Download the .p8 (one-time download)."
open_url "https://appstoreconnect.apple.com/access/integrations/api"
read -r -p "  Press Enter when the page is open... " _

echo "Stage 2/4 — copy three things from that page"
read -r -p "  Issuer ID (UUID at the top of the page): " ISSUER
read -r -p "  Key ID (10 characters, in the key's row): " KEYID
read -r -p "  Path to the .p8 file (drag it into this window; Enter to reuse $KEYDIR/AuthKey_<KeyID>.p8): " P8
P8="${P8//\\ / }"; P8="${P8%\'}"; P8="${P8#\'}"
mkdir -p "$KEYDIR"; DEST="$KEYDIR/AuthKey_${KEYID}.p8"
if [ -n "$P8" ]; then cp "$P8" "$DEST"; fi
[ -f "$DEST" ] || { echo "  no key file at $DEST"; exit 1; }
chmod 600 "$DEST"

echo "Stage 3/4 — test the key against Apple"
RESULT=$(ASC_ISS="$ISSUER" ASC_KID="$KEYID" ASC_P8="$DEST" python3 - <<'PY'
import base64, json, os, subprocess, time, urllib.request, urllib.error
iss, kid, key = os.environ["ASC_ISS"], os.environ["ASC_KID"], os.environ["ASC_P8"]
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time())
h = b64(json.dumps({"alg": "ES256", "kid": kid, "typ": "JWT"}, separators=(",", ":")).encode())
p = b64(json.dumps({"iss": iss, "iat": now, "exp": now + 600, "aud": "appstoreconnect-v1"}, separators=(",", ":")).encode())
der = subprocess.run(["openssl", "dgst", "-sha256", "-sign", key], input=f"{h}.{p}".encode(), capture_output=True, check=True).stdout
i = [2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)]
def rd():
    l = der[i[0] + 1]; v = der[i[0] + 2:i[0] + 2 + l]; i[0] += 2 + l; return v.lstrip(b"\0").rjust(32, b"\0")
tok = f"{h}.{p}.{b64(rd() + rd())}"
try:
    d = json.load(urllib.request.urlopen(urllib.request.Request("https://api.appstoreconnect.apple.com/v1/apps?limit=5", headers={"Authorization": "Bearer " + tok}), timeout=30))
    print("OK " + ", ".join(a["attributes"]["name"] for a in d["data"]))
except urllib.error.HTTPError as e:
    print("FAIL %s" % e.code)
PY
)
echo "  $RESULT"
case "$RESULT" in OK*) ;; *) echo "  Apple rejected the key. Check the Issuer ID and Key ID, and that the key is not revoked."; exit 1;; esac

echo "Stage 4/4 — store ids in the vault"
$AWS ssm put-parameter --name /bamware/shared/asc-issuer-id --value "$ISSUER" --type SecureString --overwrite >/dev/null
$AWS ssm put-parameter --name /bamware/shared/asc-key-id --value "$KEYID" --type SecureString --overwrite >/dev/null
echo "  ✓ stored. Tell the agent: 'asc key works'."
