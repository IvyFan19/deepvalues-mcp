// Drives the built server over stdio: initialize, tools/list, one free tool call.
import { spawn } from "node:child_process";
const p = spawn("node", ["dist/index.js"], { stdio: ["pipe", "pipe", "inherit"] });
const send = (m) => p.stdin.write(JSON.stringify(m) + "\n");
let buf = ""; const seen = [];
p.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) seen.push(JSON.parse(line)); } });
send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "pricing", arguments: {} } });
setTimeout(() => {
  const tools = seen.find((m) => m.id === 2)?.result?.tools ?? [];
  const call = seen.find((m) => m.id === 3)?.result;
  console.log(`initialize: ${seen.some((m) => m.id === 1) ? "ok" : "MISSING"}; tools: ${tools.length}; pricing call: ${call ? (call.isError ? "error" : "ok") : "MISSING"}`);
  if (call?.content?.[0]?.text) console.log(String(call.content[0].text).slice(0, 160));
  p.kill(); process.exit(tools.length > 10 && call && !call.isError ? 0 : 1);
}, 8000);
