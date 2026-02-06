import { describe, expect, test } from "bun:test";
import {
  loadSpec,
  resolveRef,
  schemaName,
  getOperationBodyRef,
  getOperationResponseRef,
  findOperation,
  toJsonSchema,
  describeSchema,
  structuredSchema,
  type OpenAPISpec,
} from "../schema.ts";

const spec = loadSpec();

describe("loadSpec", () => {
  test("returns a valid spec with info.version", () => {
    expect(spec.info).toBeDefined();
    expect(typeof spec.info.version).toBe("string");
    expect(spec.info.version.length).toBeGreaterThan(0);
  });

  test("has paths", () => {
    expect(spec.paths).toBeDefined();
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  test("has components.schemas", () => {
    expect(spec.components).toBeDefined();
    expect(spec.components.schemas).toBeDefined();
    expect(Object.keys(spec.components.schemas).length).toBeGreaterThan(0);
  });
});

describe("resolveRef", () => {
  test("resolves a known schema", () => {
    const schemaNames = Object.keys(spec.components.schemas);
    const ref = `#/components/schemas/${schemaNames[0]}`;
    const resolved = resolveRef(spec, ref);
    expect(resolved).not.toBeNull();
  });

  test("returns null for unknown ref", () => {
    expect(resolveRef(spec, "#/components/schemas/NonExistentSchema999")).toBeNull();
  });
});

describe("schemaName", () => {
  test("strips #/components/schemas/ prefix", () => {
    expect(schemaName("#/components/schemas/DeviceInfo")).toBe("DeviceInfo");
  });

  test("returns string as-is if no prefix", () => {
    expect(schemaName("SomeName")).toBe("SomeName");
  });
});

describe("getOperationBodyRef", () => {
  test("extracts body ref from operation with request body", () => {
    const found = findOperation(spec, "adoptDevice");
    expect(found).not.toBeNull();
    const ref = getOperationBodyRef(found!.op);
    expect(ref).toBeDefined();
    expect(typeof ref).toBe("string");
    expect(ref!.startsWith("#/components/schemas/")).toBe(true);
  });

  test("returns undefined for operation without body", () => {
    const found = findOperation(spec, "getInfo");
    expect(found).not.toBeNull();
    expect(getOperationBodyRef(found!.op)).toBeUndefined();
  });
});

describe("getOperationResponseRef", () => {
  test("extracts 200/201 response ref", () => {
    const found = findOperation(spec, "getInfo");
    expect(found).not.toBeNull();
    const ref = getOperationResponseRef(found!.op);
    expect(ref).toBeDefined();
    expect(typeof ref).toBe("string");
    expect(ref!.startsWith("#/components/schemas/")).toBe(true);
  });
});

describe("findOperation", () => {
  test("finds by operationId", () => {
    const result = findOperation(spec, "getInfo");
    expect(result).not.toBeNull();
    expect(result!.method).toBe("get");
    expect(result!.path).toContain("/info");
  });

  test("returns null for missing operationId", () => {
    expect(findOperation(spec, "totallyFakeOperation")).toBeNull();
  });
});

describe("toJsonSchema", () => {
  test("object with properties", () => {
    const input = {
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "integer" },
      },
      required: ["name"],
    };
    const result = toJsonSchema(spec, input);
    expect(result.type).toBe("object");
    expect(result.properties).toBeDefined();
    const props = result.properties as Record<string, unknown>;
    expect(props.name).toEqual({ type: "string" });
    expect(props.count).toEqual({ type: "integer" });
    expect(result.required).toEqual(["name"]);
  });

  test("$ref is resolved inline", () => {
    const schemaNames = Object.keys(spec.components.schemas);
    const ref = `#/components/schemas/${schemaNames[0]}`;
    const result = toJsonSchema(spec, { $ref: ref });
    // Should not contain $ref anymore — it should be resolved
    expect(result.$ref).toBeUndefined();
    expect(typeof result.type === "string" || result.oneOf || result.anyOf || result.allOf).toBeTruthy();
  });

  test("enum produces type + enum", () => {
    const input = { type: "string", enum: ["a", "b", "c"] };
    const result = toJsonSchema(spec, input);
    expect(result.type).toBe("string");
    expect(result.enum).toEqual(["a", "b", "c"]);
  });

  test("array with items", () => {
    const input = { type: "array", items: { type: "string" } };
    const result = toJsonSchema(spec, input);
    expect(result.type).toBe("array");
    expect(result.items).toEqual({ type: "string" });
  });

  test("oneOf variant", () => {
    const input = {
      oneOf: [{ type: "string" }, { type: "integer" }],
    };
    const result = toJsonSchema(spec, input);
    expect(result.oneOf).toBeDefined();
    expect(result.oneOf).toEqual([{ type: "string" }, { type: "integer" }]);
  });

  test("anyOf variant", () => {
    const input = {
      anyOf: [{ type: "string" }, { type: "boolean" }],
    };
    const result = toJsonSchema(spec, input);
    expect(result.anyOf).toBeDefined();
    expect(result.anyOf).toEqual([{ type: "string" }, { type: "boolean" }]);
  });

  test("allOf variant", () => {
    const input = {
      allOf: [{ type: "object", properties: { a: { type: "string" } } }],
    };
    const result = toJsonSchema(spec, input);
    expect(result.allOf).toBeDefined();
  });

  test("depth limit returns { type: 'object' }", () => {
    const input = { type: "object", properties: { a: { type: "string" } } };
    const result = toJsonSchema(spec, input, 0);
    expect(result).toEqual({ type: "object" });
  });
});

describe("describeSchema", () => {
  test("returns non-empty string for a known schema", () => {
    const schemaNames = Object.keys(spec.components.schemas);
    // Find one with properties
    const withProps = schemaNames.find(
      (n) => Object.keys(spec.components.schemas[n].properties ?? {}).length > 0,
    );
    expect(withProps).toBeDefined();
    const result = describeSchema(spec, `#/components/schemas/${withProps}`);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("structuredSchema", () => {
  test("returns array of property objects", () => {
    const schemaNames = Object.keys(spec.components.schemas);
    const withProps = schemaNames.find(
      (n) => Object.keys(spec.components.schemas[n].properties ?? {}).length > 0,
    );
    expect(withProps).toBeDefined();
    const result = structuredSchema(spec, `#/components/schemas/${withProps}`);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("type");
    expect(result[0]).toHaveProperty("required");
  });
});
