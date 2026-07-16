/** Run extension cleanup before the host stops the managed Sidecar process tree. */
const { EXTENSION_NAME } = require('./runtime');

module.exports = async function onDeactivate(context) {
  console.log(`[${EXTENSION_NAME}] Preparing to stop Sidecar (data=${context.extensionDataDir})`);
};
