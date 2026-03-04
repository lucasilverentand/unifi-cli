import { describe, expect, test } from "bun:test";
import { COMMANDS, camelCase, toolName, buildToolAnnotations, buildToolDescription, RELATED_GROUPS, GROUP_DESCRIPTIONS } from "../commands.ts";

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

describe("buildToolAnnotations", () => {
  test("GET command is readOnly, not destructive, idempotent", () => {
    const cmd = COMMANDS.find((c) => c.method === "GET")!;
    const ann = buildToolAnnotations(cmd);
    expect(ann.readOnlyHint).toBe(true);
    expect(ann.destructiveHint).toBe(false);
    expect(ann.idempotentHint).toBe(true);
    expect(ann.openWorldHint).toBe(false);
  });

  test("DELETE command is destructive, not readOnly, idempotent", () => {
    const cmd = COMMANDS.find((c) => c.method === "DELETE")!;
    const ann = buildToolAnnotations(cmd);
    expect(ann.readOnlyHint).toBe(false);
    expect(ann.destructiveHint).toBe(true);
    expect(ann.idempotentHint).toBe(true);
  });

  test("POST command is not readOnly, not idempotent", () => {
    const cmd = COMMANDS.find((c) => c.method === "POST")!;
    const ann = buildToolAnnotations(cmd);
    expect(ann.readOnlyHint).toBe(false);
    expect(ann.idempotentHint).toBe(false);
  });

  test("PUT command is idempotent, not readOnly", () => {
    const cmd = COMMANDS.find((c) => c.method === "PUT")!;
    const ann = buildToolAnnotations(cmd);
    expect(ann.readOnlyHint).toBe(false);
    expect(ann.idempotentHint).toBe(true);
  });

  test("title matches command summary", () => {
    const cmd = COMMANDS.find((c) => c.operationId === "getInfo")!;
    const ann = buildToolAnnotations(cmd);
    expect(ann.title).toBe(cmd.summary);
  });
});

describe("buildToolDescription", () => {
  test("grouped command includes group context and related groups", () => {
    const cmd = COMMANDS.find((c) => c.group === "networks" && c.action === "list")!;
    const desc = buildToolDescription(cmd);
    expect(desc).toContain(cmd.summary);
    expect(desc).toContain("Group: networks");
    expect(desc).toContain(GROUP_DESCRIPTIONS.networks);
    expect(desc).toContain("Related:");
    for (const rel of RELATED_GROUPS.networks) {
      expect(desc).toContain(rel);
    }
    expect(desc).toContain(`API: ${cmd.method} ${cmd.path}`);
  });

  test("top-level command has no group context", () => {
    const cmd = COMMANDS.find((c) => c.group === null && c.action === "info")!;
    const desc = buildToolDescription(cmd);
    expect(desc).toContain(cmd.summary);
    expect(desc).toContain(`API: GET`);
    expect(desc).not.toContain("Group:");
    expect(desc).not.toContain("Related:");
  });
});
