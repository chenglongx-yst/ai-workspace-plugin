/**
 * First-time install: create venv and install Python dependencies.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EXTENSION_NAME, resolvePythonExecutable } = require('./runtime');

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
  if (result.stdout?.trim()) {
    console.log(result.stdout.trim());
  }
  if (result.stderr?.trim()) {
    console.error(result.stderr.trim());
  }
  if (result.status !== 0) {
    const details = result.stderr?.trim() || result.stdout?.trim() || 'no output';
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status ?? 'unknown'}: ${details}`);
  }
}

module.exports = async function onInstall(context) {
  const serverDir = path.join(context.extensionDir, 'server');
  const venvDir = path.join(serverDir, '.venv');
  const bootstrapPython = process.env.AIW_PYTHON_PATH || process.env.AIW_PYTHON3_PATH;
  if (!bootstrapPython || !fs.existsSync(bootstrapPython)) {
    throw new Error('AI-Workspace bundled Python is unavailable');
  }

  console.log(`[${EXTENSION_NAME}] Installing Python dependencies in ${serverDir}`);

  if (!fs.existsSync(venvDir)) {
    run(bootstrapPython, ['-m', 'venv', '.venv'], serverDir);
  }

  const python = resolvePythonExecutable(context.extensionDir);
  run(
    python,
    ['-m', 'pip', 'install', '--disable-pip-version-check', '--default-timeout=120', '-r', 'requirements.txt'],
    serverDir
  );

  console.log(`[${EXTENSION_NAME}] Python environment ready (${python})`);
};
