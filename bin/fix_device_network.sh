#!/bin/bash
# Fix Android device network issues
# Use this when your device networking stops working after using API logger

show_help() {
  cat <<EOF
Usage: $(basename "$0") [options]

Fix network connectivity issues on Android device caused by API logger.

Options:
  --proxy-only        Only remove proxy settings (quick fix)
  --remove-certs      Also remove all user certificates (full reset)
  --help              Show this help message

Examples:
  $(basename "$0")                    # Quick fix: remove proxy only
  $(basename "$0") --remove-certs     # Full fix: remove proxy + certificates

Common issues fixed:
  • Device can't connect to internet (proxy stuck)
  • Apps showing network errors
  • Certificate-related SSL errors
EOF
}

REMOVE_CERTS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --proxy-only)
      REMOVE_CERTS=false
      ;;
    --remove-certs)
      REMOVE_CERTS=true
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Use --help to see available options." >&2
      exit 1
      ;;
  esac
  shift
done

echo "🔧 Fixing Android device network..."
echo ""

# Check if device is connected
DEV=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
if [ -z "$DEV" ]; then
  echo "❌ No device connected."
  exit 1
fi

echo "📱 Device: $DEV"
echo ""

# ===== STEP 1: Remove proxy settings (always) =====
echo "🌐 Removing proxy settings..."
adb shell settings delete global http_proxy 2>/dev/null
adb shell settings delete global global_http_proxy_host 2>/dev/null
adb shell settings delete global global_http_proxy_port 2>/dev/null
adb reverse --remove-all 2>/dev/null

PROXY_CHECK=$(adb shell settings get global http_proxy 2>/dev/null | tr -d '\r')
if [ "$PROXY_CHECK" = "null" ] || [ -z "$PROXY_CHECK" ]; then
  echo "✓ Proxy settings removed"
else
  echo "⚠️  Proxy might still be set: $PROXY_CHECK"
fi

# Force stop browser to clear proxy cache
echo "🔄 Force stopping browser to clear proxy cache..."
adb shell am force-stop com.android.chrome 2>/dev/null
echo "✓ Browser restarted"

echo ""

# ===== STEP 2: Remove certificates (optional) =====
if [ "$REMOVE_CERTS" = true ]; then
  echo "🔐 Removing user certificates..."
  echo ""

  # Check what certificates exist
  USER_CERTS=$(adb shell "ls /data/misc/user/*/cacerts-added/ 2>/dev/null" | wc -l | tr -d ' ')

  if [ "$USER_CERTS" = "0" ]; then
    echo "ℹ️  No user certificates found to remove."
  else
    echo "Found $USER_CERTS user certificate(s)"
    echo ""

    read -p "⚠️  Remove all user certificates? (affects ALL apps) (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
      # Check if device is rooted/emulator
      IS_ROOT=$(adb shell "su -c 'echo yes' 2>/dev/null" | tr -d '\r')
      IS_EMULATOR=false
      if [[ "$DEV" == emulator-* ]]; then
        IS_EMULATOR=true
      fi

      if [ "$IS_ROOT" = "yes" ] || [ "$IS_EMULATOR" = true ]; then
        echo "[INFO] Root/emulator access - attempting automated removal..."
        adb shell "su -c 'rm -rf /data/misc/user/*/cacerts-added/*'" 2>/dev/null
        adb shell "su -c 'rm -rf /data/misc/keychain/cacerts-added/*'" 2>/dev/null
        adb shell "su -c 'pm clear com.android.certinstaller'" 2>/dev/null
        adb shell "su -c 'killall com.android.keychain'" 2>/dev/null

        sleep 1
        REMAINING=$(adb shell "ls /data/misc/user/*/cacerts-added/ 2>/dev/null" | wc -l | tr -d ' ')
        if [ "$REMAINING" = "0" ]; then
          echo "✓ Certificates removed successfully"
        else
          echo "⚠️  Some certificates may remain - manual removal needed"
        fi
      else
        echo "[WARNING] No root access - manual removal required:"
        echo ""
        echo "📋 Steps to manually remove certificates:"
        echo "1. Settings → Security → Encryption & credentials"
        echo "2. Tap 'User credentials'"
        echo "3. Tap each certificate you want to remove"
        echo "4. Tap 'Remove' or 'Delete'"
        echo ""
      fi
    else
      echo "ℹ️  Skipped certificate removal"
    fi
  fi
  echo ""
fi

# ===== STEP 3: Offer to restart device =====
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Network fix completed!"
echo ""
echo "💡 Recommendations:"
echo "   • Test your internet connection now"
if [ "$REMOVE_CERTS" = false ]; then
  echo "   • If issues persist, run with --remove-certs"
fi
echo "   • Restart device if still having problems"
echo ""

read -p "🔄 Restart device now? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Restarting device..."
  adb reboot
  echo "✓ Device is restarting..."
else
  echo "ℹ️  Done! Test your network connection."
fi
