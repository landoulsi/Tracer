# Contributing to Tracer

First off, thank you for considering contributing to Tracer! It's people like you that make Tracer such a great tool.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
  - [Git Commit Messages](#git-commit-messages)
  - [Shell Script Style](#shell-script-style)
  - [JavaScript Style](#javascript-style)
  - [Python Style](#python-style)
- [Project Structure](#project-structure)
- [Testing](#testing)

## Code of Conduct

This project and everyone participating in it is governed by a simple principle: **Be respectful and constructive**.

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Run command '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS: [e.g. macOS 13.0, Ubuntu 22.04]
- Node.js version: [e.g. v18.0.0]
- ADB version: [e.g. 1.0.41]
- Android version: [e.g. Android 12]
- mitmproxy version: [e.g. 9.0.1]
- Tracer version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List any alternatives you've considered**

**Enhancement Template:**

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
```

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - issues that should only require a few lines of code
- `help wanted` - issues that need attention
- `documentation` - improvements or additions to documentation

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** following our style guidelines
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Write a clear commit message** following our guidelines
6. **Submit a pull request**

**Pull Request Template:**

```markdown
**Description**
Brief description of what this PR does.

**Related Issue**
Fixes #(issue number)

**Type of Change**
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

**Testing**
Describe the tests you ran to verify your changes.

**Checklist**
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have tested this on both emulator and physical device (if applicable)
```

## Development Setup

1. **Clone your fork:**
```bash
git clone https://github.com/landoulsi/tracer.git
cd tracer
```

2. **Make the scripts executable:**
```bash
chmod +x tracer bin/*.sh
```

3. **Install mitmproxy:**
```bash
# macOS
brew install mitmproxy

# Linux
apt-get install mitmproxy

# Or via pip
pip install mitmproxy
```

4. **Connect an Android device:**
```bash
adb devices
```

5. **Test your setup:**
```bash
./tracer --help
./tracer  # Should start the web UI
```

## Style Guidelines

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

**Format:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, etc)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Example:**
```
feat: add support for custom proxy port

Allow users to specify a custom port for the MITM proxy
using the PORT environment variable. This is useful when
the default port 8888 is already in use.

Fixes #123
```

### Shell Script Style

- Use `#!/bin/bash` shebang
- Use 2 spaces for indentation
- Use `snake_case` for function and variable names
- Quote all variables: `"$VARIABLE"`
- Use `[[ ]]` for conditionals instead of `[ ]`
- Add comments for complex logic
- Use `set -e` for scripts that should exit on error (when appropriate)

**Example:**
```bash
#!/bin/bash

# Description of what this script does
show_help() {
  cat <<EOF
Usage: $(basename "$0") [options]
EOF
}

main() {
  local device_id="$1"

  if [[ -z "$device_id" ]]; then
    echo "Error: device_id is required" >&2
    exit 1
  fi

  # Process the device
  echo "Processing device: $device_id"
}

main "$@"
```

### JavaScript Style

- Use 2 spaces for indentation
- Use `const` for variables that don't change
- Use `let` for variables that do change
- Use arrow functions when appropriate
- Add comments for complex logic
- Use semicolons

**Example:**
```javascript
const http = require('http');

function parseLog(line) {
  const timestamp = line.match(/\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);

  if (!timestamp) {
    return null;
  }

  // Parse the log components
  return {
    timestamp: timestamp[0],
    message: line.substring(timestamp.index + timestamp[0].length)
  };
}
```

### Python Style

- Follow PEP 8
- Use 4 spaces for indentation
- Use `snake_case` for functions and variables
- Use docstrings for functions and classes
- Type hints are encouraged but not required

**Example:**
```python
def parse_network_event(event: dict) -> str:
    """
    Convert mitmproxy event to structured format.

    Args:
        event: The network event from mitmproxy

    Returns:
        Formatted log string
    """
    event_type = event.get('type')

    if event_type == 'request':
        return format_request(event)
    elif event_type == 'response':
        return format_response(event)

    return None
```

## Project Structure

Understanding the codebase:

```
tracer/
├── tracer                    # Main entry point
│   - Parses command-line arguments
│   - Sets up environment variables
│   - Launches MITM sniffer
│   - Starts web server
│
├── bin/
│   ├── mitm_sniffer.sh      # mitmproxy wrapper
│   │   - Configures mitmproxy
│   │   - Sets up device proxy settings
│   │   - Manages certificates
│   │   - Creates Python addon dynamically
│   │
│   └── fix_device_network.sh # Network repair utility
│       - Removes proxy settings
│       - Optionally removes certificates
│       - Restarts apps
│
└── web/
    ├── index.js              # Node.js server
    │   - Reads mitmproxy output
    │   - Parses logs using mitm parser
    │   - Serves static files
    │   - Provides SSE endpoint for real-time updates
    │   - REST API for historical data
    │
    ├── parsers/              # Log format converters
    │   └── mitm_parser.js    # Parses mitmproxy output
    │
    └── public/
        └── index.html        # Web UI
            - Connects to SSE for real-time updates
            - Displays API calls in list view
            - Shows request/response details
            - Syntax highlights JSON
```

## Testing

### Manual Testing

Before submitting a PR, please test:

1. **Basic functionality:**
```bash
./tracer
```

2. **URL filtering:**
```bash
./tracer --exclude /ping --exclude /health
```

3. **Error handling:**
- No device connected
- Device disconnected mid-session
- Port already in use
- Certificate installation failure

4. **Different Android versions:**
- Test on Android 10+
- Test on emulator and physical device

5. **Browser compatibility:**
- Chrome
- Firefox
- Safari

6. **Network fixes:**
```bash
./bin/fix_device_network.sh
./bin/fix_device_network.sh --remove-certs
```

### Adding Tests

We don't currently have automated tests, but we'd love to add them! If you're interested in contributing a testing framework, please open an issue to discuss the approach.

Some areas that would benefit from tests:
- Log parsing (mitm_parser.js)
- Request filtering
- Certificate management
- Proxy configuration

## Common Development Tasks

### Testing Parser Changes

If you modify `web/parsers/mitm_parser.js`:

1. Create test log files in `web/test-logs/`
2. Update the parser
3. Run the web server and check if logs are parsed correctly

### Adding New Features to Web UI

1. Edit `web/public/index.html`
2. Test in multiple browsers
3. Ensure mobile responsiveness
4. Verify real-time updates still work

### Modifying mitmproxy Behavior

1. Edit the Python addon in `bin/mitm_sniffer.sh` (inside the heredoc)
2. Test with both HTTP and HTTPS traffic
3. Verify the parser can still read the output

## Debugging Tips

### Debug mitmproxy Output

```bash
# Run the sniffer standalone
./bin/mitm_sniffer.sh

# Watch the logs
tail -f /tmp/mitm_log.*
```

### Debug Web Server

```bash
# Add console.log statements in web/index.js
# Restart the server and check terminal output
```

### Debug Certificate Issues

```bash
# Check if certificate is on device
adb shell ls /sdcard/Download/mitmproxy-ca-cert.cer

# Check if certificate is installed
adb shell "ls /data/misc/user/*/cacerts-added/"

# Check proxy settings
adb shell settings get global http_proxy
```

## Questions?

Don't hesitate to ask questions:

- **Open an issue** with the `question` label
- **Start a discussion** in GitHub Discussions
- **Look at existing issues** - someone may have asked the same question

## Recognition

Contributors will be recognized in the following ways:

- Listed in the README acknowledgments
- Mentioned in release notes for significant contributions
- Given credit in commit messages

Thank you for contributing to Tracer! 🎉
