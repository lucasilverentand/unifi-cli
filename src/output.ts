/** Pick specific fields from objects/arrays/page responses */
export function pickFields(data: unknown, fields: string[]): unknown {
  if (!fields.length) return data;

  const pick = (obj: unknown): unknown => {
    if (typeof obj !== "object" || obj === null) return obj;
    const result: Record<string, unknown> = {};
    for (const f of fields) {
      if (f in (obj as Record<string, unknown>)) {
        result[f] = (obj as Record<string, unknown>)[f];
      }
    }
    return result;
  };

  if (Array.isArray(data)) return data.map(pick);

  if (isPage(data)) {
    const page = data as Record<string, unknown>;
    return { ...page, data: (page.data as unknown[]).map(pick) };
  }

  if (typeof data === "object" && data !== null) return pick(data);
  return data;
}

export function formatOutput(data: unknown, format: string): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "jsonl":
    case "json-compact":
      if (Array.isArray(data)) return data.map((d) => JSON.stringify(d)).join("\n");
      if (isPage(data)) return (data as any).data.map((d: unknown) => JSON.stringify(d)).join("\n");
      return JSON.stringify(data);
    case "table":
      return formatTable(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function isPage(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    Array.isArray((data as any).data)
  );
}

function formatTable(data: unknown): string {
  let items: Record<string, unknown>[];
  let meta = "";

  if (isPage(data)) {
    const page = data as any;
    items = page.data;
    meta = `(${page.count}/${page.totalCount} results, offset ${page.offset})`;
  } else if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === "object" && data !== null) {
    items = [data as Record<string, unknown>];
  } else {
    return String(data);
  }

  if (!items.length) return "(no results)";

  const keys = [...new Set(items.flatMap((item) => Object.keys(item)))];

  // Truncate values for table display
  const fmt = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const widths = keys.map((k) => {
    const vals = items.map((item) => fmt(item[k]));
    return Math.min(60, Math.max(k.length, ...vals.map((v) => v.length)));
  });

  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const sep = widths.map((w) => "─".repeat(w)).join("──");
  const rows = items.map((item) =>
    keys
      .map((k, i) => {
        const s = fmt(item[k]);
        return s.length > widths[i] ? s.slice(0, widths[i] - 1) + "…" : s.padEnd(widths[i]);
      })
      .join("  "),
  );

  const parts = [header, sep, ...rows];
  if (meta) parts.push("", meta);
  return parts.join("\n");
}
