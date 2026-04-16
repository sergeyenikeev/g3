import { spawn } from "node:child_process";

const steps = [
  ["npm", ["run", "audit:ui"]],
  ["npm", ["run", "audit:yandex"]],
  ["npm", ["run", "package:yandex"]],
];

for (const [cmd, args] of steps) {
  console.log(`handoff:yandex -> ${cmd} ${args.join(" ")}`);
  await run(cmd, args);
}

console.log("handoff:yandex: OK");

function run(cmd, args, env = process.env, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(cmd, args, env, cwd);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function spawnCommand(cmd, args, env, cwd) {
  if (process.platform !== "win32") {
    return spawn(cmd, args, { stdio: "inherit", env, cwd });
  }

  const shell = process.env.ComSpec ?? "cmd.exe";
  const commandLine = [cmd, ...args].map(escapeForCmd).join(" ");
  return spawn(shell, ["/d", "/s", "/c", commandLine], { stdio: "inherit", env, cwd });
}

function escapeForCmd(arg) {
  const text = String(arg);
  if (text.length === 0) return '""';
  if (!/[\s"&<>|^%]/.test(text)) return text;
  return `"${text.replace(/[%"]/g, (m) => (m === "%" ? "%%" : '\\"'))}"`;
}
