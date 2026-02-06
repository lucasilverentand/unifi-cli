import { readFileSync } from "node:fs";

export interface OpenAPISpec {
  info: { title: string; version: string };
  paths: Record<string, Record<string, OperationObject>>;
  components: { schemas: Record<string, SchemaObject> };
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: { content: Record<string, { schema: SchemaRef }> };
  responses?: Record<string, { content?: Record<string, { schema: SchemaRef }> }>;
}

export interface ParameterObject {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: SchemaRef;
}

export interface SchemaRef {
  $ref?: string;
  type?: string;
  enum?: string[];
  properties?: Record<string, SchemaRef>;
  required?: string[];
  items?: SchemaRef;
  description?: string;
  oneOf?: SchemaRef[];
  anyOf?: SchemaRef[];
  allOf?: SchemaRef[];
}

export type SchemaObject = SchemaRef;

let _spec: OpenAPISpec | null = null;

export function loadSpec(): OpenAPISpec {
  if (_spec) return _spec;
  const specPath = `${import.meta.dir}/../openapi.json`;
  _spec = JSON.parse(readFileSync(specPath, "utf-8"));
  return _spec!;
}

export function resolveRef(spec: OpenAPISpec, ref: string): SchemaObject | null {
  const name = ref.replace("#/components/schemas/", "");
  return spec.components.schemas[name] ?? null;
}

export function schemaName(ref: string): string {
  return ref.replace("#/components/schemas/", "");
}

export function getOperationBodyRef(op: OperationObject): string | undefined {
  const content = op.requestBody?.content;
  if (!content) return undefined;
  const json = content["application/json"];
  return json?.schema?.$ref;
}

export function getOperationResponseRef(op: OperationObject): string | undefined {
  for (const code of ["200", "201"]) {
    const resp = op.responses?.[code];
    const content = resp?.content;
    if (!content) continue;
    const json = content["application/json"];
    if (json?.schema?.$ref) return json.schema.$ref;
  }
  return undefined;
}

/** Flatten a schema into a list of property descriptions for help text */
export function describeSchema(
  spec: OpenAPISpec,
  ref: string,
  maxDepth = 2,
): string {
  const schema = resolveRef(spec, ref);
  if (!schema) return `  (schema not found: ${ref})`;
  return describeSchemaObject(spec, schema, "", maxDepth);
}

function describeSchemaObject(
  spec: OpenAPISpec,
  schema: SchemaObject,
  indent: string,
  depth: number,
): string {
  const lines: string[] = [];
  const required = new Set(schema.required ?? []);
  const props = schema.properties ?? {};

  for (const [name, prop] of Object.entries(props)) {
    const req = required.has(name) ? "*" : " ";
    const type = propType(spec, prop);
    const desc = prop.description ? `  ${prop.description.split("\n")[0].slice(0, 70)}` : "";
    lines.push(`${indent}  ${req} ${name}: ${type}${desc}`);
  }

  // Handle oneOf/anyOf
  for (const key of ["oneOf", "anyOf"] as const) {
    const variants = schema[key];
    if (variants) {
      const names = variants
        .map((v) => (v.$ref ? schemaName(v.$ref) : v.type ?? "?"))
        .join(" | ");
      lines.push(`${indent}  (${key}: ${names})`);
      if (depth > 0) {
        for (const v of variants) {
          if (v.$ref) {
            const resolved = resolveRef(spec, v.$ref);
            if (resolved && Object.keys(resolved.properties ?? {}).length > 0) {
              lines.push(`${indent}  --- ${schemaName(v.$ref)} ---`);
              lines.push(describeSchemaObject(spec, resolved, indent + "  ", depth - 1));
            }
          }
        }
      }
    }
  }

  return lines.join("\n");
}

function propType(spec: OpenAPISpec, prop: SchemaRef): string {
  if (prop.$ref) return schemaName(prop.$ref);
  if (prop.enum) return `${prop.type ?? "string"} [${prop.enum.join("|")}]`;
  if (prop.type === "array") {
    const items = prop.items;
    if (items?.$ref) return `array<${schemaName(items.$ref)}>`;
    return `array<${items?.type ?? "?"}>`;
  }
  return prop.type ?? "object";
}

/** Return structured schema info (for JSON output) */
export function structuredSchema(
  spec: OpenAPISpec,
  ref: string,
  maxDepth = 2,
): Record<string, unknown>[] {
  const schema = resolveRef(spec, ref);
  if (!schema) return [];
  return structuredProps(spec, schema, maxDepth);
}

