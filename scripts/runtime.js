/**
 * Shared runtime helpers for the Python plugin demo lifecycle hooks.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const EXTENSION_NAME = 'third-party-integration-demo-python';

function readServerConfig(extensionDir) {
  const configPath = path.join(extensionDir, 'config', 'server.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  const host = typeof parsed.host === 'string' && parsed.host.trim() ? parsed.host.trim() : '127.0.0.1';
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port in ${configPath}`);
  }
  return { host, port };
}

function runtimeDir(extensionDir) {
  return path.join(extensionDir, '.runtime');
}

function runtimeStatePath(extensionDir) {
  return path.join(runtimeDir(extensionDir), 'server.json');
}

function readRuntimeState(extensionDir) {
  const statePath = runtimeStatePath(extensionDir);
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeRuntimeState(extensionDir, state) {
  const dir = runtimeDir(extensionDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(runtimeStatePath(extensionDir), JSON.stringify(state, null, 2));
}

function clearRuntimeState(extensionDir) {
  const statePath = runtimeStatePath(extensionDir);
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

function resolvePythonExecutable(extensionDir) {
  const isWindows = process.platform === 'win32';
  const venvPython = isWindows
    ? path.join(extensionDir, 'server', '.venv', 'Scripts', 'python.exe')
    : path.join(extensionDir, 'server', '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) return venvPython;
  const bundledPython = process.env.AIW_PYTHON_PATH || process.env.AIW_PYTHON3_PATH;
  if (bundledPython && fs.existsSync(bundledPython)) return bundledPython;
  throw new Error('Bundled Python is unavailable and the extension virtual environment does not exist');
}

function baseUrl(config) {
  return `http://${config.host}:${config.port}`;
}

function waitForHealth(config, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const url = `${baseUrl(config)}/api/health`;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
          return;
        }
        schedule();
      });
      req.on('error', schedule);
      req.setTimeout(1500, () => {
        req.destroy();
        schedule();
      });
    };

    const schedule = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`Python server health check timed out: ${url}`));
        return;
      }
      setTimeout(attempt, 400);
    };

    attempt();
  });
}

function isProcessAlive(pid) {
  if (!pid || !Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopProcess(pid) {
  if (!pid || !Number.isInteger(pid)) return;
  try {
    if (process.platform === 'win32') {
      require('child_process').spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      process.kill(pid, 'SIGTERM');
    }
  } catch (error) {
    console.warn(`[${EXTENSION_NAME}] Failed to stop pid ${pid}:`, error);
  }
}

module.exports = {
  EXTENSION_NAME,
  baseUrl,
  clearRuntimeState,
  isProcessAlive,
  readRuntimeState,
  readServerConfig,
  resolvePythonExecutable,
  stopProcess,
  waitForHealth,
  writeRuntimeState,
};
