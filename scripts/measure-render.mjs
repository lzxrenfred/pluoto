// Measures render cost of a static build in headless Chrome: draw calls, triangles and frames per second,
// plus main-thread and total Chrome CPU, for a seeded four-land world in local (no Supabase) mode.
//   npm run build && npx serve out -l 4173 &
//   node scripts/measure-render.mjs http://127.0.0.1:4173/
// Env: CHROME (binary path), MEASURE_SECONDS (window per scenario, default 10).
import { spawn, execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const base = process.argv[2] ?? "http://127.0.0.1:4173/";
const seconds = Number(process.env.MEASURE_SECONDS ?? 10);
const profile = mkdtempSync(join(tmpdir(), "pluoto-measure-"));
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--remote-debugging-port=9333", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
  "--window-size=1512,982", "--force-device-scale-factor=2", "--use-angle=metal", "--ignore-gpu-blocklist", "about:blank",
], { stdio: "ignore" });

let targets = [];
for (let attempt = 0; attempt < 50 && !targets.length; attempt++) {
  try { targets = (await (await fetch("http://127.0.0.1:9333/json/list")).json()).filter((target) => target.type === "page"); } catch {}
  await sleep(200);
}
const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); pending.get(message.id)?.(message); pending.delete(message.id); });
const send = (method, params = {}) => new Promise((resolve) => { const id = ++sequence; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails).slice(0, 300));
  return reply.result?.result?.value;
};
const chromeCpuSeconds = () => execSync(`ps -axo time=,command= | grep -F -- '${profile}' | grep -v grep || true`).toString().trim().split("\n").filter(Boolean)
  .reduce((total, line) => total + line.trim().split(/\s+/)[0].split(":").map(Number).reduce((sum, part) => sum * 60 + part, 0), 0);
const metrics = async () => Object.fromEntries((await send("Performance.getMetrics")).result.metrics.map((metric) => [metric.name, metric.value]));

// Four friends' lands, as in the original demo, stored the way the local account and friend stores expect.
const seed = `(() => {
  const id = () => crypto.randomUUID(), now = Date.now(), ids = { ren: id(), sarah: id(), maya: id(), wei: id() };
  const people = {
    ren: { nickname: "Ren", species: "fox", color: "#e8794d", accent: "#fff2df", accessory: "scarf", ground: "grass", home: "cottage", owner: true },
    sarah: { nickname: "Sarah", species: "rabbit", color: "#f7eee5", accent: "#f0a3a3", accessory: "tote", ground: "stone", home: "studio", bubble: "coffee later?", bubbleCreatedAt: now },
    maya: { nickname: "Maya", species: "cat", color: "#d9a16f", accent: "#fff5df", accessory: "glasses", ground: "grass", home: "cottage" },
    wei: { nickname: "Wei", species: "turtle", color: "#79a875", accent: "#dde7b8", accessory: "headphones", ground: "earth", home: "kiosk", bubble: "coding…", bubbleCreatedAt: now },
  };
  const spots = { ren: [0, 0], sarah: [1, 0], maya: [0, 1], wei: [1, 1] }, accounts = {}, invites = {};
  Object.entries(people).forEach(([key, person], index) => {
    accounts[key + "@example.test"] = { userId: ids[key], email: key + "@example.test", person: { ...person, id: ids[key], plotX: 0, plotY: 0, scene: key, pills: [] },
      arrangement: key === "ren" ? Object.keys(people).map((name) => ({ personId: ids[name], plotX: spots[name][0], plotY: spots[name][1] })) : [{ personId: ids[key], plotX: 0, plotY: 0 }] };
    invites[ids[key]] = { userId: ids[key], code: "TEST-000" + index, token: id(), expiresAt: now + 864e5, revoked: false };
  });
  const friends = ["sarah", "maya", "wei"];
  localStorage.setItem("pluoto-accounts-v1", JSON.stringify(accounts));
  localStorage.setItem("pluoto-social-v1", JSON.stringify({ invites, revokedInvites: [], requests: [], blocks: [],
    friendships: friends.map((key) => [ids.ren, ids[key]].sort().join(":")),
    placements: Object.fromEntries(friends.map((key) => [ids.ren + ":" + ids[key], { plotX: spots[key][0], plotY: spots[key][1], hidden: false }])) }));
  sessionStorage.setItem("pluoto-account-session-v1", "ren@example.test");
})()`;

// Counts draws, triangles and frames (clears of the visible canvas) without forcing extra frames.
const probe = `(() => {
  if (window.__probe) return;
  const stats = window.__probe = { draws: 0, triangles: 0, frames: 0 };
  const count = (args, mode, vertices, instances) => { stats.draws++; if (args[mode] === 4) stats.triangles += args[vertices] / 3 * (instances === undefined ? 1 : args[instances]) || 0; };
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const wrap = (name, ...layout) => { const original = proto[name]; if (original) proto[name] = function (...args) { count(args, ...layout); return original.apply(this, args); }; };
    wrap("drawElements", 0, 1); wrap("drawArrays", 0, 2); wrap("drawElementsInstanced", 0, 1, 4); wrap("drawArraysInstanced", 0, 2, 3);
    const bind = proto.bindFramebuffer, clear = proto.clear;
    proto.bindFramebuffer = function (target, framebuffer) { if (target === 0x8D40 || target === 0x8CA9) this.__offscreen = Boolean(framebuffer); return bind.call(this, target, framebuffer); };
    proto.clear = function (...args) { if (!this.__offscreen) stats.frames++; return clear.apply(this, args); };
  }
})()`;

async function measure(label) {
  await evaluate(probe);
  await sleep(1500);
  const read = async () => [await evaluate("({ ...window.__probe })"), await metrics(), chromeCpuSeconds()];
  const [before, metricsBefore, cpuBefore] = await read();
  await sleep(seconds * 1000);
  const [after, metricsAfter, cpuAfter] = await read();
  const perSecond = (key) => (after[key] - before[key]) / seconds;
  const frames = perSecond("frames");
  const row = {
    scenario: label,
    "frames/s": +frames.toFixed(1),
    "draws/frame": frames ? Math.round(perSecond("draws") / frames) : 0,
    "triangles/frame": frames ? Math.round(perSecond("triangles") / frames) : 0,
    "main thread %": +((metricsAfter.TaskDuration - metricsBefore.TaskDuration) / seconds * 100).toFixed(1),
    "Chrome CPU %": Math.round((cpuAfter - cpuBefore) / seconds * 100),
  };
  console.log(JSON.stringify(row));
  return row;
}
const click = (selector, text) => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find((element) => element.textContent.trim().startsWith(${JSON.stringify(text)})).click()`);

await send("Page.enable"); await send("Performance.enable");
await send("Page.navigate", { url: base }); await sleep(2500);
await evaluate(seed);
await send("Page.reload"); await sleep(7000);
const rows = [await measure("home world, idle")];
await click(".action-dock button", "Friends"); await sleep(800); await click(".friend-tabs button", "Friends"); await sleep(2500);
rows.push(await measure("friends sheet (3 friends)"));
await click(".sheet-close", ""); await sleep(600); await click(".settings-button", ""); await sleep(400); await click(".profile-popover button", "Edit objects"); await sleep(2500);
rows.push(await measure("land editor open"));
console.table(rows);
socket.close(); chrome.kill();
