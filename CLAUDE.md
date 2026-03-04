# unifi-cli

CLI and MCP server for the UniFi Network Integration API.

## Architecture

- `src/commands.ts` — `CmdDef` registry: every API operation is a static entry in the `COMMANDS` array. Tool names, annotations, and descriptions are derived from this.
- `src/mcp.ts` — MCP server: exposes tools (one per CmdDef), resources, resource templates, and prompts. Handles site ID resolution and auto-pagination.
- `src/execute.ts` — Request builder and executor. `executeAllPages()` handles auto-pagination.
- `src/client.ts` — HTTP client with API key auth. Auto-prepends `/proxy/network` for UniFi OS gateways.
- `src/schema.ts` — OpenAPI spec loader. Generates JSON Schema for tool `body` parameters.
- `src/config.ts` — Config resolution from env vars, CLI flags, and config file.
- `src/output.ts` — CLI output formatting (table, JSON, raw).
- `src/index.ts` — CLI entry point (Commander.js).

## Development

```bash
bun install          # install dependencies
bun test             # run tests
bunx tsc --noEmit    # type check
bun run src/index.ts # run CLI
```

## Key Patterns

- **CmdDef registry**: all 67 API operations are defined as static data in `COMMANDS`. Adding a new endpoint = adding an entry.
- **Tool naming**: `toolName(cmd)` → `group_action` (e.g. `firewall_zones_list`) or just `action` for top-level commands.
- **Auto-pagination**: when `offset`/`limit` are omitted, `executeAllPages()` fetches all pages transparently.
- **Site ID resolution**: `"default"` and other `internalReference` values are resolved to UUIDs via the sites API. Cached after first call.
- **Self-signed TLS**: always sets `NODE_TLS_REJECT_UNAUTHORIZED=0` — UniFi controllers use self-signed certs.
- **Tool annotations**: `buildToolAnnotations()` derives `readOnlyHint`, `destructiveHint`, `idempotentHint` from the HTTP method.
- **Enriched descriptions**: `buildToolDescription()` adds group context, related tool groups, and API reference to each tool.

## Testing

- Uses `bun:test` with `InMemoryTransport` for MCP server tests (Bun.spawn + StdioServerTransport doesn't work for piped stdin).
- Mock `globalThis.fetch` for API call tests — restore in `afterEach`/`afterAll`.
- `Response` body is consumed once — for error fallback tests, use custom mock objects.

## Conventional Commits

Always use conventional commit format: `feat:`, `fix:`, `refactor:`, `chore:`, `ci:`, `test:`, `docs:`. release-please uses these for automated changelog and versioning.
