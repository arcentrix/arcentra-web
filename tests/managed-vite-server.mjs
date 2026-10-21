/** Strict harness child: preserve Vite config/env/proxy behavior, attest the actual listener over owned IPC. */
import assert from "node:assert/strict";
assert.ok(
  process.connected && typeof process.send === "function",
  "Owned harness IPC required",
);
assert.equal(process.argv.length, 4);
const host = process.argv[2],
  rawPort = process.argv[3];
assert.equal(host, "127.0.0.1");
assert.match(rawPort, /^[1-9][0-9]{0,4}$/);
const port = Number(rawPort);
assert.ok(port <= 65535);
let server;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  try {
    await server?.close();
  } finally {
    process.exit(0);
  }
}
process.once("SIGTERM", close);
process.once("SIGINT", close);
process.once("disconnect", close);
try {
  const { createServer } = await import("vite");
  server = await createServer({ server: { host, port, strictPort: true } });
  await server.listen();
  const address = server.httpServer?.address();
  assert.ok(
    server.httpServer?.listening === true &&
      address &&
      typeof address === "object" &&
      address.address === host &&
      address.port === port,
  );
  assert.ok(process.connected);
  process.send({
    type: "arcentra-vite-listening-v1",
    pid: process.pid,
    host: address.address,
    port: address.port,
  });
  server.printUrls();
} catch {
  // Never echo configuration, environment, backend addresses or startup error text.
  process.stderr.write("Managed Vite startup failed\n");
  try {
    await server?.close();
  } catch {}
  process.exit(1);
}
