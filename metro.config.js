const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Local exports, screenshots and native-build backups are not app sources.
// Avoid crawling thousands of generated files on Windows during every bundle.
const projectPath = __dirname
  .replace(/\\/g, "/")
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  .replace(/\//g, "[/\\\\]");
const existingBlockList = config.resolver.blockList ?? [];
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : [existingBlockList]),
  new RegExp(`^${projectPath}[/\\\\](?:artifacts|dist|playwright-report)(?:[/\\\\]|$)`),
  /^(?:artifacts|dist|playwright-report)(?:[/\\]|$)/,
];

module.exports = config;
