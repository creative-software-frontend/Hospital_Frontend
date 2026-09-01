import { createServer, type Server } from "node:http";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { config } from "./config";

function start(): Server {
  const app = createApp();
  const server = createServer(app);

  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Hospital Management API listening on port ${config.port} (${config.env})`);
  });

  return server;
}

async function shutdown(server: Server, signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n[server] ${signal} received, shutting down gracefully...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  // Force exit if connections don't close within 10s.
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error("[server] Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

const server = start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdown(server, signal));
}
