// Entry point for adb logcat web viewer
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const safeLogFile = process.env.TRACER_LOG;
const sourcePreference = (process.env.TRACER_SOURCE || '').toLowerCase();
// useMitmSource is true when using mitmproxy log file
const useMitmSource = sourcePreference === 'mitm' &&
  typeof safeLogFile === 'string' &&
  safeLogFile.length > 0;

// Load config from shared config.json
const config = require('./config.json');
const LOGCAT_MAX_LINES = config.LOGCAT_MAX_LINES;

/**
 * @typedef {Object} ApiLogTransaction
 * @property {number} id
 * @property {string} timestamp
 * @property {string} method
 * @property {string} url
 * @property {Record<string, string>} requestHeaders
 * @property {string} requestBody
 * @property {number|null} responseStatus
 * @property {string|null} responseTime
 * @property {Record<string, string>} responseHeaders
 * @property {string} responseBody
 * @property {'request'|'waiting'|'response'|'body'} state
 */

/**
 * @typedef {Object} ApiCallPayload
 * @property {number} id
 * @property {string} timestamp
 * @property {string} method
 * @property {string} url
 * @property {Record<string, string>} requestHeaders
 * @property {string} requestBody
 * @property {number|null} responseStatus
 * @property {string|null} responseTime
 * @property {Record<string, string>} responseHeaders
 * @property {string} responseBody
 * @property {*} [requestBodyJson]
 * @property {*} [responseBodyJson]
 */

const { createMitmParser } = require('./parsers/mitm_parser');

let logcatLines = [];
let logcatProcess = null;
let currentPidFilter = null; // Currently active PID filter at adb level
let currentLogLevel = 'all'; // Currently active log level filter at adb level
const pidFilterSet = new Set(); // Track selected PID for client state

let apiCalls = []; // Store complete API call objects
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const sseClients = new Set();

function broadcast(event, payload) {
  const data = JSON.stringify(payload);
  for (const client of sseClients) {
    try {
      client.res.write(`event: ${event}\ndata: ${data}\n\n`);
    } catch (err) {
      console.warn('Failed to send SSE event', err);
    }
  }
}

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

const excludedPatternsSet = new Set(
  (process.env.TRACER_EXCLUDES || '')
    .split(',')
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
);

// Resolve adb path once with sensible defaults for packaged apps
function resolveAdbPath() {
  const home = os.homedir();
  const defaultPath = [
    process.env.PATH || '',
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    `${home}/Library/Android/sdk/platform-tools`,
    `${home}/Android/Sdk/platform-tools`
  ].filter(Boolean).join(':');

  const envWithDefaultPath = { ...process.env, PATH: defaultPath };

  // Explicit override
  if (process.env.TRACER_ADB_PATH && fs.existsSync(process.env.TRACER_ADB_PATH)) {
    return process.env.TRACER_ADB_PATH;
  }

  try {
    const which = spawnSync('which', ['adb'], { encoding: 'utf-8', env: envWithDefaultPath });
    const candidate = (which.stdout || '').trim();
    if (candidate) return candidate;
  } catch (err) {
    console.warn('Failed to resolve adb path via which:', err);
  }

  const candidates = [
    process.env.TRACER_ADB_PATH,
    '/usr/local/bin/adb',
    '/opt/homebrew/bin/adb',
    '/usr/bin/adb',
    `${home}/Library/Android/sdk/platform-tools/adb`,
    `${home}/Android/Sdk/platform-tools/adb`,
  ];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return null;
}

// Ensure PATH includes common platform-tools locations for packaged app context
(function ensurePath() {
  const home = os.homedir();
  const defaultPath = [
    process.env.PATH || '',
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    `${home}/Library/Android/sdk/platform-tools`,
    `${home}/Android/Sdk/platform-tools`
  ].filter(Boolean).join(':');
  process.env.PATH = defaultPath;
})();

const ADB_BIN = resolveAdbPath();

if (excludedPatternsSet.size > 0) {
  console.log(`Filtering out API calls matching: ${Array.from(excludedPatternsSet).join(', ')}`);
}

