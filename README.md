# deepvalues-mcp

A local stdio [MCP](https://modelcontextprotocol.io) server for the
[DeepValues API](https://app.deepvalues.ai/developers): what Buffett and 80+ tracked
investors hold (13F), intrinsic value, fundamentals, SEC filings, value-investor
sentiment, the Buffett Indicator, and a drop-in AI grounding block for any US stock.

It fronts the hosted endpoint `https://app.deepvalues.ai/api/mcp`, so the tool list,
prices and payment flow always match the server. Use it when your host speaks stdio
only. Hosts that speak streamable HTTP can point at the hosted URL directly.

## Use

**Claude Desktop / Cursor / Zed** (stdio):

```json
{
  "mcpServers": {
    "deepvalues": {
      "command": "npx",
      "args": ["-y", "deepvalues-mcp"],
      "env": { "DEEPVALUES_API_KEY": "dv_sk_live_…" }
    }
  }
}
```

Leave `env` out to run keyless: 25 calls a day per IP, 5 on each $0.005 tool, 1 on
`ai_context`. The `keys_create` tool mints a key with no account; an email gives a live
key with 1 starter credit.

**Claude Code** (hosted, no install):

```bash
claude mcp add --transport http deepvalues https://app.deepvalues.ai/api/mcp
```

## Tools

`ai_context` (everything about one company, for grounding), `intrinsic_value`,
`smart_money_holdings`, `smart_money_changes`, `guru_moves`, `verdict`, `mirror_brief`,
`gurus`, `guru`, `guru_portfolio`, `theses`, `fundamentals`, `company_overview`,
`companies_search`, `filings`, `news`, `sentiment`, `indicators_buffett`,
`indicators_shiller_pe`, `research` (3 credits, keyed), plus `keys_create`, `keys_me`,
`pricing`, `credits_checkout`. Prices are decimal credits, 1 credit = $1; most reads cost
0.001 or 0.005. A 402 carries a Stripe checkout link (and an x402 USDC quote when that
rail is on); a 429 lists remedies.

## Develop

```bash
npm install && npm run build && npm run smoke
```

Env: `DEEPVALUES_API_KEY` (optional), `DEEPVALUES_MCP_URL` (default the hosted endpoint).

MIT. Data is for research; nothing here is investment advice.
