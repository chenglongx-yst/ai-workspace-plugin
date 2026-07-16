/**
 * Long-running wrapper owned by AI-Workspace's SidecarSupervisor.
 * It keeps the Python server attached to the host-managed process tree.
 */
const { spawn } = require('child_process');
const path = require('path');
const { EXTENSION_NAME, readServerConfig, resolvePythonExecutable } = require('./runtime');

const extensionDir = process.env.AIW_EXTENSION_ROOT || path.resolve(__dirname, '..');
const config = readServerConfig(extensionDir);
const python = resolvePythonExecutable(extensionDir);
const serverDir = path.join(extensionDir, 'server');

const child = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', config.host, '--port', String(config.port)], {
  cwd: serverDir,
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    PYTHONUNBUFFERED: '1',
  },
});

child.once('error', (error) => {
  console.error(`[${EXTENSION_NAME}] Failed to start Python Sidecar`, error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  console.log(`[${EXTENSION_NAME}] Python Sidecar exited code=${String(code)} signal=${String(signal)}`);
  process.exit(code ?? 1);
});
