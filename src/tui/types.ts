import type { Config } from "../config.ts";
import type { UnifiClient } from "../client.ts";

export type ViewId = "dashboard" | "devices" | "network" | "clients";

export interface NavigationState {
  activeView: ViewId;
  history: ViewId[];
}

export interface AppContext {
  config: Config & { url: string; apiKey: string };
  client: UnifiClient;
}

export interface ApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface Site {
  id: string;
  internalReference?: string;
  name?: string;
  description?: string;
}

export interface Device {
  id: string;
  name?: string;
  model?: string;
  status?: string;
  ip?: string;
  mac?: string;
  uptime?: number;
  cpuUtilizationPercent?: number;
  memoryUtilizationPercent?: number;
  type?: string;
  firmwareVersion?: string;
}

export interface Client {
  id: string;
  name?: string;
  ip?: string;
  mac?: string;
  type?: string;
  ssid?: string;
  signalStrength?: number;
  rxBytes?: number;
  txBytes?: number;
  uptime?: number;
  hostname?: string;
}

export interface Network {
  id: string;
  name?: string;
  vlanId?: number;
  subnet?: string;
  dhcpEnabled?: boolean;
  purpose?: string;
}

export type SubTab = "networks" | "firewall-zones" | "firewall-policies" | "dns" | "wifi";
