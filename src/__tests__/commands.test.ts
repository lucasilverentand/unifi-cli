import { describe, expect, test } from "bun:test";
import { COMMANDS, camelCase, toolName } from "../commands.ts";

describe("camelCase", () => {
  test("kebab-case becomes camelCase", () => {
    expect(camelCase("firewall-zone")).toBe("firewallZone");
    expect(camelCase("api-key")).toBe("apiKey");
    expect(camelCase("a-b-c")).toBe("aBC");
  });

  test("already camelCase is unchanged", () => {
    expect(camelCase("siteId")).toBe("siteId");
    expect(camelCase("offset")).toBe("offset");
  });
});

describe("toolName", () => {
  test("grouped command produces group_action", () => {
    const cmd = COMMANDS.find((c) => c.group === "devices" && c.action === "list")!;
    expect(toolName(cmd)).toBe("devices_list");
  });

  test("top-level command produces just action", () => {
    const cmd = COMMANDS.find((c) => c.group === null && c.action === "info")!;
    expect(toolName(cmd)).toBe("info");
  });

  test("kebab group/action uses underscores", () => {
    const cmd = COMMANDS.find((c) => c.group === "firewall-zones" && c.action === "list")!;
    expect(toolName(cmd)).toBe("firewall_zones_list");
  });

  test("kebab action uses underscores", () => {
    const cmd = COMMANDS.find((c) => c.action === "delete-all")!;
    expect(toolName(cmd)).toBe("hotspot_delete_all");
  });
});

describe("COMMANDS", () => {
  test("is non-empty", () => {
    expect(COMMANDS.length).toBeGreaterThan(0);
  });

  test("all have operationId, method, and path", () => {
    for (const cmd of COMMANDS) {
      expect(cmd.operationId).toBeTruthy();
      expect(cmd.method).toBeTruthy();
      expect(cmd.path).toBeTruthy();
    }
  });

  test("no duplicate operationIds", () => {
    const ids = COMMANDS.map((c) => c.operationId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test("no duplicate toolNames", () => {
    const names = COMMANDS.map((c) => toolName(c));
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
