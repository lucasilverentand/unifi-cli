#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "node:module";
import { readFileSync } from "fs";
import { resolveConfig, requireConfig, saveConfig, type Config } from "./config.js";
import { UnifiClient } from "./client.js";
import { formatOutput, pickFields } from "./output.js";
import {
  loadSpec,
  findOperation,
  describeSchema,
  structuredSchema,
  getOperationBodyRef,
  getOperationResponseRef,
  schemaName,
  type OpenAPISpec,
} from "./schema.js";
import { COMMANDS, GROUP_DESCRIPTIONS, camelCase, type CmdDef } from "./commands.js";
import { resolveRequest, executeCommand, executeAllPages } from "./execute.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

// ---------------------------------------------------------------------------
// CLI setup
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("unifi-cli")
  .version(pkg.version)
  .description(
    "CLI for the UniFi Network API (v10.1.83)\n\n" +
    "All output is JSON by default — designed for scripting and AI/LLM tool use.\n\n" +
    "Configuration (in priority order):\n" +
    "  1. CLI flags:      --url, --api-key, --site\n" +
    "  2. Env vars:       UNIFI_URL, UNIFI_API_KEY, UNIFI_SITE\n" +
    "  3. Config file:    ~/.config/unifi-cli/config.json\n\n" +
    "Quick start:\n" +
    "  $ unifi-cli configure --url https://192.168.1.1 --api-key YOUR_KEY\n" +
    "  $ unifi-cli sites list\n" +
    "  $ unifi-cli devices list --site default",
  )
  .option("--url <url>", "UniFi controller URL (e.g. https://192.168.1.1)")
  .option("--api-key <key>", "API key for authentication")
  .option("--site <id>", "Site ID (default: \"default\")")
  .option("--format <fmt>", "Output format: json, jsonl, table", "json")
  .option("--insecure", "Skip TLS certificate verification (for self-signed certs)")
  .option("--dry-run", "Print the HTTP request instead of executing it")
  .option("--fields <list>", "Comma-separated list of fields to include in output");

// ── configure ─────────────────────────────────────────────────────────

program
  .command("configure")
  .description("Save connection settings to ~/.config/unifi-cli/config.json")
  .option("--url <url>", "UniFi controller URL")
  .option("--api-key <key>", "API key")
  .option("--site <id>", "Default site ID")
  .option("--insecure", "Skip TLS certificate verification")
  .action((opts) => {
    const toSave: Record<string, string | boolean> = {};
    if (opts.url) toSave.url = opts.url;
    if (opts.apiKey) toSave.apiKey = opts.apiKey;
    if (opts.site) toSave.site = opts.site;
    if (opts.insecure) toSave.insecure = true;
    if (Object.keys(toSave).length === 0) {
      console.error(JSON.stringify({ error: "Provide at least one of --url, --api-key, --site" }));
      process.exit(1);
    }
    saveConfig(toSave);
    console.log(JSON.stringify({ ok: true, saved: Object.keys(toSave), path: "~/.config/unifi-cli/config.json" }));
  });

// ── openapi ───────────────────────────────────────────────────────────

program
  .command("openapi")
  .description("Dump the bundled OpenAPI spec (useful for AI/LLM introspection)")
  .action(() => {
    const spec = loadSpec();
    console.log(JSON.stringify(spec, null, 2));
  });

// ── operations ────────────────────────────────────────────────────────

program
  .command("operations")
  .description("List all available API operations with method, path, and description")
  .action(() => {
    const ops = COMMANDS.map((cmd) => ({
      command: cmd.group ? `${cmd.group} ${cmd.action}` : cmd.action,
      operationId: cmd.operationId,
      method: cmd.method,
      path: cmd.path,
      summary: cmd.summary,
      needsSite: cmd.needsSite,
      hasBody: cmd.hasBody,
    }));
    console.log(JSON.stringify(ops, null, 2));
  });

// ── schema ────────────────────────────────────────────────────────────

