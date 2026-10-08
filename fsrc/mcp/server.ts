#!/usr/bin/env node
import { buildServer } from './registry';

const server = buildServer();
const port = Number(process.env.MCP_PORT ?? 8080);

server
  .start({
  transportType: "httpStream",
  httpStream: {
    port,
  },
})
  .then(() => {
    console.log(`[mcp]  listening on http://127.0.0.1:${port}/mcp`);
  })
  .catch((err) => {
    console.error('[mcp] fatal:', err);
    process.exit(1);
  });