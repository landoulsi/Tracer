const { spawn } = require('child_process');
const fs = require('fs');

function createMitmParser({ safeLogFile, shouldExclude, enqueueCall, formatTimestamp }) {
  const safeLogState = { blockType: null, lines: [] };
  const safePendingRequests = new Map(); // Map<string, ApiLogTransaction[]>

  function enqueuePending(url, tx) {
    if (!url || !tx) return;
    const queue = safePendingRequests.get(url) || [];
    queue.push(tx);
    safePendingRequests.set(url, queue);
  }

  function dequeuePending(url) {
    if (!url) return null;
    const queue = safePendingRequests.get(url) || [];
    const tx = queue.shift();
    if (queue.length === 0) {
      safePendingRequests.delete(url);
    } else {
      safePendingRequests.set(url, queue);
    }
    return tx || null;
  }

  function extractSafeHeadersAndBody(lines, startIndex = 1) {
    const headers = {};
    const bodyChunks = [];
    let inBody = false;

    for (let i = startIndex; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed && !inBody) continue;

      const bodyMatch = trimmed.match(/^Body:\s*(.*)$/i);
      if (bodyMatch) {
        bodyChunks.push(bodyMatch[1]);
        inBody = true;
        continue;
      }

      if (inBody) {
        bodyChunks.push(trimmed);
        continue;
      }

      const headerMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (headerMatch) {
        headers[headerMatch[1]] = headerMatch[2];
      }
    }

    return {
      headers,
      body: bodyChunks.join('\n').trim(),
    };
  }

  function processSafeRequestBlock(lines) {
    if (!lines.length) return;
    const requestLineIndex = lines.findIndex(line => line.trim().length > 0);
    if (requestLineIndex === -1) return;
    const requestLine = lines[requestLineIndex].trim();
    if (!requestLine) return;

    const tokens = requestLine.trim().split(/\s+/);
    const method = tokens.shift();
    const url = tokens.join(' ').trim();
    if (!method || !url) return;
    if (shouldExclude(url)) {
      return;
    }

    const { headers, body } = extractSafeHeadersAndBody(lines, requestLineIndex + 1);
    const requestData = {
      id: Date.now() + Math.random(),
      timestamp: formatTimestamp(),
      method,
      url,
      requestHeaders: headers,
      requestBody: body,
      responseStatus: null,
      responseTime: null,
      responseHeaders: {},
      responseBody: '',
    };

    enqueuePending(url, requestData);
  }

  function processSafeResponseBlock(lines) {
    if (!lines.length) {
      return;
    }

    const responseLineIndex = lines.findIndex(line => line.trim().length > 0);
    if (responseLineIndex === -1) {
      return;
    }

    const statusLine = lines[responseLineIndex].trim();
    const responseMatch = statusLine.match(/^(\d{3})\s+(?:.*?\s+)?URL:\s*(.+)$/);
    if (!responseMatch) {
      return;
    }

    const responseUrl = responseMatch[2];

    const pendingRequest = dequeuePending(responseUrl);
    if (!pendingRequest) {
      return;
    }

    const { headers, body } = extractSafeHeadersAndBody(lines, responseLineIndex + 1);
    const call = {
      ...pendingRequest,
      url: responseUrl,
      responseStatus: Number(responseMatch[1]),
      responseTime: '0ms',
      responseHeaders: headers,
      responseBody: body,
    };
    enqueueCall(call);
  }

  function handleSafeLine(rawLine) {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    if (trimmed.includes('===== REQUEST =====')) {
      safeLogState.blockType = 'request';
      safeLogState.lines = [];
      return;
    }

    if (trimmed.includes('===== RESPONSE =====')) {
      safeLogState.blockType = 'response';
      safeLogState.lines = [];
      return;
    }

    if (trimmed.includes('========================')) {
      if (safeLogState.blockType === 'request') {
        processSafeRequestBlock(safeLogState.lines);
      } else if (safeLogState.blockType === 'response') {
        processSafeResponseBlock(safeLogState.lines);
      }
      safeLogState.blockType = null;
      safeLogState.lines = [];
      return;
    }

    if (safeLogState.blockType) {
      safeLogState.lines.push(rawLine);
    }
  }

  class MitmProxyParser {
    constructor() {
      this.logFile = safeLogFile;
      this.tailProcess = null;
    }

    start() {
      if (!this.logFile) {
        console.error('TRACER_LOG not provided; cannot start mitmproxy parser.');
        return;
      }

      try {
        if (!fs.existsSync(this.logFile)) {
          fs.writeFileSync(this.logFile, '');
        }
        const initialBuffer = fs.readFileSync(this.logFile, 'utf-8');
        initialBuffer.split(/\r?\n/).forEach(line => handleSafeLine(line));
        console.log(`✓ Loaded existing API calls from MITM log file`);
      } catch (err) {
        console.error('Error reading MITM log file:', err);
      }

      console.log(`Watching MITM log: ${this.logFile}`);
      let safeTailBuffer = '';
      this.tailProcess = spawn('tail', ['-n', '0', '-F', this.logFile]);

      this.tailProcess.stdout.on('data', (data) => {
        safeTailBuffer += data.toString();
        const lines = safeTailBuffer.split('\n');
        safeTailBuffer = lines.pop() || '';
        lines.forEach(line => line.trim() && handleSafeLine(line));
      });

      this.tailProcess.stderr.on('data', (data) => {
        console.error('Tail error:', data.toString());
      });

      this.tailProcess.on('error', (err) => {
        console.error('Tail process error:', err);
      });
    }

    stop() {
      if (this.tailProcess) {
        try {
          this.tailProcess.kill();
        } catch (_) {}
        this.tailProcess = null;
      }
    }
  }

  const parserInstance = new MitmProxyParser();

  return {
    start: () => parserInstance.start(),
    stop: () => parserInstance.stop(),
    handleSafeLine,
    resetState: () => {
      safeLogState.blockType = null;
      safeLogState.lines = [];
      safePendingRequests.clear();
    }
  };
}

module.exports = { createMitmParser };
