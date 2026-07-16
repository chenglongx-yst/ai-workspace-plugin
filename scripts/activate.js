/** Prepare extension state before the host starts the declarative Sidecar. */
const fs = require('fs');
const path = require('path');
const { EXTENSION_NAME, readServerConfig, resolvePythonExecutable } = require('./runtime');

module.exports = async function onActivate(context) {
  const config = readServerConfig(context.extensionDir);
  const serverDir = path.join(context.extensionDir, 'server');
  const python = resolvePythonExecutable(context.extensionDir);
  if (!fs.existsSync(path.join(serverDir, 'requirements.txt'))) {
    throw new Error(`Missing server/requirements.txt in ${serverDir}`);
  }
  console.log(
    `[${EXTENSION_NAME}] Sidecar prepared (${python}, http://${config.host}:${config.port}, data=${context.extensionDataDir})`
  );
};
