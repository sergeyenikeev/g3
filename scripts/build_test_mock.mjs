import { spawn } from "node:child_process";

await run("npm", ["run", "bom-check"]);
await run("npm", ["run", "lint"]);
await run("npm", ["run", "typecheck"]);
await run("npm", ["run", "test:unit"]);
await run("npm", ["run", "test:integration"]);
await run("npm", ["run", "test:e2e"]);

await run(
  "npx",
  ["vite", "build", "--outDir", "dist-mock"],
  {
    ...process.env,
    VITE_PLATFORM_ADAPTER: "mock",
  }
);

console.log("build_test_mock: OK");

function run(cmd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env });
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

