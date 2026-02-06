# unifi-cli

CLI and MCP server for the UniFi Network API. Auto-generated from the official OpenAPI spec, optimized for scripting and AI/LLM tool use.

## Requirements

- [Bun](https://bun.sh) runtime (v1.0+)
- UniFi Network Application v10+ with API key

## Install

```bash
bun install -g unifi-cli
```

## Quick Start

```bash
# Save connection settings
unifi-cli configure --url https://192.168.1.1 --api-key YOUR_API_KEY

# List sites
unifi-cli sites list

# List devices on a site
unifi-cli devices list --site default

# Get device details
unifi-cli devices get --site default DEVICE_ID
```

## Configuration

Configuration is resolved in priority order:

1. CLI flags: `--url`, `--api-key`, `--site`
2. Environment variables: `UNIFI_URL`, `UNIFI_API_KEY`, `UNIFI_SITE`
3. Config file: `~/.config/unifi-cli/config.json`

## Commands

All 67 UniFi Network API operations are available as CLI commands, organized by resource:

| Group | Commands |
|-------|----------|
| `sites` | `list` |
| `devices` | `list`, `get`, `stats`, `pending`, `adopt`, `unadopt` |
| `clients` | `list`, `get` |
| `networks` | `list`, `get`, `create`, `update`, `delete`, `references` |
| `firewall` | `zones-list`, `zones-get`, `policies-list`, `policies-get`, `policies-ordering` |
| `wifi` | `list`, `get`, `create`, `update`, `delete` |
| `dns` | `list`, `get`, `create`, `update`, `delete` |
| `vpn` | `tunnels-list`, `servers-list`, ... |
| `acl` | `list`, `get`, `ordering`, ... |
| ... | and more |

Run `unifi-cli operations` to see the full list, or `unifi-cli --help` for usage.

## Output Formats

```bash
# JSON (default)
unifi-cli sites list

# JSON Lines (one object per line)
unifi-cli clients list --format jsonl

# Table
unifi-cli devices list --format table

# Filter fields
unifi-cli devices list --fields name,model,status
```

## MCP Server

Expose all operations as tools for AI/LLM agents via the [Model Context Protocol](https://modelcontextprotocol.io):

```bash
# Start MCP server (stdio transport)
unifi-cli mcp

# Read-only mode (only GET operations)
unifi-cli mcp --read-only
```

### Claude Desktop / Claude Code

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "unifi": {
      "command": "unifi-cli",
      "args": ["mcp"],
      "env": {
        "UNIFI_URL": "https://192.168.1.1",
        "UNIFI_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

The MCP server provides:
- **67 tools** — one per API operation, with full JSON Schema input validation
- **3 resources** — `unifi://info`, `unifi://sites`, `unifi://spec`
- **3 resource templates** — `unifi://sites/{siteId}/devices`, `/networks`, `/clients`
- **3 prompts** — `audit-firewall`, `network-topology`, `device-health`

## Advanced

```bash
# Raw API request
unifi-cli raw GET /v1/sites

# Dry run (show request without executing)
unifi-cli devices list --dry-run

# Skip TLS verification (self-signed certs)
unifi-cli sites list --insecure

# View schema for an operation
unifi-cli schema getAdoptedDeviceOverviewPage

# Dump the bundled OpenAPI spec
unifi-cli openapi
```

## License

MIT
