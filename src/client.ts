export interface RequestOptions {
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

export class UnifiClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  buildUrl(options: RequestOptions): URL {
    const base = this.baseUrl.replace(/\/+$/, "");
    // If the base URL doesn't already include a path prefix (like /proxy/network),
    // add /proxy/network for UniFi OS gateways (UDM, UDR, UCG, etc.)
    const parsed = new URL(base);
    const prefix = parsed.pathname === "/" ? "/proxy/network" : "";
    const url = new URL(`${base}${prefix}/integration${options.path}`);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, v);
      }
    }
    return url;
  }

  async request(options: RequestOptions): Promise<unknown> {
    const url = this.buildUrl(options);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-API-Key": this.apiKey,
    };
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const resp = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!resp.ok) {
      let parsed: unknown;
      try {
        parsed = await resp.json();
      } catch {
        parsed = { statusCode: resp.status, message: await resp.text() };
      }
      const err = new Error(`HTTP ${resp.status}`);
      (err as any).response = parsed;
      throw err;
    }

    const text = await resp.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      const err = new Error(
        `Expected JSON from ${url.pathname} but got non-JSON response (status ${resp.status}). ` +
        `This usually means a TLS/certificate issue or wrong URL. ` +
        `Snippet: ${text.slice(0, 200)}`
      );
      (err as any).response = { statusCode: resp.status, body: text.slice(0, 500) };
      throw err;
    }
  }
}
