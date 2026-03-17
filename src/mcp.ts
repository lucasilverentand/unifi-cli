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
import { COMMANDS, toolName, buildToolAnnotations, buildToolDescription, cmdAllowedAtLevel, type CmdDef, type ProtectionLevel } from "./commands.ts";
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
import { getPromptList, getPromptMessages } from "./prompts.ts";
import { getStaticResources, getResourceTemplates, readResource } from "./resources.ts";

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

  // Confirmation token for critical operations
  if (cmd.risk === "critical") {
    properties.confirmationToken = {
      type: "string",
      description: "Confirmation token returned by a previous call. Critical operations require two-step confirmation: first call without token to get a confirmation prompt, then call again with the token to execute.",
    };
  }

  return {
    type: "object",
    properties,
    required: required.length ? required : undefined,
  };
}

// ---------------------------------------------------------------------------
// Two-step confirmation for critical operations
// ---------------------------------------------------------------------------

interface PendingConfirmation {
  token: string;
  toolName: string;
  argsKey: string;
  expiresAt: number;
}

const CONFIRMATION_TTL_MS = 30_000;
const pendingConfirmations = new Map<string, PendingConfirmation>();

function cleanupExpiredConfirmations(): void {
  const now = Date.now();
  for (const [key, pc] of pendingConfirmations) {
    if (pc.expiresAt <= now) pendingConfirmations.delete(key);
  }
}

function argsKey(params: Record<string, unknown> | undefined): string {
  if (!params) return "";
  const { confirmationToken: _, ...rest } = params;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

// ---------------------------------------------------------------------------
// Build tool name → CmdDef lookup
// ---------------------------------------------------------------------------

const toolMap = new Map<string, CmdDef>();
for (const cmd of COMMANDS) {
  toolMap.set(toolName(cmd), cmd);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a CmdDef by operationId */
function findCmd(operationId: string): CmdDef | undefined {
  return COMMANDS.find((c) => c.operationId === operationId);
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export async function startMcpServer(customTransport?: import("@modelcontextprotocol/sdk/shared/transport.js").Transport): Promise<Server> {
  const config = resolveConfig({});
  // UniFi controllers use self-signed certificates by default — always allow them
  Bun.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const protection: ProtectionLevel = config.protection;

  const server = new Server(
    { name: "unifi-cli", version: pkg.version },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: [
        "UniFi Network MCP Server — manages a Ubiquiti UniFi controller via the Integration API.",
        "",
        "Getting started:",
        "1. Call sites_list first to discover available sites and their UUIDs.",
        "2. Most tools require a siteId parameter — pass the UUID from step 1.",
        "3. If you omit siteId, it defaults to the configured site (usually \"default\", auto-resolved to its UUID).",
        "",
        "Pagination: list endpoints auto-fetch all pages when you omit offset/limit. Pass explicit values only if you need a specific page.",
        "",
        "Firewall model: zones group networks; policies define rules between zone pairs. To audit firewall config, read zones first, then policies, then check ordering per zone pair.",
        "",
        `Protection level: "${protection}". Tools are filtered by risk level:`,
        "  - read: GET-only operations (no side effects)",
        "  - safe: read + moderate risk (creates new resources, easily reversible)",
        "  - full: safe + dangerous risk (modifies existing config, can disrupt service)",
        "  - unrestricted: everything including critical operations (factory reset, bulk delete)",
        "",
        "Critical operations (e.g. device removal, network deletion) require two-step confirmation even at unrestricted level.",
        "Call the tool once without confirmationToken to receive an impact summary and token, then call again with the token to execute.",
        "",
        "TLS: UniFi controllers use self-signed certificates. This server automatically trusts them.",
      ].join("\n"),
    },
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
    const cmds = COMMANDS.filter((cmd) => cmdAllowedAtLevel(cmd, protection));
    const tools = cmds.map((cmd) => ({
      name: toolName(cmd),
      description: buildToolDescription(cmd),
      inputSchema: buildInputSchema(cmd),
      annotations: buildToolAnnotations(cmd),
    }));
    return { tools };
  });

  // ── CallTool ──────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const cmd = toolMap.get(name);
    const params = args as Record<string, unknown> | undefined;

    if (!cmd) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }

    if (!cmdAllowedAtLevel(cmd, protection)) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Protection level "${protection}" does not allow ${cmd.risk}-risk operations: ${cmd.method} ${cmd.path}`,
            hint: `Current level: "${protection}". Set UNIFI_PROTECTION to a higher level (read < safe < full < unrestricted) to enable this tool.`,
          }),
        }],
        isError: true,
      };
    }

    // Two-step confirmation for critical operations
    if (cmd.risk === "critical") {
      cleanupExpiredConfirmations();
      const token = params?.confirmationToken ? String(params.confirmationToken) : undefined;
      const currentArgsKey = argsKey(params);

      if (!token) {
        // Step 1: generate confirmation token
        const newToken = crypto.randomUUID();
        pendingConfirmations.set(newToken, {
          token: newToken,
          toolName: name,
          argsKey: currentArgsKey,
          expiresAt: Date.now() + CONFIRMATION_TTL_MS,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              confirmation_required: true,
              token: newToken,
              impact: `${cmd.summary}. This is a critical operation that may cause data loss or service disruption.`,
              expires_in_seconds: CONFIRMATION_TTL_MS / 1000,
              hint: `Call ${name} again with confirmationToken: "${newToken}" to confirm execution.`,
            }, null, 2),
          }],
        };
      }

      // Step 2: validate token
      const pending = pendingConfirmations.get(token);
      if (!pending) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "Invalid or expired confirmation token",
              hint: `Call ${name} without confirmationToken to get a new confirmation prompt.`,
            }),
          }],
          isError: true,
        };
      }
      if (pending.toolName !== name) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Confirmation token was issued for "${pending.toolName}", not "${name}"`,
              hint: `Call ${name} without confirmationToken to get a new confirmation prompt.`,
            }),
          }],
          isError: true,
        };
      }
      if (pending.argsKey !== currentArgsKey) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "Confirmation token was issued for different arguments",
              hint: `Call ${name} without confirmationToken to get a new confirmation prompt.`,
            }),
          }],
          isError: true,
        };
      }
      // Token valid — consume it and proceed
      pendingConfirmations.delete(token);
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
    return { resources: getStaticResources() };
  });

  // ── ListResourceTemplates ─────────────────────────────────────────
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return { resourceTemplates: getResourceTemplates() };
  });

  // ── ReadResource ──────────────────────────────────────────────────
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    let client: UnifiClient;
    try {
      client = getClient();
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }

    const contents = await readResource(request.params.uri, client, resolveSiteId);
    return { contents };
  });

  // ── ListPrompts ───────────────────────────────────────────────────
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: getPromptList() };
  });

  // ── GetPrompt ─────────────────────────────────────────────────────
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: promptArgs } = request.params;
    const messages = getPromptMessages(name, promptArgs ?? {});
    return { messages };
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
