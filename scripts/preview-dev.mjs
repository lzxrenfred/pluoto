import { spawn } from "node:child_process";

const forwarded = [];
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--strictPort") continue;
  forwarded.push(argument === "--host" ? "--hostname" : argument);
}

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...forwarded],
  { stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
