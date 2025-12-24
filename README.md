# Tracer

> A beautiful, real-time web-based network inspector for Android applications using mitmproxy

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Android-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D12.0.0-brightgreen.svg)

Tracer is a powerful network monitoring tool that captures and displays Android network traffic in a beautiful web interface. It uses mitmproxy to intercept HTTPS/HTTP traffic and provides real-time insights into your app's network activity.

## Features

✨ **Real-time monitoring** - Automatically captures network traffic and updates live
🎨 **Beautiful UI** - Clean, modern interface with request/response viewer
📊 **Detailed inspection** - View headers, body, status codes, and timing
🔒 **HTTPS support** - Built-in MITM proxy for intercepting encrypted traffic
💅 **JSON beautification** - Syntax-highlighted JSON with proper formatting
🚀 **One-command start** - Automatically sets up proxy and opens browser
🎯 **URL filtering** - Exclude unwanted endpoints with pattern matching
📱 **Zero code changes** - Works with any Android app

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Usage Examples](#usage-examples)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/landoulsi/tracer.git
cd tracer
```

2. Make the scripts executable:
```bash
chmod +x tracer bin/*.sh
```

3. Install mitmproxy:
```bash
# macOS
brew install mitmproxy

# Linux
apt-get install mitmproxy

# Or via pip
pip install mitmproxy
```

## Quick Start

1. Connect your Android device via USB and enable USB debugging

2. Run Tracer:
```bash
./tracer
```

3. On first run, you'll need to install the mitmproxy certificate on your device:
   - The script will push the certificate to your device
   - Go to Settings > Security > Install from SD card
   - Select `mitmproxy-ca-cert.cer` from Downloads
   - Name it "mitmproxy" and tap OK

4. Open your Android app and start making network requests

5. Watch them appear in real-time at http://localhost:3000

That's it! The web UI will show all HTTP/HTTPS traffic from your device.

## How It Works

### Architecture

```
┌─────────────────┐
│  Android Device │
│   (Any App)     │
└────────┬────────┘
         │
         │ All HTTP/HTTPS traffic
         │
    ┌────▼────────┐
    │  mitmproxy  │  (MITM Proxy on port 8888)
    │  + addon    │
    └────┬────────┘
         │
         │ Parsed logs
         │
    ┌────▼─────────┐
    │  Tracer Web  │  (Node.js server + UI)
    │  Interface   │
    └──────────────┘
         │
         │ Real-time updates (SSE)
         │
    ┌────▼────────┐
    │   Browser   │  (http://localhost:3000)
    └─────────────┘
```

### Components

1. **Main Script (`tracer`)**:
   - Orchestrates the entire setup
   - Manages certificate installation
   - Starts mitmproxy sniffer
   - Launches web server

2. **MITM Sniffer (`bin/mitm_sniffer.sh`)**:
   - Configures Android device proxy settings
   - Runs mitmproxy with custom addon
   - Captures all network traffic
   - Outputs structured logs

3. **Web Server (`web/index.js`)**:
   - Reads mitmproxy output
   - Parses logs into API call objects
   - Serves static web UI
   - Provides real-time updates via Server-Sent Events (SSE)

4. **Web UI (`web/public/`)**:
   - Beautiful interface for viewing requests/responses
   - Syntax highlighting for JSON
   - Real-time updates without page refresh

### Data Flow

1. **Proxy Setup**: Device routes all traffic through mitmproxy on your computer
2. **Interception**: mitmproxy intercepts and decrypts HTTPS traffic
3. **Logging**: Custom Python addon logs request/response details
4. **Parsing**: Node.js server parses logs into structured data
5. **Streaming**: Server-Sent Events push updates to browser
6. **Display**: React-like UI renders API calls in real-time

## Usage Examples

### Basic usage
```bash
./tracer
```

### Exclude health check endpoints
```bash
./tracer --exclude /ping --exclude /health --exclude /metrics
```

### Get help
```bash
./tracer --help
```

### Fix network issues
If your device loses internet connection:
```bash
./bin/fix_device_network.sh
```

## Requirements

### Required
- **Node.js** (v12 or higher)
- **ADB** (Android Debug Bridge) - Comes with Android SDK
- **mitmproxy** - For intercepting HTTPS traffic
- **Android device or emulator** with USB debugging enabled

### Supported Platforms
- macOS
- Linux
- Windows (via WSL)

### Supported Android Versions
- Android 7.0 (API 24) and higher
- Works on both physical devices and emulators

## Troubleshooting

### No API calls showing up?

**Check device connection:**
```bash
adb devices
# Should show your device
```

**Check if proxy is set:**
```bash
adb shell settings get global http_proxy
# Should show: 127.0.0.1:8888
```

**Verify mitmproxy is running:**
Look for "READY" message in the terminal after starting Tracer.

---

### Device loses internet connection?

This happens when proxy settings persist after Tracer exits.

**Quick fix** (removes proxy only):
```bash
./bin/fix_device_network.sh
```

**Full reset** (removes proxy + certificates):
```bash
./bin/fix_device_network.sh --remove-certs
```

---

### Certificate installation issues?

**Android 11+ security restrictions:**
1. Make sure you have a screen lock PIN set
2. Install as "CA certificate" (not VPN or App certificate)
3. Restart device after installation if it doesn't work

**Certificate not showing up:**
- Check `/sdcard/Download/` folder on device
- The script pushes `mitmproxy-ca-cert.cer` there automatically

---

### Port 3000 already in use?

Edit `web/index.js` and change the PORT:
```javascript
const PORT = 3000; // Change to any available port (e.g., 3001)
```

---

### mitmproxy not found?

Install it:
```bash
# macOS
brew install mitmproxy

# Linux
apt-get install mitmproxy

# Via pip
pip install mitmproxy
```

---

### Corporate proxy issues?

Tracer automatically detects common corporate proxies on ports 9000 and 9400.

If your proxy uses a different port, edit `bin/mitm_sniffer.sh`:
```bash
# Add your corporate proxy port
UPSTREAM_PROXY="--mode upstream:http://127.0.0.1:YOUR_PORT"
```

---

## Configuration

### Excluding Endpoints

Use the `--exclude` flag to filter out noisy endpoints:

```bash
./tracer --exclude /health --exclude /metrics --exclude /ping
```

The web UI will not display any requests matching these patterns.

### Changing the Proxy Port

Edit `bin/mitm_sniffer.sh`:
```bash
PORT=8888  # Change to your desired port
```

### Max Stored Requests

By default, Tracer keeps the last 100 requests in memory. To change this, edit `web/index.js`:

```javascript
function finalizeTransaction(txn) {
  transactions.push(txn);
  if (transactions.length > 100) { // Change this number
    transactions.shift();
  }
  // ...
}
```

### Custom mitmproxy Options

Edit `bin/mitm_sniffer.sh` and modify the `mitmdump` command at the end:

```bash
PYTHONUNBUFFERED=1 mitmdump \
  --listen-port "$PORT" \
  -s "$ADDON_FILE" \
  --ssl-insecure \
  --quiet \
  # Add your custom options here
```

See [mitmproxy documentation](https://docs.mitmproxy.org/) for all available options.

## Project Structure

```
tracer/
├── tracer                    # Main entry point
├── bin/
│   ├── mitm_sniffer.sh      # mitmproxy wrapper script
│   └── fix_device_network.sh # Network troubleshooting utility
├── web/                      # Web application
│   ├── index.js             # Node.js server (SSE + REST API)
│   ├── package.json         # Node dependencies (zero!)
│   ├── parsers/
│   │   └── mitm_parser.js   # Parses mitmproxy output
│   └── public/
│       ├── index.html       # Web UI (single-page app)
│       └── icon.png         # Favicon
├── LICENSE
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
└── .gitignore
```

## Advanced Usage

### Using with Emulators

Tracer works seamlessly with Android emulators (AVD, Genymotion, etc.):

```bash
# Start your emulator
emulator -avd Pixel_4_API_30

# Run Tracer
./tracer
```

### Debugging SSL Issues

If you see SSL errors in your app, it usually means the certificate isn't properly installed:

1. Verify certificate is installed:
   ```
   Settings > Security > Encryption & credentials > User credentials
   ```
   You should see "mitmproxy" in the list

2. Some apps use certificate pinning - Tracer cannot intercept those connections

3. For apps targeting Android 7.0+, you may need to modify the app to trust user certificates

### Saving Traffic Logs

To save all captured traffic to a file:

```bash
./tracer | tee tracer-$(date +%Y%m%d-%H%M%S).log
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

- How to submit bug reports and feature requests
- Development setup and workflow
- Code style guidelines
- Pull request process

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Uses [mitmproxy](https://mitmproxy.org/) for HTTPS interception
- Built with vanilla JavaScript and Node.js built-in modules (zero npm dependencies!)
- Inspired by developer tools like Charles Proxy and Flipper

## Support

- **Issues**: [GitHub Issues](https://github.com/landoulsi/tracer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/landoulsi/tracer/discussions)

## Security Note

Tracer is a **development tool** meant for debugging and testing. Do not use it on production devices or for malicious purposes. Always respect privacy and obtain proper authorization before monitoring network traffic.

---

Made with ❤️ for Android developers
