import { describe, expect, test, beforeAll, afterAll, mock } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { startMcpServer } from "../mcp.ts";
import { COMMANDS, toolName, cmdAllowedAtLevel } from "../commands.ts";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

// ---------------------------------------------------------------------------
// Set up an in-process MCP server + client using InMemoryTransport
// (unrestricted mode so all tools are visible for general tests)
// ---------------------------------------------------------------------------

let client: Client;
let server: Server;

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

beforeAll(async () => {
  Bun.env.UNIFI_PROTECTION = "unrestricted";
  // Start the MCP server with the in-memory transport
  server = await startMcpServer(serverTransport);

  // Connect a client
  client = new Client({ name: "test-client", version: "0.0.1" }, {});
  await client.connect(clientTransport);
});

afterAll(async () => {
  delete Bun.env.UNIFI_PROTECTION;
  await client.close();
  await server.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP server", () => {
  test("server capabilities include tools, resources, prompts", () => {
    const caps = client.getServerCapabilities();
    expect(caps).toBeDefined();
    expect(caps!.tools).toBeDefined();
    expect(caps!.resources).toBeDefined();
    expect(caps!.prompts).toBeDefined();
  });

  test("tools/list returns all tools with name, description, inputSchema", async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBe(COMMANDS.length);

    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(tool.inputSchema).toBeDefined();
    }
  });

  test("a body-bearing tool has real properties in inputSchema.body", async () => {
    const { tools } = await client.listTools();

    // devices_adopt is a POST with a body
    const adoptTool = tools.find((t) => t.name === "devices_adopt");
    expect(adoptTool).toBeDefined();

    const props = adoptTool!.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.body).toBeDefined();
    expect(props.body.type).toBe("object");
    // It should have real properties from the schema, not just a generic object
    expect(props.body.properties).toBeDefined();
    expect(Object.keys(props.body.properties as object).length).toBeGreaterThan(0);
  });

  test("resources/list returns 3 resources", async () => {
    const { resources } = await client.listResources();
    expect(resources.length).toBe(3);

    const uris = resources.map((r) => r.uri);
    expect(uris).toContain("unifi://info");
    expect(uris).toContain("unifi://sites");
    expect(uris).toContain("unifi://spec");
  });

  test("resources/templates/list returns 6 templates", async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.length).toBe(6);

    const uriTemplates = resourceTemplates.map((t) => t.uriTemplate);
    expect(uriTemplates).toContain("unifi://sites/{siteId}/devices");
    expect(uriTemplates).toContain("unifi://sites/{siteId}/networks");
    expect(uriTemplates).toContain("unifi://sites/{siteId}/clients");
    expect(uriTemplates).toContain("unifi://sites/{siteId}/firewall");
    expect(uriTemplates).toContain("unifi://sites/{siteId}/wifi");
    expect(uriTemplates).toContain("unifi://sites/{siteId}/vpn");
  });

  test("prompts/list returns 6 prompts with siteId argument", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.length).toBe(6);

    for (const prompt of prompts) {
      expect(prompt.arguments!.length).toBeGreaterThanOrEqual(1);
      expect(prompt.arguments![0].name).toBe("siteId");
    }
  });

  test("tools have annotations with readOnlyHint and destructiveHint", async () => {
    const { tools } = await client.listTools();

    // GET tool should be readOnly and NOT destructive
    const infoTool = tools.find((t) => t.name === "info");
    expect(infoTool).toBeDefined();
    expect((infoTool as any).annotations.readOnlyHint).toBe(true);
    expect((infoTool as any).annotations.destructiveHint).toBe(false);

    // Critical DELETE tool should be destructive
    const deleteTool = tools.find((t) => t.name === "networks_delete");
    expect(deleteTool).toBeDefined();
    expect((deleteTool as any).annotations.readOnlyHint).toBe(false);
    expect((deleteTool as any).annotations.destructiveHint).toBe(true);

    // Dangerous POST tool should also be destructive (risk-based)
    const createTool = tools.find((t) => t.name === "networks_create");
    expect(createTool).toBeDefined();
    expect((createTool as any).annotations.destructiveHint).toBe(true);
    expect((createTool as any).annotations.idempotentHint).toBe(false);

    // Moderate POST tool should NOT be destructive
    const moderateTool = tools.find((t) => t.name === "hotspot_create");
    expect(moderateTool).toBeDefined();
    expect((moderateTool as any).annotations.destructiveHint).toBe(false);

    // All tools should have openWorldHint=false
    for (const tool of tools) {
      expect((tool as any).annotations.openWorldHint).toBe(false);
    }
  });

  test("tool descriptions include group context and API reference", async () => {
    const { tools } = await client.listTools();

    const networksTool = tools.find((t) => t.name === "networks_list");
    expect(networksTool).toBeDefined();
    expect(networksTool!.description).toContain("Group: networks");
    expect(networksTool!.description).toContain("Related:");
    expect(networksTool!.description).toContain("API: GET");
  });

  test("prompts/get for audit-firewall returns messages with siteId substituted", async () => {
    const result = await client.getPrompt({
      name: "audit-firewall",
      arguments: { siteId: "my-site-42" },
    });
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("my-site-42");
  });
});

