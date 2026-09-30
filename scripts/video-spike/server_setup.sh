#!/usr/bin/env bash
# Set up the trend-video pipeline on a Linux box (the always-on `omarchy` server): venv + deps + AWS CLI for the vault.
# Run ON the server:  bash ~/code/bamware-ai/scripts/video-spike/server_setup.sh
# Then copy the private inputs from the Mac (never in git):  scp -r ~/Movies/video-spike/higgs omarchy:~/Movies/video-spike/
# Vault: the AWS profile `bamware` must exist here (aws configure --profile bamware; docs/security.md). Never paste keys in chat.
set -euo pipefail
ENV=${VIDEO_ENV:-$HOME/tools/falenv}
mkdir -p "$(dirname "$ENV")" ~/Movies/video-spike
for t in ffmpeg python3 git; do command -v $t >/dev/null || { echo "missing: $t (install with the distro package manager)"; exit 1; }; done
command -v yt-dlp >/dev/null || pip install --user -q yt-dlp
if ! command -v aws >/dev/null; then
  echo "installing AWS CLI v2 (user-local)"
  curl -sL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscli.zip
  (cd /tmp && rm -rf aws && unzip -q awscli.zip && ./aws/install -i "$HOME/.local/aws-cli" -b "$HOME/.local/bin" >/dev/null)
  export PATH="$HOME/.local/bin:$PATH"
fi
[ -d "$ENV" ] || python3 -m venv "$ENV"
"$ENV/bin/pip" install -q -U pip fal-client httpx pillow numpy opencv-python-headless >/dev/null
echo "venv: $ENV ($("$ENV/bin/python" -V))"
aws --profile bamware sts get-caller-identity --query Account --output text >/dev/null 2>&1 && echo "vault: ok" \
  || echo "vault: NOT configured -> aws configure --profile bamware (then re-run)"
echo "next: scp the inputs, then e.g.
  bash scripts/video-spike/higgs_env.sh scripts/video-spike/trend_video.py SOURCE START DUR out.mp4 --left ... --dry-run"
