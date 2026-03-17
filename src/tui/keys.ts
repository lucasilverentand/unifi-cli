import type { ViewId } from "./types.ts";

export interface KeyBinding {
  key: string;
  label: string;
  description: string;
}

export const NAV_KEYS: Record<string, ViewId> = {
  "1": "dashboard",
  d: "dashboard",
  "2": "devices",
  v: "devices",
  "3": "network",
  n: "network",
  "4": "clients",
  c: "clients",
};

export const GLOBAL_KEYS: KeyBinding[] = [
  { key: "1/d", label: "Dashboard", description: "Switch to dashboard view" },
  { key: "2/v", label: "Devices", description: "Switch to devices view" },
  { key: "3/n", label: "Network", description: "Switch to network view" },
  { key: "4/c", label: "Clients", description: "Switch to clients view" },
  { key: "Tab", label: "Next tab", description: "Cycle to next tab" },
  { key: "r", label: "Refresh", description: "Refresh current view" },
  { key: "s", label: "Site", description: "Switch site" },
  { key: "/", label: "Search", description: "Open search" },
  { key: "?", label: "Help", description: "Show keyboard shortcuts" },
  { key: "q", label: "Quit", description: "Exit application" },
];

export const LIST_KEYS: KeyBinding[] = [
  { key: "j/\u2193", label: "Down", description: "Move cursor down" },
  { key: "k/\u2191", label: "Up", description: "Move cursor up" },
  { key: "Enter", label: "Select", description: "Open detail view" },
  { key: "Esc", label: "Back", description: "Return to list" },
  { key: "a", label: "Actions", description: "Open action menu" },
];

export const VIEW_ORDER: ViewId[] = ["dashboard", "devices", "network", "clients"];

export function nextView(current: ViewId): ViewId {
  const idx = VIEW_ORDER.indexOf(current);
  return VIEW_ORDER[(idx + 1) % VIEW_ORDER.length];
}