// ---------------------------------------------------------------------------
// Read-only mode tests (UNIFI_READ_ONLY=1 backwards compat)
// ---------------------------------------------------------------------------

const READ_COMMANDS = COMMANDS.filter((c) => c.risk === "read");
const NON_READ_COMMANDS = COMMANDS.filter((c) => c.risk !== "read");

describe("MCP server (read-only mode via UNIFI_READ_ONLY=1)", () => {
  let roClient: Client;
  let roServer: Server;

  beforeAll(async () => {
    Bun.env.UNIFI_READ_ONLY = "1";

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    roServer = await startMcpServer(sTransport);
    roClient = new Client({ name: "test-client-ro", version: "0.0.1" }, {});
    await roClient.connect(cTransport);
  });

  afterAll(async () => {
    delete Bun.env.UNIFI_READ_ONLY;
    await roClient.close();
    await roServer.close();
  });

  test("tools/list only returns read-risk commands", async () => {
    const { tools } = await roClient.listTools();
    expect(tools.length).toBe(READ_COMMANDS.length);

    const toolNames = new Set(tools.map((t) => t.name));
    // Verify no non-read tools are listed
    for (const cmd of NON_READ_COMMANDS) {
      expect(toolNames.has(toolName(cmd))).toBe(false);
    }
  });

  test("calling a write tool returns a protection error", async () => {
    const result = await roClient.callTool({
      name: "networks_create",
      arguments: { siteId: "default", body: { name: "test" } },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain("read");
    expect(parsed.error).toContain("dangerous");
  });

  test("calling a DELETE tool returns a protection error", async () => {
    const result = await roClient.callTool({
      name: "networks_delete",
      arguments: { siteId: "default", networkId: "abc" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain("read");
    expect(parsed.error).toContain("critical");
  });
});

// ---------------------------------------------------------------------------
// Tool execution tests (tools/call) — mocked fetch
// ---------------------------------------------------------------------------

describe("MCP tools/call", () => {
  let tcClient: Client;
  let tcServer: Server;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    Bun.env.UNIFI_URL = "https://unifi.local";
    Bun.env.UNIFI_API_KEY = "test-api-key-123";
    Bun.env.UNIFI_PROTECTION = "unrestricted";

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    tcServer = await startMcpServer(sTransport);
    tcClient = new Client({ name: "test-client-tc", version: "0.0.1" }, {});
    await tcClient.connect(cTransport);
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    delete Bun.env.UNIFI_URL;
    delete Bun.env.UNIFI_API_KEY;
    delete Bun.env.UNIFI_PROTECTION;
    await tcClient.close();
    await tcServer.close();
  });

  test("GET tool sends correct URL, headers, and returns response", async () => {
    const mockFetch = mock((url: URL | string, init?: RequestInit) => {
      return Promise.resolve(new Response(
        JSON.stringify({ hostname: "unifi-box", version: "9.0.1" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));
    });
    globalThis.fetch = mockFetch;

    const result = await tcClient.callTool({ name: "info", arguments: {} });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.hostname).toBe("unifi-box");
    expect(parsed.version).toBe("9.0.1");

    // Verify fetch was called with the right URL and headers
    // "info" does not need a site, so no site-resolution call — just one fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl.toString()).toBe("https://unifi.local/proxy/network/integration/v1/info");
    expect(calledInit.method).toBe("GET");
    expect(calledInit.headers["X-API-Key"]).toBe("test-api-key-123");
    expect(calledInit.headers["Accept"]).toBe("application/json");

    globalThis.fetch = originalFetch;
  });

  test("GET tool with path params sends correct URL", async () => {
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(
        JSON.stringify({ id: "dev-1", name: "USW-Pro-24" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));
    });
    globalThis.fetch = mockFetch;

    // Use a UUID-format siteId to skip site resolution fetch
    const result = await tcClient.callTool({
      name: "devices_get",
      arguments: { siteId: "88f7af54-0000-0000-0000-000000000000", deviceId: "dev-1" },
    });

    expect(result.isError).toBeFalsy();
    const [calledUrl] = mockFetch.mock.calls[0];
    expect(calledUrl.toString()).toBe(
      "https://unifi.local/proxy/network/integration/v1/sites/88f7af54-0000-0000-0000-000000000000/devices/dev-1",
    );

    globalThis.fetch = originalFetch;
  });

  test("POST tool with body sends body correctly", async () => {
    const mockFetch = mock((_url: URL | string, init?: RequestInit) => {
      return Promise.resolve(new Response(
        JSON.stringify({ id: "new-net-1" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));
    });
    globalThis.fetch = mockFetch;

    const body = { name: "My Network", purpose: "corporate", vlan: 100 };
    // Use UUID siteId to skip site resolution
    const result = await tcClient.callTool({
      name: "networks_create",
      arguments: { siteId: "88f7af54-0000-0000-0000-000000000000", body },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.id).toBe("new-net-1");

    // Verify body was sent (first and only fetch call is the actual POST)
    const [, calledInit] = mockFetch.mock.calls[0];
    expect(calledInit.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calledInit.body as string)).toEqual(body);

    globalThis.fetch = originalFetch;
  });

  test("paginatable tool auto-paginates when offset/limit omitted", async () => {
    let callCount = 0;
    const mockFetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(new Response(
          JSON.stringify({
            data: Array.from({ length: 200 }, (_, i) => ({ id: `site-${i}` })),
            offset: 0,
            limit: 200,
            count: 200,
            totalCount: 350,
          }),
          { status: 200 },
        ));
      }
      return Promise.resolve(new Response(
        JSON.stringify({
          data: Array.from({ length: 150 }, (_, i) => ({ id: `site-${200 + i}` })),
          offset: 200,
          limit: 200,
          count: 150,
          totalCount: 350,
        }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    const result = await tcClient.callTool({
      name: "sites_list",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.data.length).toBe(350);
    expect(parsed.totalCount).toBe(350);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify first call has offset=0&limit=200
    const firstUrl = mockFetch.mock.calls[0][0].toString();
    expect(firstUrl).toContain("offset=0");
    expect(firstUrl).toContain("limit=200");

    // Verify second call has offset=200
    const secondUrl = mockFetch.mock.calls[1][0].toString();
    expect(secondUrl).toContain("offset=200");
    expect(secondUrl).toContain("limit=200");

    globalThis.fetch = originalFetch;
  });

  test("paginatable tool with explicit offset/limit does NOT auto-paginate", async () => {
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(
        JSON.stringify({
          data: [{ id: "site-0" }, { id: "site-1" }],
          offset: 0,
          limit: 2,
          count: 2,
          totalCount: 100,
        }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    const result = await tcClient.callTool({
      name: "sites_list",
      arguments: { offset: 0, limit: 2 },
    });

    expect(result.isError).toBeFalsy();
    // Only one fetch call — no auto-pagination
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.data.length).toBe(2);

    globalThis.fetch = originalFetch;
  });

  test("unknown tool returns isError with message", async () => {
    const result = await tcClient.callTool({
      name: "nonexistent_tool",
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain("Unknown tool");
    expect(parsed.error).toContain("nonexistent_tool");
  });

  test("tool with extraQuery params sends them in URL", async () => {
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(
        JSON.stringify({ policyIds: ["p1", "p2"] }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    // Use UUID siteId to skip site resolution
    const result = await tcClient.callTool({
      name: "firewall_policies_ordering",
      arguments: {
        siteId: "88f7af54-0000-0000-0000-000000000000",
        sourceFirewallZoneId: "zone-a",
        destinationFirewallZoneId: "zone-b",
      },
    });

    expect(result.isError).toBeFalsy();
    // The only fetch call should be the actual API request
    const calledUrl = mockFetch.mock.calls[0][0].toString();
    expect(calledUrl).toContain("sourceFirewallZoneId=zone-a");
    expect(calledUrl).toContain("destinationFirewallZoneId=zone-b");

    globalThis.fetch = originalFetch;
  });

  test("API error is returned as isError", async () => {
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(
        JSON.stringify({ message: "Unauthorized" }),
        { status: 401 },
      ));
    });
    globalThis.fetch = mockFetch;

    const result = await tcClient.callTool({ name: "info", arguments: {} });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain("401");

    globalThis.fetch = originalFetch;
  });
});

// ---------------------------------------------------------------------------
// Missing config tests
// ---------------------------------------------------------------------------

describe("MCP tools/call (missing config)", () => {
  let ncClient: Client;
  let ncServer: Server;

  beforeAll(async () => {
    // Ensure env vars are NOT set
    delete Bun.env.UNIFI_URL;
    delete Bun.env.UNIFI_API_KEY;

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    ncServer = await startMcpServer(sTransport);
    ncClient = new Client({ name: "test-client-nc", version: "0.0.1" }, {});
    await ncClient.connect(cTransport);
  });

  afterAll(async () => {
    await ncClient.close();
    await ncServer.close();
  });

  test("calling a tool without UNIFI_URL/UNIFI_API_KEY returns config error", async () => {
    const result = await ncClient.callTool({ name: "info", arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain("Missing UniFi configuration");
    expect(parsed.hint).toContain("UNIFI_URL");
  });
});

// ---------------------------------------------------------------------------
// Resource reading tests (resources/read) — mocked fetch
// ---------------------------------------------------------------------------

describe("MCP resources/read", () => {
  let rrClient: Client;
  let rrServer: Server;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    Bun.env.UNIFI_URL = "https://unifi.local";
    Bun.env.UNIFI_API_KEY = "test-api-key-456";

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    rrServer = await startMcpServer(sTransport);
    rrClient = new Client({ name: "test-client-rr", version: "0.0.1" }, {});
    await rrClient.connect(cTransport);
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    delete Bun.env.UNIFI_URL;
    delete Bun.env.UNIFI_API_KEY;
    await rrClient.close();
    await rrServer.close();
  });

  test("read unifi://info returns JSON content", async () => {
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(
        JSON.stringify({ hostname: "unifi-gw", version: "9.0.2" }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    const result = await rrClient.readResource({ uri: "unifi://info" });

    expect(result.contents.length).toBe(1);
    expect(result.contents[0].uri).toBe("unifi://info");
    expect(result.contents[0].mimeType).toBe("application/json");
    const parsed = JSON.parse(result.contents[0].text as string);
    expect(parsed.hostname).toBe("unifi-gw");

    globalThis.fetch = originalFetch;
  });

  test("read unifi://sites auto-paginates and returns JSON content", async () => {
    let callCount = 0;
    const mockFetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(new Response(
          JSON.stringify({
            data: [{ id: "site-1", name: "Default" }],
            offset: 0,
            limit: 200,
            count: 1,
            totalCount: 1,
          }),
          { status: 200 },
        ));
      }
      // Should not be called, but just in case
      return Promise.resolve(new Response(
        JSON.stringify({ data: [], offset: 200, limit: 200, count: 0, totalCount: 1 }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    const result = await rrClient.readResource({ uri: "unifi://sites" });

    expect(result.contents.length).toBe(1);
    expect(result.contents[0].uri).toBe("unifi://sites");
    const parsed = JSON.parse(result.contents[0].text as string);
    expect(parsed.data).toBeArray();
    expect(parsed.data[0].name).toBe("Default");

    globalThis.fetch = originalFetch;
  });

  test("read unifi://spec returns the bundled OpenAPI spec (no fetch)", async () => {
    // Ensure no fetch is called — spec is loaded from disk
    const mockFetch = mock(() => {
      throw new Error("fetch should not be called for unifi://spec");
    });
    globalThis.fetch = mockFetch;

    const result = await rrClient.readResource({ uri: "unifi://spec" });

    expect(result.contents.length).toBe(1);
    expect(result.contents[0].uri).toBe("unifi://spec");
    expect(result.contents[0].mimeType).toBe("application/json");
    const parsed = JSON.parse(result.contents[0].text as string);
    // OpenAPI spec should have an "openapi" version field
    expect(parsed.openapi).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });

  test("read unifi://sites/{siteId}/devices returns JSON content", async () => {
    const mockFetch = mock((url: URL | string) => {
      const urlStr = url.toString();
      // Site resolution call (resolves non-UUID siteId)
      if (urlStr.includes("/v1/sites") && !urlStr.includes("/devices")) {
        return Promise.resolve(new Response(
          JSON.stringify({
            data: [{ id: "88f7af54-0000-0000-0000-000000000000", internalReference: "my-site" }],
            offset: 0, limit: 200, count: 1, totalCount: 1,
          }),
          { status: 200 },
        ));
      }
      return Promise.resolve(new Response(
        JSON.stringify({
          data: [{ id: "dev-1", name: "USW-24" }],
          offset: 0, limit: 200, count: 1, totalCount: 1,
        }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    const result = await rrClient.readResource({ uri: "unifi://sites/my-site/devices" });

    expect(result.contents.length).toBe(1);
    const parsed = JSON.parse(result.contents[0].text as string);
    expect(parsed.data[0].name).toBe("USW-24");

    // Last fetch call should be the devices request with the resolved UUID
    const lastCallUrl = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0].toString();
    expect(lastCallUrl).toContain("/devices");

    globalThis.fetch = originalFetch;
  });

  test("read unifi://sites/{siteId}/firewall returns composite zones + policies", async () => {
    const mockFetch = mock((url: URL | string) => {
      const urlStr = url.toString();
      if (urlStr.includes("/firewall/zones")) {
        return Promise.resolve(new Response(
          JSON.stringify({ data: [{ id: "zone-1", name: "LAN" }], offset: 0, limit: 200, count: 1, totalCount: 1 }),
          { status: 200 },
        ));
      }
      if (urlStr.includes("/firewall/policies")) {
        return Promise.resolve(new Response(
          JSON.stringify({ data: [{ id: "pol-1", action: "ALLOW" }], offset: 0, limit: 200, count: 1, totalCount: 1 }),
          { status: 200 },
        ));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [], offset: 0, limit: 200, count: 0, totalCount: 0 }), { status: 200 }));
    });
    globalThis.fetch = mockFetch;

    const result = await rrClient.readResource({ uri: "unifi://sites/88f7af54-0000-0000-0000-000000000000/firewall" });
    const parsed = JSON.parse(result.contents[0].text as string);
    expect(parsed.zones).toBeDefined();
    expect(parsed.policies).toBeDefined();
    expect(parsed.zones.data[0].name).toBe("LAN");
    expect(parsed.policies.data[0].action).toBe("ALLOW");

    globalThis.fetch = originalFetch;
  });

  test("read unifi://sites/{siteId}/wifi returns broadcasts", async () => {
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(
        JSON.stringify({ data: [{ id: "wifi-1", ssid: "MyNetwork" }], offset: 0, limit: 200, count: 1, totalCount: 1 }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    const result = await rrClient.readResource({ uri: "unifi://sites/88f7af54-0000-0000-0000-000000000000/wifi" });
    const parsed = JSON.parse(result.contents[0].text as string);
    expect(parsed.data[0].ssid).toBe("MyNetwork");

    globalThis.fetch = originalFetch;
  });

  test("read unifi://sites/{siteId}/vpn returns composite tunnels + servers", async () => {
    const mockFetch = mock((url: URL | string) => {
      const urlStr = url.toString();
      if (urlStr.includes("/site-to-site-tunnels")) {
        return Promise.resolve(new Response(
          JSON.stringify({ data: [{ id: "tun-1", name: "Office" }], offset: 0, limit: 200, count: 1, totalCount: 1 }),
          { status: 200 },
        ));
      }
      if (urlStr.includes("/vpn/servers")) {
        return Promise.resolve(new Response(
          JSON.stringify({ data: [{ id: "srv-1", type: "wireguard" }], offset: 0, limit: 200, count: 1, totalCount: 1 }),
          { status: 200 },
        ));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [], offset: 0, limit: 200, count: 0, totalCount: 0 }), { status: 200 }));
    });
    globalThis.fetch = mockFetch;

    const result = await rrClient.readResource({ uri: "unifi://sites/88f7af54-0000-0000-0000-000000000000/vpn" });
    const parsed = JSON.parse(result.contents[0].text as string);
    expect(parsed.tunnels).toBeDefined();
    expect(parsed.servers).toBeDefined();
    expect(parsed.tunnels.data[0].name).toBe("Office");
    expect(parsed.servers.data[0].type).toBe("wireguard");

    globalThis.fetch = originalFetch;
  });

  test("read unknown URI throws error", async () => {
    expect(
      rrClient.readResource({ uri: "unifi://nonexistent" }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Prompt coverage
// ---------------------------------------------------------------------------

describe("MCP prompts/get", () => {
  test("network-topology returns messages with siteId substituted", async () => {
    const result = await client.getPrompt({
      name: "network-topology",
      arguments: { siteId: "topo-site" },
    });
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("topo-site");
    expect(content.text).toContain("topology");
  });

  test("device-health returns messages with siteId substituted", async () => {
    const result = await client.getPrompt({
      name: "device-health",
      arguments: { siteId: "health-site" },
    });
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("health-site");
    expect(content.text).toContain("health");
  });

  test("troubleshoot-connectivity returns messages with siteId and optional target", async () => {
    const result = await client.getPrompt({
      name: "troubleshoot-connectivity",
      arguments: { siteId: "ts-site", target: "my-laptop" },
    });
    expect(result.messages.length).toBe(1);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("ts-site");
    expect(content.text).toContain("my-laptop");
    expect(content.text).toContain("OSI");
  });

  test("troubleshoot-connectivity without target mentions general connectivity", async () => {
    const result = await client.getPrompt({
      name: "troubleshoot-connectivity",
      arguments: { siteId: "ts-site" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("general connectivity");
  });

  test("wifi-optimization returns messages with siteId", async () => {
    const result = await client.getPrompt({
      name: "wifi-optimization",
      arguments: { siteId: "wifi-site" },
    });
    expect(result.messages.length).toBe(1);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("wifi-site");
    expect(content.text).toContain("WiFi");
  });

  test("security-hardening returns messages with siteId", async () => {
    const result = await client.getPrompt({
      name: "security-hardening",
      arguments: { siteId: "sec-site" },
    });
    expect(result.messages.length).toBe(1);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("sec-site");
    expect(content.text).toContain("hardening");
  });

  test("unknown prompt throws error", async () => {
    expect(
      client.getPrompt({ name: "nonexistent-prompt", arguments: {} }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tool inputSchema details
// ---------------------------------------------------------------------------

describe("MCP tool inputSchema details", () => {
  test("paginatable tool has offset/limit/filter properties", async () => {
    const { tools } = await client.listTools();
    const sitesTool = tools.find((t) => t.name === "sites_list");
    expect(sitesTool).toBeDefined();

    const props = sitesTool!.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.offset).toBeDefined();
    expect(props.offset.type).toBe("integer");
    expect(props.limit).toBeDefined();
    expect(props.limit.type).toBe("integer");
    expect(props.filter).toBeDefined();
    expect(props.filter.type).toBe("string");
  });

  test("tool with extraQuery has those params in inputSchema", async () => {
    const { tools } = await client.listTools();
    // firewall_policies_ordering has required extraQuery: sourceFirewallZoneId, destinationFirewallZoneId
    const orderingTool = tools.find((t) => t.name === "firewall_policies_ordering");
    expect(orderingTool).toBeDefined();

    const props = orderingTool!.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.sourceFirewallZoneId).toBeDefined();
    expect(props.sourceFirewallZoneId.type).toBe("string");
    expect(props.destinationFirewallZoneId).toBeDefined();
    expect(props.destinationFirewallZoneId.type).toBe("string");

    // These extraQuery params are required
    const required = orderingTool!.inputSchema.required as string[];
    expect(required).toContain("sourceFirewallZoneId");
    expect(required).toContain("destinationFirewallZoneId");
  });

  test("tool with needsSite has optional siteId property", async () => {
    const { tools } = await client.listTools();
    const devicesTool = tools.find((t) => t.name === "devices_list");
    expect(devicesTool).toBeDefined();

    const props = devicesTool!.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.siteId).toBeDefined();
    expect(props.siteId.type).toBe("string");

    // siteId should NOT be in required (it's optional, defaults from config)
    const required = devicesTool!.inputSchema.required as string[] | undefined;
    expect(required ?? []).not.toContain("siteId");
  });

  test("tool without body does NOT have body in inputSchema", async () => {
    const { tools } = await client.listTools();
    // "info" is a GET with no body
    const infoTool = tools.find((t) => t.name === "info");
    expect(infoTool).toBeDefined();

    const props = infoTool!.inputSchema.properties as Record<string, unknown>;
    expect(props.body).toBeUndefined();

    // Also no "body" in required
    const required = infoTool!.inputSchema.required as string[] | undefined;
    expect(required ?? []).not.toContain("body");
  });

  test("tool without needsSite does NOT have siteId in inputSchema", async () => {
    const { tools } = await client.listTools();
    // "info" does not need a site
    const infoTool = tools.find((t) => t.name === "info");
    expect(infoTool).toBeDefined();

    const props = infoTool!.inputSchema.properties as Record<string, unknown>;
    expect(props.siteId).toBeUndefined();
  });

  test("critical tool has confirmationToken in inputSchema", async () => {
    const { tools } = await client.listTools();
    const deleteTool = tools.find((t) => t.name === "networks_delete");
    expect(deleteTool).toBeDefined();

    const props = deleteTool!.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.confirmationToken).toBeDefined();
    expect(props.confirmationToken.type).toBe("string");

    // confirmationToken should NOT be required
    const required = deleteTool!.inputSchema.required as string[] | undefined;
    expect(required ?? []).not.toContain("confirmationToken");
  });

  test("non-critical tool does NOT have confirmationToken in inputSchema", async () => {
    const { tools } = await client.listTools();
    const createTool = tools.find((t) => t.name === "networks_create");
    expect(createTool).toBeDefined();

    const props = createTool!.inputSchema.properties as Record<string, unknown>;
    expect(props.confirmationToken).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Protection level tests
// ---------------------------------------------------------------------------

describe("MCP server (protection=safe)", () => {
  let safeClient: Client;
  let safeServer: Server;

  beforeAll(async () => {
    Bun.env.UNIFI_PROTECTION = "safe";

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    safeServer = await startMcpServer(sTransport);
    safeClient = new Client({ name: "test-client-safe", version: "0.0.1" }, {});
    await safeClient.connect(cTransport);
  });

  afterAll(async () => {
    delete Bun.env.UNIFI_PROTECTION;
    await safeClient.close();
    await safeServer.close();
  });

  test("tools/list returns read + moderate commands only", async () => {
    const { tools } = await safeClient.listTools();
    const expected = COMMANDS.filter((c) => cmdAllowedAtLevel(c, "safe"));
    expect(tools.length).toBe(expected.length);

    const toolNames = new Set(tools.map((t) => t.name));
    // Dangerous/critical tools should be hidden
    for (const cmd of COMMANDS.filter((c) => c.risk === "dangerous" || c.risk === "critical")) {
      expect(toolNames.has(toolName(cmd))).toBe(false);
    }
    // Moderate tools should be visible
    for (const cmd of COMMANDS.filter((c) => c.risk === "moderate")) {
      expect(toolNames.has(toolName(cmd))).toBe(true);
    }
  });

  test("calling a dangerous tool returns protection error", async () => {
    const result = await safeClient.callTool({
      name: "networks_create",
      arguments: { siteId: "default", body: { name: "test" } },
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.error).toContain("safe");
    expect(parsed.error).toContain("dangerous");
  });
});

describe("MCP server (protection=full)", () => {
  let fullClient: Client;
  let fullServer: Server;

  beforeAll(async () => {
    Bun.env.UNIFI_PROTECTION = "full";

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    fullServer = await startMcpServer(sTransport);
    fullClient = new Client({ name: "test-client-full", version: "0.0.1" }, {});
    await fullClient.connect(cTransport);
  });

  afterAll(async () => {
    delete Bun.env.UNIFI_PROTECTION;
    await fullClient.close();
    await fullServer.close();
  });

  test("tools/list returns read + moderate + dangerous commands, but not critical", async () => {
    const { tools } = await fullClient.listTools();
    const expected = COMMANDS.filter((c) => cmdAllowedAtLevel(c, "full"));
    expect(tools.length).toBe(expected.length);

    const toolNames = new Set(tools.map((t) => t.name));
    // Critical tools should be hidden
    for (const cmd of COMMANDS.filter((c) => c.risk === "critical")) {
      expect(toolNames.has(toolName(cmd))).toBe(false);
    }
    // Dangerous tools should be visible
    for (const cmd of COMMANDS.filter((c) => c.risk === "dangerous")) {
      expect(toolNames.has(toolName(cmd))).toBe(true);
    }
  });

  test("calling a critical tool returns protection error", async () => {
    const result = await fullClient.callTool({
      name: "networks_delete",
      arguments: { siteId: "default", networkId: "abc" },
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.error).toContain("full");
    expect(parsed.error).toContain("critical");
  });
});

describe("MCP server (protection=unrestricted)", () => {
  let urClient: Client;
  let urServer: Server;

  beforeAll(async () => {
    Bun.env.UNIFI_PROTECTION = "unrestricted";

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    urServer = await startMcpServer(sTransport);
    urClient = new Client({ name: "test-client-ur", version: "0.0.1" }, {});
    await urClient.connect(cTransport);
  });

  afterAll(async () => {
    delete Bun.env.UNIFI_PROTECTION;
    await urClient.close();
    await urServer.close();
  });

  test("tools/list returns all commands including critical", async () => {
    const { tools } = await urClient.listTools();
    expect(tools.length).toBe(COMMANDS.length);
  });
});

// ---------------------------------------------------------------------------
// Two-step confirmation flow tests
// ---------------------------------------------------------------------------

describe("MCP confirmation flow (critical operations)", () => {
  let cfClient: Client;
  let cfServer: Server;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    Bun.env.UNIFI_URL = "https://unifi.local";
    Bun.env.UNIFI_API_KEY = "test-api-key-cf";
    Bun.env.UNIFI_PROTECTION = "unrestricted";

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    cfServer = await startMcpServer(sTransport);
    cfClient = new Client({ name: "test-client-cf", version: "0.0.1" }, {});
    await cfClient.connect(cTransport);
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    delete Bun.env.UNIFI_URL;
    delete Bun.env.UNIFI_API_KEY;
    delete Bun.env.UNIFI_PROTECTION;
    await cfClient.close();
    await cfServer.close();
  });

  test("critical tool without token returns confirmation prompt", async () => {
    const result = await cfClient.callTool({
      name: "networks_delete",
      arguments: { siteId: "88f7af54-0000-0000-0000-000000000000", networkId: "net-1" },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.confirmation_required).toBe(true);
    expect(parsed.token).toBeDefined();
    expect(typeof parsed.token).toBe("string");
    expect(parsed.expires_in_seconds).toBe(30);
    expect(parsed.impact).toContain("Delete a network");
  });

  test("critical tool with valid token executes the operation", async () => {
    // Step 1: get confirmation token
    const step1 = await cfClient.callTool({
      name: "networks_delete",
      arguments: { siteId: "88f7af54-0000-0000-0000-000000000000", networkId: "net-2" },
    });
    const step1Parsed = JSON.parse((step1.content as { type: string; text: string }[])[0].text);
    const token = step1Parsed.token;

    // Step 2: mock the actual API call and confirm
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(
        JSON.stringify({ success: true }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    const step2 = await cfClient.callTool({
      name: "networks_delete",
      arguments: {
        siteId: "88f7af54-0000-0000-0000-000000000000",
        networkId: "net-2",
        confirmationToken: token,
      },
    });

    expect(step2.isError).toBeFalsy();
    expect(mockFetch).toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });

  test("invalid token returns error", async () => {
    const result = await cfClient.callTool({
      name: "networks_delete",
      arguments: {
        siteId: "88f7af54-0000-0000-0000-000000000000",
        networkId: "net-3",
        confirmationToken: "invalid-token-12345",
      },
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.error).toContain("Invalid or expired");
  });

  test("token for wrong tool returns error", async () => {
    // Get a token for networks_delete
    const step1 = await cfClient.callTool({
      name: "networks_delete",
      arguments: { siteId: "88f7af54-0000-0000-0000-000000000000", networkId: "net-4" },
    });
    const token = JSON.parse((step1.content as { type: string; text: string }[])[0].text).token;

    // Try to use it with a different critical tool
    const result = await cfClient.callTool({
      name: "devices_remove",
      arguments: {
        siteId: "88f7af54-0000-0000-0000-000000000000",
        deviceId: "dev-1",
        confirmationToken: token,
      },
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.error).toContain("networks_delete");
    expect(parsed.error).toContain("devices_remove");
  });

  test("token cannot be reused", async () => {
    // Step 1: get token
    const step1 = await cfClient.callTool({
      name: "networks_delete",
      arguments: { siteId: "88f7af54-0000-0000-0000-000000000000", networkId: "net-5" },
    });
    const token = JSON.parse((step1.content as { type: string; text: string }[])[0].text).token;

    // Step 2: use the token (succeeds)
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });
    globalThis.fetch = mockFetch;

    await cfClient.callTool({
      name: "networks_delete",
      arguments: {
        siteId: "88f7af54-0000-0000-0000-000000000000",
        networkId: "net-5",
        confirmationToken: token,
      },
    });

    globalThis.fetch = originalFetch;

    // Step 3: try to reuse the same token
    const reuse = await cfClient.callTool({
      name: "networks_delete",
      arguments: {
        siteId: "88f7af54-0000-0000-0000-000000000000",
        networkId: "net-5",
        confirmationToken: token,
      },
    });

    expect(reuse.isError).toBe(true);
    const parsed = JSON.parse((reuse.content as { type: string; text: string }[])[0].text);
    expect(parsed.error).toContain("Invalid or expired");
  });

  test("token for different arguments returns error", async () => {
    // Get a token for networkId "net-A"
    const step1 = await cfClient.callTool({
      name: "networks_delete",
      arguments: { siteId: "88f7af54-0000-0000-0000-000000000000", networkId: "net-A" },
    });
    const token = JSON.parse((step1.content as { type: string; text: string }[])[0].text).token;

    // Try to use it with networkId "net-B"
    const result = await cfClient.callTool({
      name: "networks_delete",
      arguments: {
        siteId: "88f7af54-0000-0000-0000-000000000000",
        networkId: "net-B",
        confirmationToken: token,
      },
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.error).toContain("different arguments");
  });

  test("non-critical tool does NOT require confirmation", async () => {
    const mockFetch = mock(() => {
      return Promise.resolve(new Response(
        JSON.stringify({ id: "new-net" }),
        { status: 200 },
      ));
    });
    globalThis.fetch = mockFetch;

    // networks_create is "dangerous" not "critical" — no confirmation needed
    const result = await cfClient.callTool({
      name: "networks_create",
      arguments: { siteId: "88f7af54-0000-0000-0000-000000000000", body: { name: "test" } },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as { type: string; text: string }[])[0].text);
    expect(parsed.confirmation_required).toBeUndefined();
    expect(parsed.id).toBe("new-net");

    globalThis.fetch = originalFetch;
  });
});
