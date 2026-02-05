import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { COMMANDS, toolName, type CmdDef } from "./commands.js";
import { resolveConfig, type Config } from "./config.js";
import { UnifiClient } from "./client.js";
import { executeCommand } from "./execute.js";
import {
  loadSpec,
  findOperation,
  getOperationBodyRef,
  describeSchema,
  schemaName,
} from "./schema.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

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
    properties.offset = { type: "integer", description: "Pagination offset (default 0)" };
    properties.limit = { type: "integer", description: "Page size limit (default 25)" };
    properties.filter = { type: "string", description: "Filter expression (UniFi filter syntax)" };
  }

  // Extra query params
  for (const qp of cmd.extraQuery) {
    properties[qp.name] = { type: "string", description: qp.desc };
    if (qp.required) required.push(qp.name);
  }

  // Request body — passed as an object, not a string
  if (cmd.hasBody) {
    let bodyDesc = "Request body object";
    try {
      const spec = loadSpec();
      const opInfo = findOperation(spec, cmd.operationId);
      if (opInfo) {
        const bodyRef = getOperationBodyRef(opInfo.op);
        if (bodyRef) {
          const schemaHelp = describeSchema(spec, bodyRef);
          bodyDesc = `Request body (${schemaName(bodyRef)}):\n${schemaHelp}`;
        }
      }
    } catch {
      // spec not available — fall back to generic description
    }
    properties.body = {
      type: "object",
      description: bodyDesc,
      additionalProperties: true,
    };
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
// MCP Server
// ---------------------------------------------------------------------------

export async function startMcpServer(): Promise<void> {
  const config = resolveConfig({});
  if (config.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const server = new Server(
    { name: "unifi-cli", version: pkg.version },
    { capabilities: { tools: {} } },
  );

  // ── ListTools ─────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = COMMANDS.map((cmd) => ({
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

    // Resolve config — env vars / config file provide url + apiKey
    if (!config.url || !config.apiKey) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Missing UniFi configuration",
            hint: "Set UNIFI_URL and UNIFI_API_KEY environment variables, or run: unifi-cli configure",
          }),
        }],
        isError: true,
      };
    }

    const client = new UnifiClient(config.url, config.apiKey);

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

    const execParams = {
      siteId: params?.siteId ? String(params.siteId) : config.site,
      args: pathArgs,
      offset: params?.offset !== undefined ? String(params.offset) : undefined,
      limit: params?.limit !== undefined ? String(params.limit) : undefined,
      filter: params?.filter ? String(params.filter) : undefined,
      extraQuery,
      body: params?.body,
    };

    try {
      const result = await executeCommand(cmd, execParams, client);
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

  // ── Start ─────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running — stdio handles the lifecycle
}