program
  .command("schema <operationId>")
  .description("Show request/response schema for an operation (by operationId or command name)")
  .action((query: string) => {
    const spec = loadSpec();

    // Find by operationId or by command name (e.g. "devices list")
    let cmd = COMMANDS.find((c) => c.operationId === query);
    if (!cmd) {
      const parts = query.split(/\s+/);
      cmd = COMMANDS.find(
        (c) =>
          (c.group === parts[0] && c.action === parts[1]) ||
          (c.group === null && c.action === parts[0]),
      );
    }

    if (!cmd) {
      console.error(JSON.stringify({ error: `Operation not found: ${query}`, hint: "Run 'unifi-cli operations' to see all available operations" }));
      process.exit(1);
    }

    const opInfo = findOperation(spec, cmd.operationId);
    if (!opInfo) {
      console.error(JSON.stringify({ error: `Operation ${cmd.operationId} not found in spec` }));
      process.exit(1);
    }

    const bodyRef = getOperationBodyRef(opInfo.op);
    const respRef = getOperationResponseRef(opInfo.op);

    const result: Record<string, unknown> = {
      command: cmd.group ? `${cmd.group} ${cmd.action}` : cmd.action,
      operationId: cmd.operationId,
      method: cmd.method,
      path: cmd.path,
      summary: cmd.summary,
      needsSite: cmd.needsSite,
      args: cmd.args,
    };

    if (bodyRef) {
      result.requestSchema = {
        name: schemaName(bodyRef),
        properties: structuredSchema(spec, bodyRef),
      };
    }

    if (respRef) {
      result.responseSchema = {
        name: schemaName(respRef),
        properties: structuredSchema(spec, respRef),
      };
    }

    if (cmd.extraQuery.length) {
      result.queryParameters = cmd.extraQuery;
    }

    console.log(JSON.stringify(result, null, 2));
  });

// ── raw ───────────────────────────────────────────────────────────────

