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
    const url = new URL(`${base}/integration${options.path}`);
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

    const resp = await fetch(url.toString(), {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await resp.text();

    if (!resp.ok) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { statusCode: resp.status, message: text };
      }
      const err = new Error(`HTTP ${resp.status}`);
      (err as any).response = parsed;
      throw err;
    }

    if (!text) return {};
    return JSON.parse(text);
  }
}
