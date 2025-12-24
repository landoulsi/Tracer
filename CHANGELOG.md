# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-12-24

### Added
- Initial release of Tracer
- Real-time network monitoring for Android applications
- MITM proxy support using mitmproxy
- Beautiful web UI for viewing HTTP/HTTPS traffic
- Request/Response inspection with headers and body
- JSON syntax highlighting
- URL pattern filtering with `--exclude` flag
- Automatic certificate management
- Device proxy configuration
- Network troubleshooting utility (`fix_device_network.sh`)
- Support for Android 7.0+ (API 24+)
- Support for both physical devices and emulators
- Zero npm dependencies (uses Node.js built-in modules)
- Comprehensive documentation (README, CONTRIBUTING)
- MIT License

### Features
- ✨ Real-time monitoring with Server-Sent Events (SSE)
- 🎨 Clean, modern web interface
- 📊 Detailed inspection of network calls
- 🔒 HTTPS/TLS interception
- 💅 Beautified JSON responses
- 🚀 One-command setup
- 🎯 Flexible URL filtering
- 📱 Works with any Android app (no code changes needed)

### Security
- Certificate installation guidance for first-time users
- Per-device certificate tracking
- Automatic upstream proxy detection (corporate proxies)
- Safe cleanup of proxy settings on exit

[Unreleased]: https://github.com/landoulsi/tracer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/landoulsi/tracer/releases/tag/v1.0.0
