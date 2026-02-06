import { describe, expect, test, mock } from "bun:test";
import { resolveRequest, executeAllPages, type ExecuteParams } from "../execute.ts";
import { COMMANDS, type CmdDef } from "../commands.ts";
import type { UnifiClient } from "../client.ts";

// Helpers
const devicesList = COMMANDS.find((c) => c.operationId === "getAdoptedDeviceOverviewPage")!;
const deviceGet = COMMANDS.find((c) => c.operationId === "getAdoptedDeviceDetails")!;
const getInfo = COMMANDS.find((c) => c.operationId === "getInfo")!;
const adoptDevice = COMMANDS.find((c) => c.operationId === "adoptDevice")!;
const deleteNetwork = COMMANDS.find((c) => c.operationId === "deleteNetwork")!;

describe("resolveRequest", () => {
  test("substitutes siteId in path", () => {
    const params: ExecuteParams = { siteId: "abc123", args: {} };
    const result = resolveRequest(devicesList, params);
    expect(result.path).toBe("/v1/sites/abc123/devices");
  });

  test("defaults siteId to 'default'", () => {
    const params: ExecuteParams = { args: {} };
    const result = resolveRequest(devicesList, params);
    expect(result.path).toBe("/v1/sites/default/devices");
  });

  test("substitutes positional args", () => {
    const params: ExecuteParams = {
      siteId: "s1",
      args: { deviceId: "dev42" },
    };
    const result = resolveRequest(deviceGet, params);
    expect(result.path).toBe("/v1/sites/s1/devices/dev42");
  });

  test("includes pagination query params", () => {
    const params: ExecuteParams = {
      args: {},
      offset: "10",
      limit: "50",
      filter: "name eq foo",
    };
    const result = resolveRequest(devicesList, params);
    expect(result.query.offset).toBe("10");
    expect(result.query.limit).toBe("50");
    expect(result.query.filter).toBe("name eq foo");
  });

  test("includes extra query params", () => {
    const params: ExecuteParams = {
      siteId: "s1",
      args: { networkId: "n1" },
      extraQuery: { force: "true" },
    };
    const result = resolveRequest(deleteNetwork, params);
    expect(result.query.force).toBe("true");
  });

  test("includes body for hasBody commands", () => {
    const params: ExecuteParams = {
      siteId: "s1",
      args: {},
      body: { mac: "00:11:22:33:44:55" },
    };
    const result = resolveRequest(adoptDevice, params);
    expect(result.body).toEqual({ mac: "00:11:22:33:44:55" });
  });

  test("omits body for non-hasBody commands", () => {
    const params: ExecuteParams = {
      args: {},
      body: { shouldBeIgnored: true },
    };
    const result = resolveRequest(getInfo, params);
    expect(result.body).toBeUndefined();
  });
});

describe("executeAllPages", () => {
  function mockClient(pages: Record<string, unknown>[]): UnifiClient {
    let callIndex = 0;
    return {
      request: mock(async () => pages[callIndex++]),
    } as unknown as UnifiClient;
  }

  test("merges multiple pages", async () => {
    const client = mockClient([
      { data: [{ id: 1 }, { id: 2 }], totalCount: 4 },
      { data: [{ id: 3 }, { id: 4 }], totalCount: 4 },
    ]);
    const params: ExecuteParams = { args: {} };
    const result = (await executeAllPages(devicesList, params, client, 2)) as Record<string, unknown>;
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
    expect(result.totalCount).toBe(4);
  });

  test("stops when totalCount reached", async () => {
    const client = mockClient([
      { data: [{ id: 1 }, { id: 2 }], totalCount: 2 },
    ]);
    const params: ExecuteParams = { args: {} };
    const result = (await executeAllPages(devicesList, params, client, 2)) as Record<string, unknown>;
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect((client.request as ReturnType<typeof mock>).mock.calls.length).toBe(1);
  });

  test("stops on short page", async () => {
    const client = mockClient([
      { data: [{ id: 1 }], totalCount: 100 },
    ]);
    const params: ExecuteParams = { args: {} };
    const result = (await executeAllPages(devicesList, params, client, 5)) as Record<string, unknown>;
    expect(result.data).toEqual([{ id: 1 }]);
    expect((client.request as ReturnType<typeof mock>).mock.calls.length).toBe(1);
  });

  test("passthrough for non-paginatable command", async () => {
    const client = mockClient([
      { hostname: "controller", version: "1.0" },
    ]);
    const params: ExecuteParams = { args: {} };
    const result = await executeAllPages(getInfo, params, client);
    expect(result).toEqual({ hostname: "controller", version: "1.0" });
  });
});
