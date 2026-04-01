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
    const p = spawnCommand(cmd, args, env);
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function spawnCommand(cmd, args, env) {
  if (process.platform !== "win32") {
    return spawn(cmd, args, { stdio: "inherit", env });
  }

  const shell = process.env.ComSpec ?? "cmd.exe";
  const commandLine = [cmd, ...args].map(escapeForCmd).join(" ");
  return spawn(shell, ["/d", "/s", "/c", commandLine], { stdio: "inherit", env });
}

function escapeForCmd(arg) {
  const text = String(arg);
  if (text.length === 0) return '""';
  if (!/[\s"&<>|^%]/.test(text)) return text;
  return `"${text.replace(/[%"]/g, (m) => (m === "%" ? "%%" : '\\"'))}"`;
}
