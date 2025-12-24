#!/usr/bin/env bash

# Generic network sniffer using mitmproxy
# Captures all HTTP/HTTPS traffic from Android device

PORT=8888

cat <<'EOF'
⚠️  WARNING: Network Proxy Alert
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This script sets up a network proxy to capture API calls.
In some cases, this may temporarily interrupt network connectivity.

🔧 If you experience connection issues:
   Run: ./fix_device_network.sh

This will restore your device's network settings.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

# ---- Single device check ----
DEV=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
if [ -z "$DEV" ]; then
  echo "[ERROR] No device connected."
  exit 1
fi
if [ "$(echo "$DEV" | wc -l | tr -d ' ')" != "1" ]; then
  echo "[ERROR] Multiple devices detected:"
  echo "$DEV"
  exit 1
fi
echo "[INFO] Using device: $DEV"

# ---- Detect if emulator ----
IS_EMULATOR=false
if [[ "$DEV" == emulator-* ]]; then
  IS_EMULATOR=true
  echo "[INFO] Detected emulator"
else
  echo "[INFO] Detected physical device"
fi

# ---- Kill old mitm instances ----
echo "[INFO] Killing previous mitmproxy/mitmdump…"
pkill -9 mitmproxy 2>/dev/null || true
pkill -9 mitmdump 2>/dev/null || true
sleep 0.5

# ---- Ensure port is free ----
if lsof -i :"$PORT" >/dev/null 2>&1; then
  echo "[ERROR] Port $PORT is still in use:"
  lsof -i :"$PORT"
  exit 1
fi

# ---- Clean up old temp files ----
rm -f /tmp/mitm_addon_*.py 2>/dev/null || true

# ---- Clean up any stuck proxy settings ----
echo "[INFO] Cleaning any previous proxy settings…"
adb shell settings delete global http_proxy >/dev/null 2>&1 || true
adb shell settings delete global global_http_proxy_host >/dev/null 2>&1 || true
adb shell settings delete global global_http_proxy_port >/dev/null 2>&1 || true
adb reverse --remove-all >/dev/null 2>&1 || true

# ---- Create temp addon file ----
ADDON_FILE="$(mktemp /tmp/mitm_addon_XXXXXX.py)" || {
  echo "[ERROR] Failed to create temp addon file"
  exit 1
}

if [ -z "$ADDON_FILE" ] || [ ! -f "$ADDON_FILE" ]; then
  echo "[ERROR] Temp addon file was not created properly"
  exit 1
fi

cat > "$ADDON_FILE" << 'EOF'
import sys
from mitmproxy import http


def request(flow: http.HTTPFlow) -> None:
    """Log all HTTP requests"""
    req = flow.request
    print("===== REQUEST =====")
    print(f"{req.method} {req.url}")
    for k, v in req.headers.items():
        print(f"{k}: {v}")
    if req.content:
        try:
            body = req.content.decode("utf-8", errors="ignore")
        except Exception:
            body = "<binary>"
        print("Body:", body)
    print("===================")
    sys.stdout.flush()


def response(flow: http.HTTPFlow) -> None:
    """Log all HTTP responses"""
    resp = flow.response
    req = flow.request
    print("===== RESPONSE =====")
    print(f"{resp.status_code} {resp.reason}  URL: {req.url}")
    for k, v in resp.headers.items():
        print(f"{k}: {v}")
    if resp.content:
        try:
            body = resp.content.decode("utf-8", errors="ignore")
        except Exception:
            body = "<binary>"
        print("Body:", body)
    print("====================\n")
    sys.stdout.flush()
EOF


cleanup() {
  echo
  echo "[CLEANUP] Stopping sniffer..."

  # Kill any mitmdump processes
  pkill -9 mitmdump 2>/dev/null || true

  # Note: We intentionally leave proxy settings active
  # Users can run fix_device_network.sh to clean them up

  # Remove temp addon file
  [ -n "$ADDON_FILE" ] && [ -f "$ADDON_FILE" ] && rm -f "$ADDON_FILE"

  echo "[CLEANUP] Done. Run ./bin/fix_device_network.sh to remove proxy settings."
}

trap cleanup EXIT INT TERM

# ---- Setup certificate for first-time use ----
MITM_CERT="$HOME/.mitmproxy/mitmproxy-ca-cert.cer"
if [ ! -f "$MITM_CERT" ]; then
  echo "[INFO] Generating mitmproxy certificate..."
  mitmdump --version >/dev/null 2>&1 || {
    echo "[ERROR] mitmproxy not installed. Install with:"
    echo "  macOS: brew install mitmproxy"
    echo "  Linux: apt-get install mitmproxy"
    exit 1
  }
  timeout 2 mitmdump >/dev/null 2>&1 || true
fi

# Check if certificate needs to be installed (one-time setup)
CERT_INSTALLED_MARKER="$HOME/.mitmproxy/.cert_installed_$DEV"
if [ ! -f "$CERT_INSTALLED_MARKER" ]; then
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║          FIRST-TIME SETUP: Install mitmproxy Certificate       ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "📋 One-time manual step (takes 30 seconds):"
  echo ""
  echo "1. The certificate will be pushed to your device"
  echo "2. Open Settings > Security > Install from SD card"
  echo "3. Select 'mitmproxy-ca-cert.cer'"
  echo "4. Name it anything (e.g., 'mitmproxy')"
  echo "5. Tap 'OK'"
  echo ""
  echo "Pushing certificate to device..."

  # Push cert to device download folder
  adb push "$MITM_CERT" /sdcard/Download/mitmproxy-ca-cert.cer >/dev/null 2>&1

  echo "✓ Certificate pushed to /sdcard/Download/mitmproxy-ca-cert.cer"
  echo ""
  read -p "Press ENTER after you've installed the certificate..."

  # Mark as installed for this device
  touch "$CERT_INSTALLED_MARKER"

  echo ""
  echo "✓ Setup complete! You won't see this message again for this device."
  echo ""
fi

# ---- Configure device proxy ----
echo "[INFO] Setting adb reverse + global HTTP proxy…"
echo "[INFO] Using port: $PORT"

adb reverse tcp:$PORT tcp:$PORT

adb shell settings put global http_proxy 127.0.0.1:$PORT
adb shell settings put global global_http_proxy_host 127.0.0.1 >/dev/null 2>&1
adb shell settings put global global_http_proxy_port $PORT >/dev/null 2>&1

echo "[INFO] Device http_proxy:"
adb shell settings get global http_proxy | tr -d '\r'

echo ""
echo "=============================="
echo " READY                        "
echo " - Open your app              "
echo " - API calls show below       "
echo " - CTRL+C = cleanup + exit    "
echo "=============================="
echo ""

# ---- Run mitmdump ----
# Use PYTHONUNBUFFERED to ensure real-time log streaming

# Check for upstream proxy (corporate proxies)
UPSTREAM_PROXY=""
if lsof -i :9000 >/dev/null 2>&1; then
  UPSTREAM_PROXY="--mode upstream:http://127.0.0.1:9000"
  echo "[INFO] Detected upstream proxy on port 9000"
elif lsof -i :9400 >/dev/null 2>&1; then
  UPSTREAM_PROXY="--mode upstream:http://127.0.0.1:9400"
  echo "[INFO] Detected upstream proxy on port 9400"
fi

PYTHONUNBUFFERED=1 mitmdump \
  --listen-port "$PORT" \
  -s "$ADDON_FILE" \
  $UPSTREAM_PROXY \
  --ssl-insecure \
  --quiet \
  --set console_eventlog_verbosity=error \
  --set console_flowdetails=0