program
  .command("raw <method> <path>")
  .description("Make a raw API request (e.g. unifi-cli raw GET /v1/sites)")
  .option("-d, --data <json>", "Request body JSON (or @file.json, or - for stdin)")
  .option("-q, --query <params>", "Query params as key=value,key=value")
  .action(async (method: string, path: string, opts: Record<string, unknown>) => {
    const globalOpts = program.opts();
    const config = resolveConfig(globalOpts);
    if (config.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const query: Record<string, string> = {};
    if (opts.query) {
      for (const pair of (opts.query as string).split(",")) {
        const [k, ...v] = pair.split("=");
        query[k] = v.join("=");
      }
    }

    let body: unknown = undefined;
    if (opts.data) body = await resolveBody(opts.data as string);

    if (globalOpts.dryRun) {
      console.log(JSON.stringify({
        dryRun: true, method: method.toUpperCase(),
        url: `${config.url || "<no-url-configured>"}/integration${path}`,
        query, body: body ?? null,
        headers: {
          "X-API-Key": config.apiKey ? "***" : "(missing)",
        },
      }, null, 2));
      return;
    }

    requireConfig(config);
    const client = new UnifiClient(config.url, config.apiKey);
    try {
      let result = await client.request({
        method: method.toUpperCase(), path, query, body,
      });
      const fields = globalOpts.fields ? (globalOpts.fields as string).split(",") : [];
      if (fields.length) result = pickFields(result, fields);
      console.log(formatOutput(result, globalOpts.format as string));
    } catch (err: unknown) {
      const e = err as Error & { response?: unknown };
      console.error(JSON.stringify({ error: e.message, detail: e.response }, null, 2));
      process.exit(1);
    }
  });

// ── mcp ───────────────────────────────────────────────────────────────

program
  .command("mcp")
  .description("Start MCP server (stdio) — exposes all operations as LLM tools")
  .action(async () => {
    const { startMcpServer } = await import("./mcp.js");
    await startMcpServer();
  });

// ---------------------------------------------------------------------------
// Register all resource commands
// ---------------------------------------------------------------------------

function registerCommands(spec: OpenAPISpec) {
  // Group commands by their group name
  const groups = new Map<string, CmdDef[]>();
  const topLevel: CmdDef[] = [];

  for (const cmd of COMMANDS) {
    if (cmd.group) {
      if (!groups.has(cmd.group)) groups.set(cmd.group, []);
      groups.get(cmd.group)!.push(cmd);
    } else {
      topLevel.push(cmd);
    }
  }

  // Register top-level commands (info, countries)
  for (const cmd of topLevel) {
    registerAction(program, cmd, spec);
  }

  // Register grouped commands
  for (const [groupName, cmds] of groups) {
    const groupCmd = program
      .command(groupName)
      .description(GROUP_DESCRIPTIONS[groupName] ?? groupName);

    for (const cmd of cmds) {
      registerAction(groupCmd, cmd, spec);
    }
  }
}

function registerAction(parent: Command, cmd: CmdDef, spec: OpenAPISpec) {
  // Build the Commander command string: "action <arg1> <arg2>"
  const argParts = cmd.args.map((a) => `<${a.name}>`).join(" ");
  const cmdStr = argParts ? `${cmd.action} ${argParts}` : cmd.action;

  const sub = parent.command(cmdStr).description(cmd.summary);

  // Add pagination options for list commands
  if (cmd.paginatable) {
    sub.option("--offset <n>", "Pagination offset", "0");
    sub.option("--limit <n>", "Page size limit", "25");
    sub.option("--filter <expr>", "Filter expression (UniFi filter syntax)");
    sub.option("--all", "Fetch all pages automatically");
  }

  // Add --data option for commands with request bodies
  if (cmd.hasBody) {
    sub.option("-d, --data <json>", "Request body as JSON string (or @file.json to read from file, or - for stdin)");

    // Add schema help from the spec
    const opInfo = findOperation(spec, cmd.operationId);
    if (opInfo) {
      const bodyRef = getOperationBodyRef(opInfo.op);
      if (bodyRef) {
        const schemaHelp = describeSchema(spec, bodyRef);
        sub.addHelpText(
          "after",
          `\nRequest body schema (${schemaName(bodyRef)}):\n` +
          `  (* = required)\n${schemaHelp}\n` +
          `\n  Tip: use 'unifi-cli schema ${cmd.operationId}' for full schema detail`,
        );
      }
    }
  }

  // Add extra query params as options
  for (const qp of cmd.extraQuery) {
    const flag = qp.required
      ? `--${qp.name} <value>`
      : `--${qp.name} [value]`;
    sub.option(flag, qp.desc);
  }

  // Handler
  sub.action(async (...actionArgs: unknown[]) => {
    // Commander passes positional args first, then options, then the Command
    const opts = actionArgs[actionArgs.length - 2] as Record<string, unknown>;
    const globalOpts = program.opts();
    const config = resolveConfig(globalOpts);

    // Handle --insecure
    if (config.insecure) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    // Build ExecuteParams from CLI args/opts
    const argsMap: Record<string, string> = {};
    for (let i = 0; i < cmd.args.length; i++) {
      argsMap[cmd.args[i].name] = actionArgs[i] as string;
    }

    const extraQuery: Record<string, string> = {};
    for (const qp of cmd.extraQuery) {
      const val = opts[camelCase(qp.name)] as string | undefined;
      if (val !== undefined) extraQuery[qp.name] = val;
    }

    const execParams = {
      siteId: config.site,
      args: argsMap,
      offset: opts.offset as string | undefined,
      limit: opts.limit as string | undefined,
      filter: opts.filter as string | undefined,
      extraQuery,
      body: cmd.hasBody && opts.data ? await resolveBody(opts.data as string) : undefined,
    };

    // Dry run
    if (globalOpts.dryRun) {
      const req = resolveRequest(cmd, execParams);
      console.log(
        JSON.stringify({
          dryRun: true,
          method: req.method,
          url: `${config.url || "<no-url-configured>"}/integration${req.path}`,
          query: req.query,
          body: req.body ?? null,
          headers: {
            "X-API-Key": config.apiKey ? "***" : "(missing)",
            "Content-Type": req.body ? "application/json" : undefined,
          },
        }, null, 2),
      );
      return;
    }

    // Execute request
    requireConfig(config);
    const client = new UnifiClient(config.url, config.apiKey);

    try {
      let result: unknown;
      if (opts.all && cmd.paginatable) {
        result = await executeAllPages(cmd, execParams, client);
      } else {
        result = await executeCommand(cmd, execParams, client);
      }

      // Apply --fields
      const fields = globalOpts.fields ? (globalOpts.fields as string).split(",") : [];
      if (fields.length) result = pickFields(result, fields);

      const format = globalOpts.format as string;
      console.log(formatOutput(result, format));
    } catch (err: unknown) {
      const e = err as Error & { response?: unknown };
      if (e.response) {
        console.error(JSON.stringify({ error: e.message, detail: e.response }, null, 2));
      } else {
        console.error(JSON.stringify({ error: e.message }));
      }
      process.exit(1);
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveBody(data: string): Promise<unknown> {
  if (data === "-") {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  }
  if (data.startsWith("@")) {
    // Read from file
    const content = readFileSync(data.slice(1), "utf-8");
    return JSON.parse(content);
  }
  return JSON.parse(data);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const spec = loadSpec();
registerCommands(spec);

program.parseAsync(process.argv).catch((err) => {
  console.error(JSON.stringify({ error: String(err) }));
  process.exit(1);
});
