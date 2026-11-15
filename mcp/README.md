# MCP server for Claude (Phase 5)

Nine tools so a Claude chat can read and write decks: `list_themes`,
`list_layouts`, `list_decks`, `get_deck` (P5-3); `create_deck`, `add_slide`,
`update_slide`, `delete_slide`, `reorder_slides` (P5-4). Every write returns
the deck's editor link (P5-7); bullet elements take a `cues` field Claude is
told to fill in with a couple of likely spoken phrasings (P5-6).

## Two ways to run this, two backends

| | `stdio.ts` (local) | `lambda.ts` (deployed) |
| --- | --- | --- |
| Transport | stdio | Streamable HTTP, stateless, over API Gateway |
| Storage | `httpBackend.ts` -- HTTP to the **local** dev API (`FLOWIO_API_URL`, default `http://localhost:8787`) | `directBackend.ts` -- calls `@flowio/api`'s handlers directly against the real DynamoDB table |
| Identity | fixed dev email, `Authorization: Bearer dev:<email>` | fixed dev email baked into the Lambda's env (`FLOWIO_MCP_DEV_EMAIL`) |
| Who it's for | Claude Desktop, MCP Inspector, local testing | Claude.ai custom connectors, or any client that needs a real URL |

Both share the same tool definitions (`tools.ts`) through the `DeckBackend`
interface (`backend.ts`) -- adding a tool or changing its behaviour never
needs to touch either entry point.

## Auth, for now (P5-1 deferred on purpose)

Per the phase plan, P5-1 (real Cognito OAuth sign-in from Claude's custom
connector) is being done *last* in this phase, once everything else is
tested. Until then:

- **Local (`stdio.ts`):** every call acts as one fixed identity
  (`FLOWIO_MCP_DEV_EMAIL`, default `claude@flowio.local`), sent as
  `Authorization: Bearer dev:<email>` -- the same convention the web app's
  own local dev stand-in uses (`api/src/auth/devVerifier.ts`). A deck Claude
  creates shows up by signing into the **local** dashboard
  (`http://localhost:5174/dashboard.html`) as that same email.
- **Deployed (`lambda.ts`):** the deployed deck API only accepts real
  Cognito tokens, so this calls the DynamoDB-backed handlers directly in
  the same Lambda, bypassing that gate entirely rather than weakening it
  (see `directBackend.ts`'s doc comment). In place of real auth, every
  request must carry a shared secret as `Authorization: Bearer <secret>` --
  not OAuth, just enough that a public write-capable endpoint isn't wide
  open to the internet in the meantime. `infra/README.md` has the setup.
  The returned editor link points at the real deployed site, but won't open
  in a signed-in browser until P5-1 ships -- same known gap as the deployed
  dashboard already has.

**Not yet done:** P5-1 itself, naturally, and P5-10 (optional inline
previews via MCP Apps). Everything else in the phase plan's Phase 5 list is
built and tested -- see the root README's "Phase 5 status" for specifics,
including a real bug this deployment caught and fixed (DynamoDB rejecting
decks with an unset `notes` field when written directly rather than via
JSON, which drops `undefined` for free).

## Run it locally

```bash
# terminal 1: the local dev API, same one `web` talks to
pnpm --filter api run dev

# terminal 2: the MCP server, over stdio
pnpm --filter mcp run dev
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector node --import tsx mcp/src/stdio.ts
```

(Every tool was verified instead with a scripted client using the same
official SDK classes the Inspector itself uses -- `StdioClientTransport`
locally, `StreamableHTTPClientTransport` against the deployed Lambda -- not
the Inspector's own UI. The command above should work unchanged; it just
hasn't been clicked through by hand.)

### Claude Desktop (custom connector)

Add to Claude Desktop's MCP config (Settings -> Developer -> Edit Config):

```json
{
  "mcpServers": {
    "flowio": {
      "command": "node",
      "args": ["--import", "tsx", "src/stdio.ts"],
      "cwd": "/absolute/path/to/live-slides-spike/mcp",
      "env": { "FLOWIO_MCP_DEV_EMAIL": "you@example.com" }
    }
  }
}
```

Sign into the local dashboard with the same email to see what Claude builds:
open `http://localhost:5174/signin.html`, "sign in" with
`you@example.com` -- no password, this is the pre-OAuth dev stand-in.

Then in Claude Desktop: *"make a 6-slide deck about airplanes in the
animated theme"* -- it should call `list_themes`/`list_layouts`, then
`create_deck`, and hand back an editor link.

## The deployed endpoint (Claude.ai custom connector)

`lambda.ts` is live at the `McpUrl` stack output (`infra/README.md` has the
one-time shared-secret setup). Add it as a custom connector:

1. claude.ai -> Settings -> Connectors -> Add custom connector
2. URL: the `McpUrl` output (ends in `/mcp`)
3. If the UI offers a header/auth field, set `Authorization: Bearer
   <the shared secret>`. Claude.ai's custom-connector flow is primarily
   OAuth-oriented, and this hasn't been checked by hand against the current
   UI for a static-header option -- if there's no way to set one, a real
   Claude.ai connection needs either an OAuth-fronted proxy in front of the
   Lambda or P5-1 itself. Either way, prove the endpoint works from
   something that does let you set headers first:

```bash
curl -X POST "<McpUrl>" \
  -H "Authorization: Bearer <the shared secret>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

or MCP Inspector's "Streamable HTTP" transport, which does let you set a
custom header.
