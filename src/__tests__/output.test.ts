import { describe, expect, test } from "bun:test";
import { pickFields, formatOutput } from "../output.ts";

describe("pickFields", () => {
  test("flat object picks specified fields", () => {
    const data = { a: 1, b: 2, c: 3 };
    expect(pickFields(data, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  test("array picks fields from each element", () => {
    const data = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];
    expect(pickFields(data, ["a"])).toEqual([{ a: 1 }, { a: 3 }]);
  });

  test("page { data: [...] } picks from inner data", () => {
    const data = { data: [{ a: 1, b: 2 }, { a: 3, b: 4 }], totalCount: 2 };
    const result = pickFields(data, ["a"]) as Record<string, unknown>;
    expect(result.totalCount).toBe(2);
    expect(result.data).toEqual([{ a: 1 }, { a: 3 }]);
  });

  test("empty fields returns data unchanged", () => {
    const data = { a: 1, b: 2 };
    expect(pickFields(data, [])).toEqual({ a: 1, b: 2 });
  });
});

describe("formatOutput", () => {
  test("json format pretty-prints", () => {
    const data = { a: 1 };
    const result = formatOutput(data, "json");
    expect(result).toBe(JSON.stringify(data, null, 2));
  });

  test("jsonl format outputs one line per array element", () => {
    const data = [{ a: 1 }, { b: 2 }];
    const result = formatOutput(data, "jsonl");
    const lines = result.split("\n");
    expect(lines).toEqual([JSON.stringify({ a: 1 }), JSON.stringify({ b: 2 })]);
  });

  test("jsonl format handles page data", () => {
    const data = { data: [{ a: 1 }, { b: 2 }], totalCount: 2 };
    const result = formatOutput(data, "jsonl");
    const lines = result.split("\n");
    expect(lines).toEqual([JSON.stringify({ a: 1 }), JSON.stringify({ b: 2 })]);
  });

  test("table format has header, separator, and rows", () => {
    const data = [
      { name: "foo", value: 1 },
      { name: "bar", value: 2 },
    ];
    const result = formatOutput(data, "table");
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(4); // header + sep + 2 rows
    expect(lines[0]).toContain("name");
    expect(lines[0]).toContain("value");
    expect(lines[1]).toMatch(/─+/); // separator
    expect(lines[2]).toContain("foo");
    expect(lines[3]).toContain("bar");
  });

  test("table format handles empty array", () => {
    const result = formatOutput([], "table");
    expect(result).toBe("(no results)");
  });
});
