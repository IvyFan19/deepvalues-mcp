#!/usr/bin/env node
/**
 * deepvalues-mcp: a stdio MCP server that fronts the hosted DeepValues MCP
 * endpoint (https://app.deepvalues.ai/api/mcp).
 *
 * Why a proxy and not a reimplementation: the hosted server is the source of
 * truth for the tool list, the prices and the payment flow (402 with a Stripe
 * link or an x402 quote). This binary only exists so hosts that speak stdio
 * and nothing else (Claude Desktop, Cursor, Zed, many SDK examples) can use it:
 *
 *   npx deepvalues-mcp                     # keyless: 25 calls a day per IP
 *   DEEPVALUES_API_KEY=dv_sk_live_… npx deepvalues-mcp
 *
 * Mint a key with no account: POST https://app.deepvalues.ai/api/v1/keys
 * {"email":"you@example.com"}. See https://app.deepvalues.ai/llms.txt.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

const UPSTREAM = (process.env.DEEPVALUES_MCP_URL || "https://app.deepvalues.ai/api/mcp").replace(/\/$/, "");
const API_KEY = process.env.DEEPVALUES_API_KEY?.trim() || "";
const PROTOCOL_VERSION = "2025-06-18";
const VERSION = "0.1.0";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let nextId = 1;

/** One JSON-RPC call to the hosted server, with the headers it mirrors. */
async function upstream(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
  const id = nextId++;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    "Mcp-Method": method,
    "User-Agent": `deepvalues-mcp/${VERSION}`,
  };
  if (method === "tools/call" && typeof params?.name === "string") headers["Mcp-Name"] = params.name;
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const res = await fetch(UPSTREAM, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} }),
  });
  const text = await res.text();
  // The endpoint answers JSON; an SSE body (one `data:` line) is unwrapped.
  const json = text.startsWith("event:") || text.startsWith("data:")
    ? text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("")
    : text;
  try {
    return JSON.parse(json) as JsonRpcResponse;
  } catch {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: `upstream ${res.status}: ${text.slice(0, 300)}` } };
  }
}

const server = new Server(
  { name: "deepvalues", version: VERSION },
  { capabilities: { tools: {} }, instructions:
      "DeepValues: grounded value-investing data for US public companies. Start with ai_context for " +
      "everything about one company; intrinsic_value for fair value; smart_money_holdings and guru_moves " +
      "for what tracked investors own and changed. Keyless calls are limited per day; a 429 lists remedies " +
      "and a 402 carries a checkout link. Prices are decimal credits (1 credit = $1). Not investment advice." },
);

let toolCache: Tool[] | null = null;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!toolCache) {
    const r = await upstream("tools/list");
    if (r.error) throw new Error(`DeepValues tools/list failed: ${r.error.message}`);
    toolCache = ((r.result as { tools?: Tool[] })?.tools ?? []).map((t) => ({
      ...t,
      // Hosts differ on which characters a tool name may hold; keep [A-Za-z0-9_-].
      name: t.name.replace(/[^A-Za-z0-9_-]/g, "_"),
    }));
  }
  return { tools: toolCache };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const r = await upstream("tools/call", { name: req.params.name, arguments: req.params.arguments ?? {} });
  if (r.error) {
    const result: CallToolResult = {
      content: [{ type: "text", text: `DeepValues error ${r.error.code}: ${r.error.message}` +
        (r.error.data ? `\n${JSON.stringify(r.error.data)}` : "") }],
      isError: true,
    };
    return result;
  }
  return r.result as CallToolResult;
});

const transport = new StdioServerTransport();
await server.connect(transport);
