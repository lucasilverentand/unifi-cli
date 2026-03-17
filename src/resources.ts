// ---------------------------------------------------------------------------
// Resource definitions and handlers for the MCP server
// ---------------------------------------------------------------------------

import type { UnifiClient } from "./client.ts";
import { COMMANDS, type CmdDef } from "./commands.ts";
import { executeCommand, executeAllPages } from "./execute.ts";
import { loadSpec } from "./schema.ts";

export interface ResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceTemplateDef {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}

type ResourceContent = { uri: string; mimeType: string; text: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a CmdDef by operationId */
function findCmd(operationId: string): CmdDef | undefined {
  return COMMANDS.find((c) => c.operationId === operationId);
}

// ---------------------------------------------------------------------------
// Static Resources
// ---------------------------------------------------------------------------

export function getStaticResources(): ResourceDef[] {
  return [
    {
      uri: "unifi://info",
      name: "UniFi Network Application Info",
      description: "General info about the UniFi Network application (version, hostname, etc.)",
      mimeType: "application/json",
    },
    {
      uri: "unifi://sites",
      name: "Sites",
      description: "List all local UniFi sites",
      mimeType: "application/json",
    },
    {
      uri: "unifi://spec",
      name: "OpenAPI Specification",
      description: "The bundled OpenAPI spec used by the CLI",
      mimeType: "application/json",
    },
    {
      uri: "unifi://pending-devices",
      name: "Pending Devices",
      description: "Devices awaiting adoption across all sites",
      mimeType: "application/json",
    },
    {
      uri: "unifi://dpi/categories",
      name: "DPI Application Categories",
      description: "Reference list of Deep Packet Inspection application categories",
      mimeType: "application/json",
    },
  ];
}

// ---------------------------------------------------------------------------
// Resource Templates
// ---------------------------------------------------------------------------

export function getResourceTemplates(): ResourceTemplateDef[] {
  return [
    // ── Existing templates ────────────────────────────────────────────
    {
      uriTemplate: "unifi://sites/{siteId}/devices",
      name: "Devices",
      description: "List adopted devices on a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/networks",
      name: "Networks",
      description: "List all networks on a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/clients",
      name: "Clients",
      description: "List connected clients on a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/firewall",
      name: "Firewall",
      description: "Composite view of firewall zones and policies for a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/wifi",
      name: "WiFi",
      description: "List WiFi broadcasts (SSIDs) on a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/vpn",
      name: "VPN",
      description: "Composite view of VPN tunnels and servers for a site",
      mimeType: "application/json",
    },
    // ── New simple templates ──────────────────────────────────────────
    {
      uriTemplate: "unifi://sites/{siteId}/dns",
      name: "DNS Policies",
      description: "List DNS filtering policies for a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/acl",
      name: "ACL Rules",
      description: "List ACL rules for a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/hotspot",
      name: "Hotspot Vouchers",
      description: "List hotspot vouchers for a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/traffic-lists",
      name: "Traffic Matching Lists",
      description: "List traffic matching lists for a site",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/wans",
      name: "WAN Interfaces",
      description: "List WAN interfaces for a site",
      mimeType: "application/json",
    },
    // ── New composite templates ───────────────────────────────────────
    {
      uriTemplate: "unifi://sites/{siteId}/overview",
      name: "Site Overview",
      description: "Full site dashboard snapshot — networks, devices, client count, WANs, firewall zones, WiFi",
      mimeType: "application/json",
    },
    {
      uriTemplate: "unifi://sites/{siteId}/security",
      name: "Security Posture",
      description: "Complete security posture — firewall zones, policies, ACL rules, DNS policies, traffic lists",
      mimeType: "application/json",
    },
  ];
}

// ---------------------------------------------------------------------------
// Simple template lookup: URI suffix → operationId
// ---------------------------------------------------------------------------

const SIMPLE_TEMPLATE_MAP: Record<string, string> = {
  devices: "getAdoptedDeviceOverviewPage",
  networks: "getNetworksOverviewPage",
  clients: "getConnectedClientOverviewPage",
  dns: "getDnsPolicyPage",
  acl: "getAclRulePage",
  hotspot: "getVouchers",
  "traffic-lists": "getTrafficMatchingLists",
  wans: "getWansOverviewPage",
};

// ---------------------------------------------------------------------------
// ReadResource handler
// ---------------------------------------------------------------------------

export async function readResource(
  uri: string,
  client: UnifiClient,
  resolveSiteId: (id: string, client: UnifiClient) => Promise<string>,
): Promise<ResourceContent[]> {
  // ── Static resources ────────────────────────────────────────────────

  if (uri === "unifi://info") {
    const cmd = findCmd("getInfo");
    if (!cmd) throw new Error("getInfo command not found");
    const result = await executeCommand(cmd, { args: {} }, client);
    return [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }];
  }

  if (uri === "unifi://sites") {
    const cmd = findCmd("getSiteOverviewPage");
    if (!cmd) throw new Error("getSiteOverviewPage command not found");
    const result = await executeAllPages(cmd, { args: {} }, client);
    return [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }];
  }

  if (uri === "unifi://spec") {
    const spec = loadSpec();
    return [{ uri, mimeType: "application/json", text: JSON.stringify(spec, null, 2) }];
  }

  if (uri === "unifi://pending-devices") {
    const cmd = findCmd("getPendingDevicePage");
    if (!cmd) throw new Error("getPendingDevicePage command not found");
    const result = await executeAllPages(cmd, { args: {} }, client);
    return [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }];
  }

  if (uri === "unifi://dpi/categories") {
    const cmd = findCmd("getDpiApplicationCategories");
    if (!cmd) throw new Error("getDpiApplicationCategories command not found");
    const result = await executeAllPages(cmd, { args: {} }, client);
    return [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }];
  }

  // ── Simple templates: unifi://sites/{siteId}/<resource> ─────────────

  const simpleMatch = uri.match(/^unifi:\/\/sites\/([^/]+)\/([a-z-]+)$/);
  if (simpleMatch) {
    const [, rawSiteId, resource] = simpleMatch;
    const resolvedSiteId = await resolveSiteId(rawSiteId, client);
    const siteArgs = { siteId: resolvedSiteId, args: {} };

    // Check simple lookup table first
    if (resource in SIMPLE_TEMPLATE_MAP) {
      const cmd = findCmd(SIMPLE_TEMPLATE_MAP[resource]);
      if (!cmd) throw new Error(`Command not found for resource: ${resource}`);
      const result = await executeAllPages(cmd, siteArgs, client);
      return [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }];
    }

    // ── Composite templates ─────────────────────────────────────────

    if (resource === "firewall") {
      const [zones, policies] = await Promise.all([
        executeAllPages(findCmd("getFirewallZones")!, siteArgs, client),
        executeAllPages(findCmd("getFirewallPolicies")!, siteArgs, client),
      ]);
      return [{ uri, mimeType: "application/json", text: JSON.stringify({ zones, policies }, null, 2) }];
    }

    if (resource === "wifi") {
      const broadcasts = await executeAllPages(findCmd("getWifiBroadcastPage")!, siteArgs, client);
      return [{ uri, mimeType: "application/json", text: JSON.stringify(broadcasts, null, 2) }];
    }

    if (resource === "vpn") {
      const [tunnels, servers] = await Promise.all([
        executeAllPages(findCmd("getSiteToSiteVpnTunnelPage")!, siteArgs, client),
        executeAllPages(findCmd("getVpnServerPage")!, siteArgs, client),
      ]);
      return [{ uri, mimeType: "application/json", text: JSON.stringify({ tunnels, servers }, null, 2) }];
    }

    if (resource === "overview") {
      const [networks, devices, clients, wans, firewallZones, wifi] = await Promise.all([
        executeAllPages(findCmd("getNetworksOverviewPage")!, siteArgs, client),
        executeAllPages(findCmd("getAdoptedDeviceOverviewPage")!, siteArgs, client),
        executeAllPages(findCmd("getConnectedClientOverviewPage")!, siteArgs, client),
        executeAllPages(findCmd("getWansOverviewPage")!, siteArgs, client),
        executeAllPages(findCmd("getFirewallZones")!, siteArgs, client),
        executeAllPages(findCmd("getWifiBroadcastPage")!, siteArgs, client),
      ]);
      const clientCount = (clients as { data?: unknown[] }).data?.length ?? 0;
      return [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ networks, devices, clientCount, wans, firewallZones, wifi }, null, 2),
      }];
    }

    if (resource === "security") {
      const [firewallZones, firewallPolicies, aclRules, dnsPolicies, trafficLists] = await Promise.all([
        executeAllPages(findCmd("getFirewallZones")!, siteArgs, client),
        executeAllPages(findCmd("getFirewallPolicies")!, siteArgs, client),
        executeAllPages(findCmd("getAclRulePage")!, siteArgs, client),
        executeAllPages(findCmd("getDnsPolicyPage")!, siteArgs, client),
        executeAllPages(findCmd("getTrafficMatchingLists")!, siteArgs, client),
      ]);
      return [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ firewallZones, firewallPolicies, aclRules, dnsPolicies, trafficLists }, null, 2),
      }];
    }
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}
