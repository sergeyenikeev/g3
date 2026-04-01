import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");

const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const preferredPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const port = await findAvailablePort(host, preferredPort, preferredPort + 50);
const baseURL = `http://${host}:${port}`;

console.log(`test:e2e using ${baseURL}`);
await run(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
  ...process.env,
  PLAYWRIGHT_HOST: host,
  PLAYWRIGHT_PORT: String(port),
  PLAYWRIGHT_BASE_URL: baseURL,
});

async function findAvailablePort(hostname, startPort, endPort) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await canListen(hostname, port)) {
      return port;
    }
  }

  throw new Error(`No free port found in range ${startPort}-${endPort}`);
}

function canListen(hostname, port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();

    server.once("error", () => {
      resolve(false);
    });

    server.listen({ host: hostname, port }, () => {
      server.close(() => resolve(true));
    });
  });
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}
