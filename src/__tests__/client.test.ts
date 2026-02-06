import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { UnifiClient } from "../client.ts";

describe("UnifiClient", () => {
  const client = new UnifiClient("https://192.168.1.1", "test-api-key");

  describe("buildUrl", () => {
    test("correct base + path (auto-adds /proxy/network for bare hosts)", () => {
      const url = client.buildUrl({ method: "GET", path: "/v1/info" });
      expect(url.toString()).toBe("https://192.168.1.1/proxy/network/integration/v1/info");
    });

    test("appends query params", () => {
      const url = client.buildUrl({
        method: "GET",
        path: "/v1/sites",
        query: { offset: "0", limit: "25" },
      });
      expect(url.searchParams.get("offset")).toBe("0");
      expect(url.searchParams.get("limit")).toBe("25");
    });

    test("skips undefined and empty query values", () => {
      const url = client.buildUrl({
        method: "GET",
        path: "/v1/sites",
        query: { offset: "0", limit: undefined, filter: "" },
      });
      expect(url.searchParams.get("offset")).toBe("0");
      expect(url.searchParams.has("limit")).toBe(false);
      expect(url.searchParams.has("filter")).toBe(false);
    });

    test("strips trailing slashes from base URL", () => {
      const c = new UnifiClient("https://192.168.1.1///", "key");
      const url = c.buildUrl({ method: "GET", path: "/v1/info" });
      expect(url.toString()).toBe("https://192.168.1.1/proxy/network/integration/v1/info");
    });

    test("does NOT add /proxy/network when base URL has a path", () => {
      const c = new UnifiClient("https://unifi.example.com/proxy/network", "key");
      const url = c.buildUrl({ method: "GET", path: "/v1/info" });
      expect(url.toString()).toBe("https://unifi.example.com/proxy/network/integration/v1/info");
    });
  });

  describe("request", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("sends correct headers", async () => {
      let capturedInit: RequestInit | undefined;
      globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
        capturedInit = init;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch;

      await client.request({ method: "GET", path: "/v1/info" });
      const headers = capturedInit?.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/json");
      expect(headers["X-API-Key"]).toBe("test-api-key");
    });

    test("sets Content-Type for body requests", async () => {
      let capturedInit: RequestInit | undefined;
      globalThis.fetch = mock(async (_input: string | URL | Request, init?: RequestInit) => {
        capturedInit = init;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch;

      await client.request({
        method: "POST",
        path: "/v1/sites/default/devices",
        body: { mac: "00:11:22:33:44:55" },
      });
      const headers = capturedInit?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(capturedInit?.body).toBe(JSON.stringify({ mac: "00:11:22:33:44:55" }));
    });

    test("returns {} for empty response", async () => {
      globalThis.fetch = mock(async () => {
        return new Response("", { status: 200 });
      }) as typeof fetch;

      const result = await client.request({ method: "DELETE", path: "/v1/sites/s/networks/n" });
      expect(result).toEqual({});
    });

    test("throws error with JSON body on failure", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
      }) as typeof fetch;

      try {
        await client.request({ method: "GET", path: "/v1/info" });
        expect(true).toBe(false); // should not reach
      } catch (err: unknown) {
        const e = err as Error & { response?: unknown };
        expect(e.message).toBe("HTTP 404");
        expect(e.response).toEqual({ message: "Not found" });
      }
    });

    test("throws error with text fallback on non-JSON failure", async () => {
      globalThis.fetch = mock(async () => {
        // Return a response where json() fails but text() succeeds.
        // A plain Response consumes the body on the first read, so we
        // build a thin wrapper that lets both calls work independently.
        return {
          ok: false,
          status: 500,
          json: async () => { throw new SyntaxError("Unexpected token"); },
          text: async () => "Internal Server Error",
        } as unknown as Response;
      }) as typeof fetch;

      try {
        await client.request({ method: "GET", path: "/v1/info" });
        expect(true).toBe(false);
      } catch (err: unknown) {
        const e = err as Error & { response?: unknown };
        expect(e.message).toBe("HTTP 500");
        expect((e.response as Record<string, unknown>).statusCode).toBe(500);
        expect((e.response as Record<string, unknown>).message).toBe("Internal Server Error");
      }
    });
  });
});