function structuredProps(
  spec: OpenAPISpec,
  schema: SchemaObject,
  depth: number,
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const required = new Set(schema.required ?? []);
  const props = schema.properties ?? {};

  for (const [name, prop] of Object.entries(props)) {
    const entry: Record<string, unknown> = {
      name,
      type: propType(spec, prop),
      required: required.has(name),
    };
    if (prop.description) entry.description = prop.description.split("\n")[0];
    if (prop.enum) entry.enum = prop.enum;
    if (prop.$ref && depth > 0) {
      const resolved = resolveRef(spec, prop.$ref);
      if (resolved && Object.keys(resolved.properties ?? {}).length > 0) {
        entry.properties = structuredProps(spec, resolved, depth - 1);
      }
    }
    result.push(entry);
  }

  // Handle oneOf/anyOf
  for (const key of ["oneOf", "anyOf"] as const) {
    const variants = schema[key];
    if (variants) {
      const variantInfos: Record<string, unknown>[] = [];
      for (const v of variants) {
        if (v.$ref) {
          const info: Record<string, unknown> = { name: schemaName(v.$ref) };
          if (depth > 0) {
            const resolved = resolveRef(spec, v.$ref);
            if (resolved && Object.keys(resolved.properties ?? {}).length > 0) {
              info.properties = structuredProps(spec, resolved, depth - 1);
            }
          }
          variantInfos.push(info);
        }
      }
      if (variantInfos.length) {
        result.push({ _discriminator: key, variants: variantInfos });
      }
    }
  }

  return result;
}

/** Convert an OpenAPI schema/ref into a self-contained JSON Schema object */
export function toJsonSchema(
  spec: OpenAPISpec,
  schemaOrRef: SchemaRef,
  maxDepth = 3,
  _seen?: Set<string>,
): Record<string, unknown> {
  const seen = _seen ?? new Set<string>();

  // Depth guard
  if (maxDepth <= 0) return { type: "object" };

  // Resolve $ref
  if (schemaOrRef.$ref) {
    if (seen.has(schemaOrRef.$ref)) return { type: "object" };
    seen.add(schemaOrRef.$ref);
    const resolved = resolveRef(spec, schemaOrRef.$ref);
    if (!resolved) return { type: "object" };
    return toJsonSchema(spec, resolved, maxDepth - 1, seen);
  }

  // oneOf / anyOf / allOf
  for (const key of ["oneOf", "anyOf", "allOf"] as const) {
    const variants = schemaOrRef[key];
    if (variants) {
      return {
        [key]: variants.map((v) => toJsonSchema(spec, v, maxDepth - 1, new Set(seen))),
      };
    }
  }

  // Array
  if (schemaOrRef.type === "array") {
    const result: Record<string, unknown> = { type: "array" };
    if (schemaOrRef.items) {
      result.items = toJsonSchema(spec, schemaOrRef.items, maxDepth - 1, new Set(seen));
    }
    return result;
  }

  // Object (or has properties)
  if (schemaOrRef.type === "object" || schemaOrRef.properties) {
    const result: Record<string, unknown> = { type: "object" };
    if (schemaOrRef.properties) {
      const props: Record<string, unknown> = {};
      for (const [name, prop] of Object.entries(schemaOrRef.properties)) {
        props[name] = toJsonSchema(spec, prop, maxDepth - 1, new Set(seen));
      }
      result.properties = props;
    }
    if (schemaOrRef.required) result.required = schemaOrRef.required;
    if (schemaOrRef.description) result.description = schemaOrRef.description;
    return result;
  }

  // Enum
  if (schemaOrRef.enum) {
    const result: Record<string, unknown> = {
      type: schemaOrRef.type ?? "string",
      enum: schemaOrRef.enum,
    };
    if (schemaOrRef.description) result.description = schemaOrRef.description;
    return result;
  }

  // Primitive
  const result: Record<string, unknown> = { type: schemaOrRef.type ?? "object" };
  if (schemaOrRef.description) result.description = schemaOrRef.description;
  return result;
}

/** Find an operation by operationId */
export function findOperation(
  spec: OpenAPISpec,
  operationId: string,
): { path: string; method: string; op: OperationObject } | null {
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (op.operationId === operationId) {
        return { path, method, op };
      }
    }
  }
  return null;
}
