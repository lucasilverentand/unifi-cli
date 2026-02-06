import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { COMMANDS, toolName, type CmdDef } from "./commands.ts";
import { resolveConfig } from "./config.ts";
import { UnifiClient } from "./client.ts";
import { executeCommand, executeAllPages } from "./execute.ts";
import {
  loadSpec,
  findOperation,
  getOperationBodyRef,
  describeSchema,
  schemaName,
  resolveRef,
  toJsonSchema,
} from "./schema.ts";

const pkg = await Bun.file(`${import.meta.dir}/../package.json`).json() as { version: string };

// ---------------------------------------------------------------------------
// Build JSON Schema input for each tool
// ---------------------------------------------------------------------------

function buildInputSchema(cmd: CmdDef): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  // siteId — optional, defaults from config
  if (cmd.needsSite) {
    properties.siteId = {
      type: "string",
      description: "Site ID (defaults to configured site or \"default\")",
    };
  }

  // Positional path args — required
  for (const arg of cmd.args) {
    properties[arg.name] = { type: "string", description: arg.desc };
    required.push(arg.name);
  }

  // Pagination params — optional
  if (cmd.paginatable) {
    properties.offset = { type: "integer", description: "Pagination offset (omit to auto-fetch all pages)" };
    properties.limit = { type: "integer", description: "Page size limit (omit to auto-fetch all pages)" };
    properties.filter = { type: "string", description: "Filter expression (UniFi filter syntax)" };
  }

  // Extra query params
  for (const qp of cmd.extraQuery) {
    properties[qp.name] = { type: "string", description: qp.desc };
    if (qp.required) required.push(qp.name);
  }

  // Request body — generate real JSON Schema from OpenAPI spec when possible
  if (cmd.hasBody) {
    let bodySchema: Record<string, unknown> | null = null;
    let bodyDesc = "Request body object";
    try {
      const spec = loadSpec();
      const opInfo = findOperation(spec, cmd.operationId);
      if (opInfo) {
        const bodyRef = getOperationBodyRef(opInfo.op);
        if (bodyRef) {
          const resolved = resolveRef(spec, bodyRef);
          if (resolved) {
            bodySchema = toJsonSchema(spec, resolved);
          }
          const schemaHelp = describeSchema(spec, bodyRef);
          bodyDesc = `Request body (${schemaName(bodyRef)}):\n${schemaHelp}`;
        }
      }
    } catch {
      // spec not available — fall back to generic description
    }
    if (bodySchema && bodySchema.type === "object") {
      properties.body = { ...bodySchema, description: bodyDesc, additionalProperties: true };
    } else {
      properties.body = {
        type: "object",
        description: bodyDesc,
        additionalProperties: true,
      };
    }
    required.push("body");
  }

  return {
    type: "object",
    properties,
    required: required.length ? required : undefined,
  };
}

// ---------------------------------------------------------------------------
// Build tool name → CmdDef lookup
// ---------------------------------------------------------------------------

const toolMap = new Map<string, CmdDef>();
for (const cmd of COMMANDS) {
  toolMap.set(toolName(cmd), cmd);
}

// ---------------------------------------------------------------------------
// Helpers for resource URI matching
// ---------------------------------------------------------------------------

