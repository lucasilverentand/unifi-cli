import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProtectionLevel } from "./commands.ts";

export interface Config {
  url?: string;
  apiKey?: string;
  site: string;
  insecure?: boolean;
  readOnly?: boolean;
  protection: ProtectionLevel;
}

const CONFIG_DIR = join(Bun.env.HOME ?? "~", ".config", "unifi-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function loadFileConfig(): Partial<Config> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveConfig(config: Partial<Config>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = loadFileConfig();
  const merged = { ...existing, ...config };
  Bun.write(CONFIG_FILE, JSON.stringify(merged, null, 2) + "\n");
}

const VALID_PROTECTION_LEVELS = new Set(["read", "safe", "full", "unrestricted"]);

export function resolveConfig(cliOpts: Record<string, unknown>): Config {
  const file = loadFileConfig();
  const readOnly = !!(cliOpts.readOnly || Bun.env.UNIFI_READ_ONLY === "1" || file.readOnly);

  // Resolve protection level: UNIFI_READ_ONLY=1 → "read" (backwards compat)
  let protection: ProtectionLevel = "full";
  const envProtection = Bun.env.UNIFI_PROTECTION;
  const fileProtection = (file as Record<string, unknown>).protection as string | undefined;
  const cliProtection = cliOpts.protection as string | undefined;

  if (cliProtection && VALID_PROTECTION_LEVELS.has(cliProtection)) {
    protection = cliProtection as ProtectionLevel;
  } else if (envProtection && VALID_PROTECTION_LEVELS.has(envProtection)) {
    protection = envProtection as ProtectionLevel;
  } else if (fileProtection && VALID_PROTECTION_LEVELS.has(fileProtection)) {
    protection = fileProtection as ProtectionLevel;
  }

  // UNIFI_READ_ONLY=1 overrides to "read" for backwards compatibility
  if (readOnly) {
    protection = "read";
  }

  return {
    url: (cliOpts.url as string) || Bun.env.UNIFI_URL || file.url,
    apiKey:
      (cliOpts.apiKey as string) || Bun.env.UNIFI_API_KEY || file.apiKey,
    site:
      (cliOpts.site as string) ||
      Bun.env.UNIFI_SITE ||
      file.site ||
      "default",
    insecure:
      !!(cliOpts.insecure || Bun.env.UNIFI_INSECURE === "1" || file.insecure),
    readOnly,
    protection,
  };
}

export function requireConfig(config: Config): asserts config is Config & { url: string; apiKey: string } {
  if (!config.url) {
    console.error(
      JSON.stringify({
        error: "Missing UniFi controller URL. Set via --url, UNIFI_URL env var, or run: unifi-cli configure",
      })
    );
    process.exit(1);
  }
  if (!config.apiKey) {
    console.error(
      JSON.stringify({
        error: "Missing API key. Set via --api-key, UNIFI_API_KEY env var, or run: unifi-cli configure",
      })
    );
    process.exit(1);
  }
}
