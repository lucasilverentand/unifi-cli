import type { CmdDef } from "./commands.ts";
import type { UnifiClient } from "./client.ts";
import { camelCase } from "./commands.ts";

export interface ExecuteParams {
  /** Site ID (used when cmd.needsSite is true) */
  siteId?: string;
  /** Positional path arguments keyed by name (e.g. { deviceId: "abc" }) */
  args: Record<string, string>;
  /** Pagination offset */
  offset?: string;
  /** Pagination limit */
  limit?: string;
  /** Filter expression */
  filter?: string;
  /** Extra query params (keyed by original param name) */
  extraQuery?: Record<string, string>;
  /** Request body (already parsed) */
  body?: unknown;
}

export interface ExecuteResult {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown | undefined;
}

/** Resolve path template and build query params without executing the request */
export function resolveRequest(cmd: CmdDef, params: ExecuteParams): ExecuteResult {
  let resolvedPath = cmd.path;

  // Substitute siteId
  if (cmd.needsSite) {
    const siteId = params.siteId || "default";
    resolvedPath = resolvedPath.replace("{siteId}", siteId);
  }

  // Substitute positional args
  for (const arg of cmd.args) {
    const val = params.args[arg.name];
    if (val) {
      resolvedPath = resolvedPath.replace(`{${arg.name}}`, val);
    }
  }

  // Build query params
  const query: Record<string, string> = {};
  if (cmd.paginatable) {
    if (params.offset !== undefined) query.offset = params.offset;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.filter) query.filter = params.filter;
  }
  for (const qp of cmd.extraQuery) {
    const val = params.extraQuery?.[qp.name] ?? params.extraQuery?.[camelCase(qp.name)];
    if (val !== undefined) query[qp.name] = val;
  }

  return {
    method: cmd.method,
    path: resolvedPath,
    query,
    body: cmd.hasBody ? params.body : undefined,
  };
}

/** Execute a single command and return the raw API response */
export async function executeCommand(
  cmd: CmdDef,
  params: ExecuteParams,
  client: UnifiClient,
): Promise<unknown> {
  const req = resolveRequest(cmd, params);
  return client.request({
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
  });
}

/** Auto-paginate: fetch all pages for a paginatable command and merge results */
export async function executeAllPages(
  cmd: CmdDef,
  params: ExecuteParams,
  client: UnifiClient,
  pageSize = 200,
): Promise<unknown> {
  if (!cmd.paginatable) {
    return executeCommand(cmd, params, client);
  }

  const allData: unknown[] = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pageParams: ExecuteParams = {
      ...params,
      offset: String(offset),
      limit: String(pageSize),
    };

    const result = await executeCommand(cmd, pageParams, client) as Record<string, unknown>;

    // Page response shape: { data: [...], offset, limit, count, totalCount }
    const data = result.data;
    if (Array.isArray(data)) {
      allData.push(...data);
      const totalCount = typeof result.totalCount === "number" ? result.totalCount : allData.length;
      if (allData.length >= totalCount || data.length < pageSize) {
        return { data: allData, totalCount };
      }
      offset += data.length;
    } else {
      // Not a page response — return as-is
      return result;
    }
  }
}