/** Find a CmdDef by operationId */
function findCmd(operationId: string): CmdDef | undefined {
  return COMMANDS.find((c) => c.operationId === operationId);
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function startMcpServer(customTransport?: import("@modelcontextprotocol/sdk/server/index.js").Transport): Promise<Server> {
  const config = resolveConfig({});
  // UniFi controllers use self-signed certificates by default — always allow them
  Bun.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const readOnly = config.readOnly;

  const server = new Server(
    { name: "unifi-cli", version: pkg.version },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  // Helper: create an authenticated client or throw
  function getClient(): UnifiClient {
    if (!config.url || !config.apiKey) {
      throw new Error(
        "Missing UniFi configuration. Set UNIFI_URL and UNIFI_API_KEY environment variables, or run: unifi-cli configure",
      );
    }
    return new UnifiClient(config.url, config.apiKey);
  }

  // Cache resolved site ID (maps internalReference like "default" to UUID)
  let resolvedDefaultSiteId: string | null = null;

  async function resolveSiteId(siteId: string, client: UnifiClient): Promise<string> {
    // If it looks like a UUID already, use it directly
    if (/^[0-9a-f]{8}-/.test(siteId)) return siteId;

    // Try to resolve "default" (or other internalReference) to UUID
    if (!resolvedDefaultSiteId) {
      const sitesCmd = findCmd("getSiteOverviewPage");
      if (sitesCmd) {
        const result = await executeAllPages(sitesCmd, { args: {} }, client) as { data?: Array<{ id: string; internalReference?: string }> };
        const match = result.data?.find((s) => s.internalReference === siteId || s.id === siteId);
        if (match) {
          resolvedDefaultSiteId = match.id;
          return match.id;
        }
      }
    }
    return resolvedDefaultSiteId ?? siteId;
  }

  // ── ListTools ─────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const cmds = readOnly
      ? COMMANDS.filter((cmd) => READ_ONLY_METHODS.has(cmd.method))
      : COMMANDS;
    const tools = cmds.map((cmd) => ({
      name: toolName(cmd),
      description: `${cmd.summary}. API: ${cmd.method} ${cmd.path}`,
      inputSchema: buildInputSchema(cmd),
    }));
    return { tools };
  });

  // ── CallTool ──────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const cmd = toolMap.get(name);

    if (!cmd) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }

    if (readOnly && !READ_ONLY_METHODS.has(cmd.method)) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Read-only mode: ${cmd.method} ${cmd.path} is not allowed`,
            hint: "Unset UNIFI_READ_ONLY to enable write operations",
          }),
        }],
        isError: true,
      };
    }

    let client: UnifiClient;
    try {
      client = getClient();
    } catch (err: unknown) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: (err as Error).message,
            hint: "Set UNIFI_URL and UNIFI_API_KEY environment variables, or run: unifi-cli configure",
          }),
        }],
        isError: true,
      };
    }

    // Map tool arguments to ExecuteParams
    const params = args as Record<string, unknown> | undefined;

    const pathArgs: Record<string, string> = {};
    for (const arg of cmd.args) {
      if (params?.[arg.name]) pathArgs[arg.name] = String(params[arg.name]);
    }

    const extraQuery: Record<string, string> = {};
    for (const qp of cmd.extraQuery) {
      if (params?.[qp.name] !== undefined) extraQuery[qp.name] = String(params[qp.name]);
    }

    // Resolve site ID: "default" → actual UUID
    const rawSiteId = params?.siteId ? String(params.siteId) : config.site;
    const siteId = cmd.needsSite ? await resolveSiteId(rawSiteId, client) : rawSiteId;

    const execParams = {
      siteId,
      args: pathArgs,
      offset: params?.offset !== undefined ? String(params.offset) : undefined,
      limit: params?.limit !== undefined ? String(params.limit) : undefined,
      filter: params?.filter ? String(params.filter) : undefined,
      extraQuery,
      body: params?.body,
    };

    try {
      // Auto-paginate when caller omits explicit offset/limit
      const useAutoPage = cmd.paginatable
        && params?.offset === undefined
        && params?.limit === undefined;

      const result = useAutoPage
        ? await executeAllPages(cmd, execParams, client)
        : await executeCommand(cmd, execParams, client);

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: unknown) {
      const e = err as Error & { response?: unknown };
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: e.message,
            detail: e.response ?? undefined,
          }, null, 2),
        }],
        isError: true,
      };
    }
  });

  // ── ListResources ─────────────────────────────────────────────────
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "unifi://info",
          name: "UniFi Network Application Info",
          description: "General info about the UniFi Network application (version, hostname, etc.)",
          mimeType: "application/json",
        },
        {
          uri: "unifi://sites",
          name: "Sites",
          description: "List all local UniFi sites",
          mimeType: "application/json",
        },
        {
          uri: "unifi://spec",
          name: "OpenAPI Specification",
          description: "The bundled OpenAPI spec used by the CLI",
          mimeType: "application/json",
        },
      ],
    };
  });

  // ── ListResourceTemplates ─────────────────────────────────────────
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: [
        {
          uriTemplate: "unifi://sites/{siteId}/devices",
          name: "Devices",
          description: "List adopted devices on a site",
          mimeType: "application/json",
        },
        {
          uriTemplate: "unifi://sites/{siteId}/networks",
          name: "Networks",
          description: "List all networks on a site",
          mimeType: "application/json",
        },
        {
          uriTemplate: "unifi://sites/{siteId}/clients",
          name: "Clients",
          description: "List connected clients on a site",
          mimeType: "application/json",
        },
      ],
    };
  });

  // ── ReadResource ──────────────────────────────────────────────────
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    let client: UnifiClient;
    try {
      client = getClient();
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }

    // Static resources
    if (uri === "unifi://info") {
      const cmd = findCmd("getInfo");
      if (!cmd) throw new Error("getInfo command not found");
      const result = await executeCommand(cmd, { args: {} }, client);
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (uri === "unifi://sites") {
      const cmd = findCmd("getSiteOverviewPage");
      if (!cmd) throw new Error("getSiteOverviewPage command not found");
      const result = await executeAllPages(cmd, { args: {} }, client);
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (uri === "unifi://spec") {
      const spec = loadSpec();
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(spec, null, 2) }],
      };
    }

    // Parameterized templates: unifi://sites/{siteId}/devices|networks|clients
    const templateMatch = uri.match(/^unifi:\/\/sites\/([^/]+)\/(devices|networks|clients)$/);
    if (templateMatch) {
      const [, rawSiteId, resource] = templateMatch;
      const resolvedSiteId = await resolveSiteId(rawSiteId, client);
      const operationMap: Record<string, string> = {
        devices: "getAdoptedDeviceOverviewPage",
        networks: "getNetworksOverviewPage",
        clients: "getConnectedClientOverviewPage",
      };
      const cmd = findCmd(operationMap[resource]);
      if (!cmd) throw new Error(`Command not found for resource: ${resource}`);
      const result = await executeAllPages(cmd, { siteId: resolvedSiteId, args: {} }, client);
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });

  // ── ListPrompts ───────────────────────────────────────────────────
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "audit-firewall",
          description: "Audit firewall zones, policies, and ACL rules for a site",
          arguments: [
            { name: "siteId", description: "Site ID to audit", required: true },
          ],
        },
        {
          name: "network-topology",
          description: "Map the network topology — networks, VLANs, WAN links, and VPN tunnels",
          arguments: [
            { name: "siteId", description: "Site ID to analyze", required: true },
          ],
        },
        {
          name: "device-health",
          description: "Check device health — CPU, memory, uptime, and connectivity",
          arguments: [
            { name: "siteId", description: "Site ID to check", required: true },
          ],
        },
      ],
    };
  });

  // ── GetPrompt ─────────────────────────────────────────────────────
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: promptArgs } = request.params;
    const siteId = promptArgs?.siteId ?? "default";

    switch (name) {
      case "audit-firewall":
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: [
                  `Perform a comprehensive firewall audit for site "${siteId}".`,
                  "",
                  "Steps:",
                  `1. Use the **firewall_zones_list** tool (siteId: "${siteId}") to get all firewall zones.`,
                  `2. Use the **firewall_policies_list** tool (siteId: "${siteId}") to get all firewall policies.`,
                  `3. Use the **acl_list** tool (siteId: "${siteId}") to get all ACL rules.`,
                  `4. Use the **networks_list** tool (siteId: "${siteId}") to understand zone-to-network mapping.`,
                  "",
                  "Then analyze:",
                  "- Are there any overly permissive rules (allow-all between zones)?",
                  "- Are there zones with no policies defined?",
                  "- Are inter-VLAN policies properly restricting traffic?",
                  "- Are there redundant or shadowed rules?",
                  "- Provide a summary table of zone pairs and their policy counts.",
                ].join("\n"),
              },
            },
          ],
        };

      case "network-topology":
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: [
                  `Map the full network topology for site "${siteId}".`,
                  "",
                  "Steps:",
                  `1. Use the **networks_list** tool (siteId: "${siteId}") to get all networks and VLANs.`,
                  `2. Use the **devices_list** tool (siteId: "${siteId}") to get all adopted devices.`,
                  `3. Use the **wans_list** tool (siteId: "${siteId}") to get WAN interfaces.`,
                  `4. Use the **vpn_tunnels_list** tool (siteId: "${siteId}") to get VPN tunnels.`,
                  `5. Use the **wifi_list** tool (siteId: "${siteId}") to get WiFi broadcasts.`,
                  "",
                  "Then produce:",
                  "- A text-based topology diagram showing the gateway, switches, APs, and their interconnections.",
                  "- A table of networks with VLAN ID, subnet, DHCP range, and purpose.",
                  "- A summary of WAN links and VPN tunnels.",
                  "- WiFi SSID-to-network mappings.",
                ].join("\n"),
              },
            },
          ],
        };

      case "device-health":
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: [
                  `Check device health for site "${siteId}".`,
                  "",
                  "Steps:",
                  `1. Use the **devices_list** tool (siteId: "${siteId}") to get all adopted devices.`,
                  `2. For each device, use the **devices_stats** tool (siteId: "${siteId}", deviceId: <id>) to get real-time statistics.`,
                  "",
                  "Then report:",
                  "- A health summary table: device name, model, status, CPU %, memory %, uptime.",
                  "- Flag any devices with high CPU (>80%), high memory (>80%), or recent restarts (uptime < 1 hour).",
                  "- Note any devices that are offline or unreachable.",
                  "- Provide recommendations for any issues found.",
                ].join("\n"),
              },
            },
          ],
        };

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  // ── Start ─────────────────────────────────────────────────────────
  const transport = customTransport ?? new StdioServerTransport();
  await server.connect(transport);
  // Server is now running — stdio handles the lifecycle
  return server;
}

// Auto-start when run directly (e.g. `bun run src/mcp.ts`)
if (import.meta.main) {
  startMcpServer().catch((err) => {
    process.stderr.write(`unifi-cli MCP error: ${err}\n`);
    process.exit(1);
  });
}