function getAdbStatus() {
  const base = {
    found: Boolean(ADB_BIN),
    path: ADB_BIN || null,
    deviceId: null,
    deviceName: null
  };

  if (!ADB_BIN) return base;

  try {
    const adbDevices = spawnSync(ADB_BIN, ['devices'], { encoding: 'utf-8' });
    if (adbDevices.error) throw adbDevices.error;

    const devices = (adbDevices.stdout || '')
      .split('\n')
      .slice(1)
      .map(line => line.trim())
      .filter(line => line.endsWith('\tdevice'))
      .map(line => line.split('\t')[0])
      .filter(Boolean);

    if (!devices.length) return { ...base, devices: [] };

    const primaryId = devices[0];
    const deviceNames = [];

    const model = spawnSync(ADB_BIN, ['-s', primaryId, 'shell', 'getprop', 'ro.product.model'], { encoding: 'utf-8' });
    let primaryName = (model.stdout || '').trim() || null;
    if (!primaryName) {
      const market = spawnSync(ADB_BIN, ['-s', primaryId, 'shell', 'getprop', 'ro.product.marketname'], { encoding: 'utf-8' });
      primaryName = (market.stdout || '').trim() || null;
    }
    if (primaryName) deviceNames.push(primaryName);

    return { ...base, deviceId: primaryId, deviceName: primaryName, devices };
  } catch (err) {
    console.warn('getAdbStatus failed:', err);
    return { ...base, error: err.message, devices: [] };
  }
}

function getExcludedPatterns() {
  return Array.from(excludedPatternsSet);
}

function shouldExclude(url) {
  for (const pattern of excludedPatternsSet) {
    if (url.includes(pattern)) return true;
  }
  return false;
}

function formatTimestamp(date = new Date()) {
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function tryParseJson(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    return null;
  }
}

function buildApiCallPayload(raw) {
  const responseStatus = Number(raw.responseStatus);
  const normalized = {
    id: raw.id || Date.now() + Math.random(),
    timestamp: raw.timestamp || formatTimestamp(),
    method: raw.method || 'UNKNOWN',
    url: raw.url || '',
    requestHeaders: raw.requestHeaders || {},
    requestBody: raw.requestBody || '',
    responseStatus: Number.isFinite(responseStatus) ? responseStatus : null,
    responseTime: raw.responseTime || null,
    responseHeaders: raw.responseHeaders || {},
    responseBody: raw.responseBody || '',
  };

  const requestJson = tryParseJson(normalized.requestBody);
  if (requestJson !== null) {
    normalized.requestBodyJson = requestJson;
  }

  const responseJson = tryParseJson(normalized.responseBody);
  if (responseJson !== null) {
    normalized.responseBodyJson = responseJson;
  }

  return normalized;
}

function enqueueCall(raw) {
  const payload = buildApiCallPayload(raw);
  apiCalls.unshift(payload);
  if (apiCalls.length > 100) {
    apiCalls = apiCalls.slice(0, 100);
  }
  broadcast('newLog', payload);
}


