import { AGENT_HTTP_HOST, AGENT_HTTP_PORT } from '@synccaster/agent-protocol';
import { startHttpServer } from './http-server.js';
import { NativeMessagingSession } from './native-messaging-session.js';

function log(message: string, details?: unknown) {
  const suffix = details === undefined ? '' : ` ${JSON.stringify(details)}`;
  process.stderr.write(`[synccaster-agent-bridge] ${message}${suffix}\n`);
}

function closeServer(server: import('node:http').Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const session = new NativeMessagingSession();
  session.start();

  const server = await startHttpServer({
    request: async (action, payload) => session.request(action, payload),
  });

  log(`HTTP bridge listening on http://${AGENT_HTTP_HOST}:${AGENT_HTTP_PORT}`);

  let shuttingDown = false;
  const shutdown = async (reason: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Shutting down: ${reason}`);

    try {
      await closeServer(server);
    } catch (error) {
      log('Failed to close HTTP bridge cleanly', {
        error: error instanceof Error ? error.message : String(error),
      });
      exitCode = 1;
    }

    process.exit(exitCode);
  };

  session.onDisconnect(() => {
    void shutdown('extension disconnected');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((error) => {
  log('Native host failed to start', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
