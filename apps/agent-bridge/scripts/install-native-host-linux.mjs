#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST_NAME = 'org.synccaster.bridge';

function parseArgs(argv) {
  const args = {
    extensionId: process.env.SYNCCASTER_EXTENSION_ID || '',
    browser: 'both',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--extension-id' && argv[index + 1]) {
      args.extensionId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--extension-id=')) {
      args.extensionId = token.slice('--extension-id='.length);
      continue;
    }
    if (token === '--browser' && argv[index + 1]) {
      args.browser = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--browser=')) {
      args.browser = token.slice('--browser='.length);
      continue;
    }
  }

  return args;
}

function printUsageAndExit() {
  console.error(
    'Usage: node ./scripts/install-native-host-linux.mjs --extension-id <chrome-extension-id> [--browser chrome|chromium|both]'
  );
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (!args.extensionId) {
  printUsageAndExit();
}

if (!['chrome', 'chromium', 'both'].includes(args.browser)) {
  console.error(`Unsupported browser target: ${args.browser}`);
  printUsageAndExit();
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..');
const distEntry = resolve(appDir, 'dist/native-host.js');

if (!existsSync(distEntry)) {
  console.error(`Missing build artifact: ${distEntry}`);
  console.error('Run: pnpm --filter @synccaster/agent-bridge build');
  process.exit(1);
}

const launcherDir = resolve(appDir, '.native-host');
mkdirSync(launcherDir, { recursive: true });

const launcherPath = resolve(launcherDir, `${HOST_NAME}.sh`);
const launcherContent = `#!/usr/bin/env bash
set -euo pipefail
exec "${process.execPath}" "${distEntry}"
`;

writeFileSync(launcherPath, launcherContent, 'utf8');
chmodSync(launcherPath, 0o755);

const browserManifestDirs = {
  chrome: resolve(homedir(), '.config/google-chrome/NativeMessagingHosts'),
  chromium: resolve(homedir(), '.config/chromium/NativeMessagingHosts'),
};

const selectedBrowsers = args.browser === 'both'
  ? ['chrome', 'chromium']
  : [args.browser];

for (const browser of selectedBrowsers) {
  const manifestDir = browserManifestDirs[browser];
  mkdirSync(manifestDir, { recursive: true });

  const manifestPath = resolve(manifestDir, `${HOST_NAME}.json`);
  const manifest = {
    name: HOST_NAME,
    description: 'SyncCaster local agent bridge',
    path: launcherPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${args.extensionId}/`],
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Installed ${HOST_NAME} manifest for ${browser}: ${manifestPath}`);
}

console.log(`Launcher written to: ${launcherPath}`);