const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('Request handler error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Server error');
    } else {
      res.end();
    }
  });
});

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname || '/';

  if (req.method === 'GET' && pathname === '/events') {
    return handleSseConnection(req, res);
  }

  if (req.method === 'GET' && pathname === '/logs') {
    return sendJson(res, 200, {
      apiCalls,
      excludedPatterns: getExcludedPatterns()
    });
  }

  if (req.method === 'GET' && pathname === '/logcat') {
    // Return filtered lines based on active PID filter
    const filtered = getFilteredLogcatLines();
    return sendJson(res, 200, { lines: filtered });
  }

  if (req.method === 'GET' && pathname === '/logcat/pids') {
    return sendJson(res, 200, { pids: listAllPids(), filter: Array.from(pidFilterSet) });
  }

  if (req.method === 'GET' && pathname === '/logcat/filter') {
    return sendJson(res, 200, { pids: Array.from(pidFilterSet) });
  }

  if (req.method === 'GET' && pathname === '/config') {
    return sendJson(res, 200, {
      LOGCAT_MAX_LINES,
      source: sourcePreference || 'api'
    });
  }

  if (req.method === 'GET' && pathname === '/adb/status') {
    return sendJson(res, 200, getAdbStatus());
  }

  if (req.method === 'POST' && pathname === '/logcat/filter') {
    try {
      const body = await readJsonBody(req);
      const pids = Array.isArray(body.pids) ? body.pids.map(String) : [];
      const level = body.level || currentLogLevel;

      // Restart adb with the selected PID (or null for "All") and log level
      const selectedPid = pids.length > 0 ? pids[0] : null;
      restartAdb(selectedPid, level);

      pidFilterSet.clear();
      pids.forEach(pid => pidFilterSet.add(pid));
      return sendJson(res, 200, { ok: true, pids: Array.from(pidFilterSet), level });
    } catch (err) {
      console.error('PID filter error:', err);
      return sendJson(res, 400, { error: 'Invalid PID payload' });
    }
  }

  if (req.method === 'POST' && pathname === '/logcat/level') {
    try {
      const body = await readJsonBody(req);
      const level = body.level || 'all';

      // Restart adb with current PID and new log level
      restartAdb(currentPidFilter, level);

      return sendJson(res, 200, { ok: true, level });
    } catch (err) {
      console.error('Log level filter error:', err);
      return sendJson(res, 400, { error: 'Invalid level payload' });
    }
  }

  if (req.method === 'POST' && pathname === '/logcat/clear') {
    logcatLines = [];
    broadcast('logcatCleared', null);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/clear') {
    return handleClearLogs(res);
  }

  if (req.method === 'POST' && pathname === '/exclude') {
    return handlePatternCommand(req, res, 'exclude');
  }

  if (req.method === 'POST' && pathname === '/include') {
    return handlePatternCommand(req, res, 'include');
  }

  if (req.method === 'GET' && pathname === '/device') {
    return sendJson(res, 200, getConnectedDeviceInfo());
  }

  if (req.method === 'POST' && pathname === '/cert/push') {
    try {
      const result = pushCertToDevice();
      return sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      console.error('Certificate push failed:', err);
      return sendJson(res, 400, { ok: false, error: err.message || 'Failed to push certificate' });
    }
  }

  if (req.method === 'GET') {
    return serveStaticFile(pathname, res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function handleSseConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write(': connected\n\n');

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  const client = { res, keepAlive };
  sseClients.add(client);

  req.on('close', () => {
    clearInterval(client.keepAlive);
    sseClients.delete(client);
  });

//  console.log('Client connected via SSE');
  writeEvent(res, 'init', {
    apiCalls,
    excludedPatterns: getExcludedPatterns(),
    logcat: logcatLines
  });
}

function handleClearLogs(res) {
  const beforeCount = apiCalls.length;
  apiCalls = [];

  // If using safe log file, clear it too
  if (useMitmSource && safeLogFile) {
    try {
      fs.writeFileSync(safeLogFile, '');
      console.log(`✓ Cleared safe log file: ${safeLogFile}`);
    } catch (err) {
      console.error('Failed to clear safe log file:', err);
      sendJson(res, 500, { error: 'Failed to clear log file' });
      return;
    }
  }

  broadcast('logsCleared', null);
  console.log(`✓ API logs cleared by client (removed ${beforeCount} logs)`);
  sendJson(res, 200, { ok: true, cleared: beforeCount });
}

async function handlePatternCommand(req, res, action) {
  try {
    const body = await readJsonBody(req);
    const trimmed = (body.pattern || '').trim();
    if (!trimmed) {
      return sendJson(res, 400, { error: 'Pattern is required' });
    }

    if (action === 'exclude') {
      if (excludedPatternsSet.has(trimmed)) {
        return sendJson(res, 200, { ok: true });
      }
      excludedPatternsSet.add(trimmed);
      console.log(`Added exclusion pattern from UI: ${trimmed}`);
    } else {
      if (!excludedPatternsSet.has(trimmed)) {
        return sendJson(res, 200, { ok: true });
      }
      excludedPatternsSet.delete(trimmed);
      console.log(`Removed exclusion pattern from UI: ${trimmed}`);
    }

    broadcast('excludedPatternsUpdated', getExcludedPatterns());
    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('Pattern handling error:', err);
    sendJson(res, 400, { error: 'Invalid JSON body' });
  }
}

function serveStaticFile(pathname, res) {
  let normalized = pathname === '/' ? '/index.html' : pathname;
  try {
    normalized = decodeURIComponent(normalized);
  } catch (_) {
    normalized = pathname;
  }
  const safePath = path.normalize(normalized).replace(/^\\+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload || {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function getFilteredLogcatLines() {
  // No filtering needed - adb logcat already filters by PID at the source
  return logcatLines;
}

function getThirdPartyPackages() {
  try {
    // Use -3 flag to list third-party (user-installed) apps
    const out = spawnSyncSafe('adb', ['shell', 'pm', 'list', 'packages', '-3']);
    // Output format: "package:com.example.app"
    return out
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('package:'))
      .map(line => line.replace('package:', ''));
  } catch (err) {
    console.warn('Failed to list third-party packages:', err);
    return [];
  }
}

function findCertPath() {
  const candidates = [];

  if (process.env.TRACER_CERT_PATH) {
    candidates.push(process.env.TRACER_CERT_PATH);
  }

  if (typeof process.resourcesPath === 'string') {
    candidates.push(path.join(process.resourcesPath, 'mitmproxy-ca-cert.cer'));
  }

  candidates.push(path.join(__dirname, '..', '..', '..', 'build', 'mitmproxy-ca-cert.cer'));
  candidates.push(path.join(os.homedir(), '.mitmproxy', 'mitmproxy-ca-cert.cer'));

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}


function ensureCertOnDevice(deviceId, certPath, remoteName) {
  const remotePath = `/sdcard/Download/${remoteName}`;

  const existsCheck = spawnSync(ADB_BIN, ['-s', deviceId, 'shell', 'test', '-f', remotePath]);
  if (!existsCheck.error && existsCheck.status === 0) {
    return { alreadyPresent: true, pushed: false, remotePath, certPath };
  }

  const pushResult = spawnSync(ADB_BIN, ['-s', deviceId, 'push', certPath, remotePath], { encoding: 'utf-8' });
  if (pushResult.error) {
    throw new Error(`adb push failed for ${remoteName}: ${pushResult.error.message}`);
  }
  if (pushResult.status !== 0) {
    const stderr = (pushResult.stderr || '').trim();
    const stdout = (pushResult.stdout || '').trim();
    throw new Error(stderr || stdout || `adb push failed for ${remoteName}`);
  }

  return { alreadyPresent: false, pushed: true, remotePath, certPath };
}

function pushCertToDevice() {
  const certPath = findCertPath();
  if (!certPath) {
    throw new Error('Certificate file not found. Build should bundle mitmproxy-ca-cert.cer.');
  }

  if (!ADB_BIN) {
    throw new Error('adb not found on PATH. Install platform-tools or add adb to PATH.');
  }

  const { deviceId } = getConnectedDeviceInfo(true);

  if (!deviceId) {
    throw new Error('No connected device detected. Plug in a device and enable USB debugging.');
  }

  const mitmResult = ensureCertOnDevice(deviceId, certPath, 'mitmproxy-ca-cert.cer');

  return {
    certPath,
    deviceId,
    deviceName,
    result: mitmResult
  };
}

function getConnectedDeviceInfo(throwOnError = false) {
  try {
    const status = getAdbStatus();
    if (status.deviceId) {
      return { deviceId: status.deviceId, deviceName: status.deviceName, devices: status.devices || [] };
    }
    if (throwOnError) throw new Error(status.error || 'No connected device');
    return { deviceId: null, deviceName: null, devices: status.devices || [] };
  } catch (err) {
    console.warn('getConnectedDeviceInfo failed:', err);
    if (throwOnError) throw err;
    return { deviceId: null, deviceName: null, error: err.message, devices: [] };
  }
}

function listAllPids() {
  try {
    const thirdPartyPackages = getThirdPartyPackages();
    const thirdPartySet = new Set(thirdPartyPackages);

    const out = spawnSyncSafe('adb', ['shell', 'ps', '-A', '-o', 'PID,NAME']);
    return out
      .split('\n')
      .slice(1)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/\s+/, 2);
        const name = parts[1] || '';
        return {
          pid: parts[0],
          name,
          debuggable: thirdPartySet.has(name) // Now means "third-party app"
        };
      });
  } catch (err) {
    console.warn('Failed to list pids:', err);
    return [];
  }
}


