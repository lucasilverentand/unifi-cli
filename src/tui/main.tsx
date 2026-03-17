import { render } from "ink";
import type { Config } from "../config.ts";
import { UnifiClient } from "../client.ts";
import { App } from "./app.tsx";

export async function startTui(config: Config & { url: string; apiKey: string }): Promise<void> {
  // UniFi controllers use self-signed certs
  Bun.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const client = new UnifiClient(config.url, config.apiKey);

  const { waitUntilExit } = render(
    <App config={config} client={client} />,
  );

  await waitUntilExit();
}