function spawnSyncSafe(bin, args) {
  try {
    const { spawnSync } = require('child_process');
    const res = spawnSync(bin, args, { encoding: 'utf-8' });
    if (res.error) throw res.error;
    return res.stdout;
  } catch (err) {
    console.warn(`spawnSyncSafe failed for ${bin} ${args.join(' ')}`, err);
    return '';
  }
}


function extractPid(line) {
  // Format 1: "[YYYY-]MM-DD HH:MM:SS.mmm PRIORITY/TAG(PID):" or "PRIORITY/TAG (PID):"
  // No space before parenthesis: I/ApiLogger(7450):
  let m = line.match(/^(?:\d{4}-)?\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+[VDIWEF]\/[^\s(]+\(\s*(\d+)\)/);
  if (m && m[1]) return m[1];

  // Format 2: "[YYYY-]MM-DD HH:MM:SS.mmm PID TID PRIORITY ..." (threadtime format)
  m = line.match(/^(?:\d{4}-)?\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+(\d+)\s+\d+\s+[VDIWEF]\b/);
  if (m && m[1]) return m[1];

  // Fallback: look for PID in parentheses anywhere after timestamp
  m = line.match(/^(?:\d{4}-)?\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+.*?\(\s*(\d+)\)/);
  if (m && m[1]) return m[1];

  return null;
}


function restartAdb(pid = null, level = 'all') {
  if (!ADB_BIN) {
    console.warn('adb not found on PATH; logcat streaming disabled. Install Android platform-tools or add adb to PATH.');
    return;
  }

  const adbStatus = getAdbStatus();
  if (!adbStatus.deviceId) {
    console.warn('No connected device detected; logcat streaming skipped.');
    return;
  }

  // Kill existing logcat process
  if (logcatProcess) {
    const wasFiltered = currentPidFilter ? `PID ${currentPidFilter}` : 'all processes';
    const wasLevel = currentLogLevel !== 'all' ? `, level ${currentLogLevel}` : '';
    console.log(`Stopping existing logcat stream (was filtering: ${wasFiltered}${wasLevel})...`);
    logcatProcess.removeAllListeners(); // Prevent auto-restart
    logcatProcess.kill();
    logcatProcess = null;
  }

  // Clear the buffer since we're switching context
  logcatLines = [];
  broadcast('logcatCleared', null);

  // Update current filters
  currentPidFilter = pid;
  currentLogLevel = level;

  // Build adb logcat arguments
  const args = ['logcat', '-v', 'threadtime'];
  if (pid) {
    args.push('--pid=' + pid);
  }

  // Map log level to adb format
  // all -> no filter, verbose -> *:V, debug -> *:D, info -> *:I, warn -> *:W, error -> *:E
  if (level && level !== 'all') {
    const levelMap = {
      'verbose': 'V',
      'debug': 'D',
      'info': 'I',
      'warn': 'W',
      'error': 'E'
    };
    const adbLevel = levelMap[level.toLowerCase()];
    if (adbLevel) {
      args.push(`*:${adbLevel}`);
    }
  }

  const pidInfo = pid ? `PID ${pid}` : 'all processes';
  const levelInfo = level !== 'all' ? `, level ${level}+` : '';
  console.log(`Starting adb logcat (${pidInfo}${levelInfo})...`);

  try {
    logcatProcess = spawn(ADB_BIN, args);
  } catch (err) {
    console.error('Failed to spawn adb. Is adb installed and on PATH?', err);
    return;
  }

  logcatProcess.on('error', (err) => {
    console.error('adb process error. Is adb installed and on PATH?', err);
  });
  let buffer = '';

  const handleChunk = (chunk) => {
    buffer += chunk.toString();
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';
    const newLines = parts.filter(line => line.trim().length > 0);
    if (newLines.length === 0) return;

    logcatLines.push(...newLines);
    if (logcatLines.length > LOGCAT_MAX_LINES) {
      logcatLines = logcatLines.slice(-LOGCAT_MAX_LINES);
    }

    // Broadcast new lines (already filtered by adb --pid)
    broadcast('logcatUpdate', { lines: newLines });
  };

  logcatProcess.stdout.on('data', handleChunk);
  logcatProcess.stderr.on('data', (data) => {
    console.error('Logcat stderr:', data.toString());
  });

  logcatProcess.on('close', (code) => {
    console.warn(`Logcat process exited with code ${code}`);
    logcatProcess = null;
    // Auto-restart with the same PID and level filters
    setTimeout(() => {
      console.log('Restarting logcat stream...');
      restartAdb(currentPidFilter, currentLogLevel);
    }, 1000);
  });

  logcatProcess.on('error', (err) => {
    console.error('Failed to start logcat process:', err);
    logcatProcess = null;
  });

  process.on('SIGINT', () => {
    if (logcatProcess) {
      logcatProcess.kill();
      logcatProcess = null;
    }
    process.exit(0);
  });
}

// Use mitmproxy parser
const networkParser = createMitmParser({ safeLogFile, shouldExclude, enqueueCall, formatTimestamp });

if (!process.env.TRACER_TEST) {
  networkParser.start();
  process.once('exit', () => networkParser.stop());
  process.once('SIGINT', () => {
    networkParser.stop();
    process.exit(0);
  });

  // Start logcat stream for UI log view (works for both safe and adb modes)
  restartAdb(); // Start without PID filter initially
}


let PORT = 3000;

const HOSTS = ['::', '127.0.0.1'];

function startServer(port, hostIndex = 0) {
  const host = HOSTS[hostIndex];
  const displayHost = host === '::' ? 'localhost' : host;
  server.removeAllListeners('error');

  server.listen(port, host, () => {
    const serverUrl = `http://${displayHost}:${port}`;
    console.log(`✓ Server running at ${serverUrl}`);
    const sourceLabel = useMitmSource ? 'mitmproxy log' : 'adb logcat';
    console.log(`✓ Listening to ${sourceLabel}...`);
    console.log(`\n📱 Open your browser and navigate to: ${serverUrl}\n`);
  });

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠ Port ${port} is already in use, trying port ${port + 1}...`);
      startServer(port + 1, hostIndex);
      return;
    }

    if (err.code === 'EPERM' && hostIndex + 1 < HOSTS.length) {
      const nextHost = HOSTS[hostIndex + 1];
      console.log(`⚠ Binding to ${displayHost} was blocked, trying ${nextHost}...`);
      startServer(port, hostIndex + 1);
      return;
    }

    console.error('Server error:', err);
    process.exit(1);
  });
}

function openBrowser(targetUrl) {
  const platform = os.platform();
  let command;
  let args = [];
  if (platform === 'darwin') {
    command = 'open';
    args = [targetUrl];
  } else if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', targetUrl];
  } else {
    command = 'xdg-open';
    args = [targetUrl];
  }

  const opener = spawn(command, args, { stdio: 'ignore', detached: true });
  opener.on('error', (err) => {
    console.error('Unable to open browser:', err);
  });
  opener.unref();
}

if (!process.env.TRACER_TEST) {
  startServer(PORT);
} else {
  module.exports = {
    parseLineForTest: apiLogParser.parseLine,
    resetParserState: () => {
      apiCalls = [];
      apiLogParser.resetState();
    },
    getApiCalls: () => apiCalls
  };
}
