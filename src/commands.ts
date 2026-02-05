// ---------------------------------------------------------------------------
// Command registry — auto-derived from the OpenAPI spec
// ---------------------------------------------------------------------------

export interface CmdDef {
  /** Command group (null = top-level command) */
  group: string | null;
  /** Action name (e.g. "list", "get", "create") */
  action: string;
  /** OpenAPI operationId */
  operationId: string;
  /** HTTP method */
  method: string;
  /** URL path template */
  path: string;
  /** Human-readable summary */
  summary: string;
  /** Positional CLI arguments (path params excluding siteId) */
  args: { name: string; desc: string }[];
  /** Whether the endpoint requires a siteId path param */
  needsSite: boolean;
  /** Whether it supports offset/limit/filter query params */
  paginatable: boolean;
  /** Whether it accepts a JSON request body */
  hasBody: boolean;
  /** Extra query params beyond standard pagination */
  extraQuery: { name: string; required: boolean; desc: string }[];
}

export const COMMANDS: CmdDef[] = [
  // ── Application Info ────────────────────────────────────────────────
  {
    group: null, action: "info", operationId: "getInfo",
    method: "GET", path: "/v1/info",
    summary: "Show UniFi Network application info",
    args: [], needsSite: false, paginatable: false, hasBody: false, extraQuery: [],
  },

  // ── Sites ───────────────────────────────────────────────────────────
  {
    group: "sites", action: "list", operationId: "getSiteOverviewPage",
    method: "GET", path: "/v1/sites",
    summary: "List all local sites (site IDs are needed for most commands)",
    args: [], needsSite: false, paginatable: true, hasBody: false, extraQuery: [],
  },

  // ── Devices ─────────────────────────────────────────────────────────
  {
    group: "devices", action: "list", operationId: "getAdoptedDeviceOverviewPage",
    method: "GET", path: "/v1/sites/{siteId}/devices",
    summary: "List adopted devices on a site",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "devices", action: "get", operationId: "getAdoptedDeviceDetails",
    method: "GET", path: "/v1/sites/{siteId}/devices/{deviceId}",
    summary: "Get detailed info for an adopted device",
    args: [{ name: "deviceId", desc: "Device ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "devices", action: "adopt", operationId: "adoptDevice",
    method: "POST", path: "/v1/sites/{siteId}/devices",
    summary: "Adopt a device to a site",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "devices", action: "remove", operationId: "removeDevice",
    method: "DELETE", path: "/v1/sites/{siteId}/devices/{deviceId}",
    summary: "Remove (unadopt) a device — resets to factory defaults if online",
    args: [{ name: "deviceId", desc: "Device ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "devices", action: "stats", operationId: "getAdoptedDeviceLatestStatistics",
    method: "GET", path: "/v1/sites/{siteId}/devices/{deviceId}/statistics/latest",
    summary: "Get latest real-time statistics (CPU, memory, uptime, throughput)",
    args: [{ name: "deviceId", desc: "Device ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "devices", action: "action", operationId: "executeAdoptedDeviceAction",
    method: "POST", path: "/v1/sites/{siteId}/devices/{deviceId}/actions",
    summary: "Execute an action on a device (e.g. restart)",
    args: [{ name: "deviceId", desc: "Device ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "devices", action: "port-action", operationId: "executePortAction",
    method: "POST", path: "/v1/sites/{siteId}/devices/{deviceId}/interfaces/ports/{portIdx}/actions",
    summary: "Execute an action on a specific device port (e.g. PoE power-cycle)",
    args: [
      { name: "deviceId", desc: "Device ID" },
      { name: "portIdx", desc: "Port index" },
    ],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "devices", action: "pending", operationId: "getPendingDevicePage",
    method: "GET", path: "/v1/pending-devices",
    summary: "List devices pending adoption",
    args: [], needsSite: false, paginatable: true, hasBody: false, extraQuery: [],
  },

  // ── Clients ─────────────────────────────────────────────────────────
  {
    group: "clients", action: "list", operationId: "getConnectedClientOverviewPage",
    method: "GET", path: "/v1/sites/{siteId}/clients",
    summary: "List connected clients (devices, phones, VPN users, etc.)",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "clients", action: "get", operationId: "getConnectedClientDetails",
    method: "GET", path: "/v1/sites/{siteId}/clients/{clientId}",
    summary: "Get detailed info about a connected client",
    args: [{ name: "clientId", desc: "Client ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "clients", action: "action", operationId: "executeConnectedClientAction",
    method: "POST", path: "/v1/sites/{siteId}/clients/{clientId}/actions",
    summary: "Execute an action on a connected client",
    args: [{ name: "clientId", desc: "Client ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },

  // ── Networks ────────────────────────────────────────────────────────
  {
    group: "networks", action: "list", operationId: "getNetworksOverviewPage",
    method: "GET", path: "/v1/sites/{siteId}/networks",
    summary: "List all networks on a site",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "networks", action: "get", operationId: "getNetworkDetails",
    method: "GET", path: "/v1/sites/{siteId}/networks/{networkId}",
    summary: "Get detailed info about a network",
    args: [{ name: "networkId", desc: "Network ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "networks", action: "create", operationId: "createNetwork",
    method: "POST", path: "/v1/sites/{siteId}/networks",
    summary: "Create a new network",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "networks", action: "update", operationId: "updateNetwork",
    method: "PUT", path: "/v1/sites/{siteId}/networks/{networkId}",
    summary: "Update an existing network",
    args: [{ name: "networkId", desc: "Network ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "networks", action: "delete", operationId: "deleteNetwork",
    method: "DELETE", path: "/v1/sites/{siteId}/networks/{networkId}",
    summary: "Delete a network",
    args: [{ name: "networkId", desc: "Network ID" }],
    needsSite: true, paginatable: false, hasBody: false,
    extraQuery: [{ name: "force", required: false, desc: "Force deletion" }],
  },
  {
    group: "networks", action: "references", operationId: "getNetworkReferences",
    method: "GET", path: "/v1/sites/{siteId}/networks/{networkId}/references",
    summary: "Get resources that reference this network",
    args: [{ name: "networkId", desc: "Network ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },

  // ── Firewall Zones ──────────────────────────────────────────────────
  {
    group: "firewall-zones", action: "list", operationId: "getFirewallZones",
    method: "GET", path: "/v1/sites/{siteId}/firewall/zones",
    summary: "List all firewall zones",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "firewall-zones", action: "get", operationId: "getFirewallZone",
    method: "GET", path: "/v1/sites/{siteId}/firewall/zones/{firewallZoneId}",
    summary: "Get a firewall zone",
    args: [{ name: "firewallZoneId", desc: "Firewall zone ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "firewall-zones", action: "create", operationId: "createFirewallZone",
    method: "POST", path: "/v1/sites/{siteId}/firewall/zones",
    summary: "Create a custom firewall zone",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "firewall-zones", action: "update", operationId: "updateFirewallZone",
    method: "PUT", path: "/v1/sites/{siteId}/firewall/zones/{firewallZoneId}",
    summary: "Update a firewall zone",
    args: [{ name: "firewallZoneId", desc: "Firewall zone ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "firewall-zones", action: "delete", operationId: "deleteFirewallZone",
    method: "DELETE", path: "/v1/sites/{siteId}/firewall/zones/{firewallZoneId}",
    summary: "Delete a custom firewall zone",
    args: [{ name: "firewallZoneId", desc: "Firewall zone ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },

  // ── Firewall Policies ───────────────────────────────────────────────
  {
    group: "firewall-policies", action: "list", operationId: "getFirewallPolicies",
    method: "GET", path: "/v1/sites/{siteId}/firewall/policies",
    summary: "List all firewall policies",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "firewall-policies", action: "get", operationId: "getFirewallPolicy",
    method: "GET", path: "/v1/sites/{siteId}/firewall/policies/{firewallPolicyId}",
    summary: "Get a firewall policy",
    args: [{ name: "firewallPolicyId", desc: "Firewall policy ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "firewall-policies", action: "create", operationId: "createFirewallPolicy",
    method: "POST", path: "/v1/sites/{siteId}/firewall/policies",
    summary: "Create a new firewall policy",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "firewall-policies", action: "update", operationId: "updateFirewallPolicy",
    method: "PUT", path: "/v1/sites/{siteId}/firewall/policies/{firewallPolicyId}",
    summary: "Update an existing firewall policy",
    args: [{ name: "firewallPolicyId", desc: "Firewall policy ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "firewall-policies", action: "patch", operationId: "patchFirewallPolicy",
    method: "PATCH", path: "/v1/sites/{siteId}/firewall/policies/{firewallPolicyId}",
    summary: "Patch a firewall policy (partial update, e.g. toggle logging)",
    args: [{ name: "firewallPolicyId", desc: "Firewall policy ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "firewall-policies", action: "delete", operationId: "deleteFirewallPolicy",
    method: "DELETE", path: "/v1/sites/{siteId}/firewall/policies/{firewallPolicyId}",
    summary: "Delete a firewall policy",
    args: [{ name: "firewallPolicyId", desc: "Firewall policy ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "firewall-policies", action: "ordering", operationId: "getFirewallPolicyOrdering",
    method: "GET", path: "/v1/sites/{siteId}/firewall/policies/ordering",
    summary: "Get firewall policy ordering for a zone pair",
    args: [], needsSite: true, paginatable: false, hasBody: false,
    extraQuery: [
      { name: "sourceFirewallZoneId", required: true, desc: "Source zone ID" },
      { name: "destinationFirewallZoneId", required: true, desc: "Destination zone ID" },
    ],
  },
  {
    group: "firewall-policies", action: "reorder", operationId: "updateFirewallPolicyOrdering",
    method: "PUT", path: "/v1/sites/{siteId}/firewall/policies/ordering",
    summary: "Reorder firewall policies for a zone pair",
    args: [], needsSite: true, paginatable: false, hasBody: true,
    extraQuery: [
      { name: "sourceFirewallZoneId", required: true, desc: "Source zone ID" },
      { name: "destinationFirewallZoneId", required: true, desc: "Destination zone ID" },
    ],
  },

  // ── DNS Policies ────────────────────────────────────────────────────
  {
    group: "dns", action: "list", operationId: "getDnsPolicyPage",
    method: "GET", path: "/v1/sites/{siteId}/dns/policies",
    summary: "List DNS policies",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "dns", action: "get", operationId: "getDnsPolicy",
    method: "GET", path: "/v1/sites/{siteId}/dns/policies/{dnsPolicyId}",
    summary: "Get a DNS policy",
    args: [{ name: "dnsPolicyId", desc: "DNS policy ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "dns", action: "create", operationId: "createDnsPolicy",
    method: "POST", path: "/v1/sites/{siteId}/dns/policies",
    summary: "Create a new DNS policy",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "dns", action: "update", operationId: "updateDnsPolicy",
    method: "PUT", path: "/v1/sites/{siteId}/dns/policies/{dnsPolicyId}",
    summary: "Update a DNS policy",
    args: [{ name: "dnsPolicyId", desc: "DNS policy ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "dns", action: "delete", operationId: "deleteDnsPolicy",
    method: "DELETE", path: "/v1/sites/{siteId}/dns/policies/{dnsPolicyId}",
    summary: "Delete a DNS policy",
    args: [{ name: "dnsPolicyId", desc: "DNS policy ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },

  // ── WiFi Broadcasts ─────────────────────────────────────────────────
  {
    group: "wifi", action: "list", operationId: "getWifiBroadcastPage",
    method: "GET", path: "/v1/sites/{siteId}/wifi/broadcasts",
    summary: "List WiFi broadcasts (SSIDs)",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "wifi", action: "get", operationId: "getWifiBroadcastDetails",
    method: "GET", path: "/v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}",
    summary: "Get WiFi broadcast details",
    args: [{ name: "wifiBroadcastId", desc: "WiFi broadcast ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "wifi", action: "create", operationId: "createWifiBroadcast",
    method: "POST", path: "/v1/sites/{siteId}/wifi/broadcasts",
    summary: "Create a new WiFi broadcast",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "wifi", action: "update", operationId: "updateWifiBroadcast",
    method: "PUT", path: "/v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}",
    summary: "Update a WiFi broadcast",
    args: [{ name: "wifiBroadcastId", desc: "WiFi broadcast ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "wifi", action: "delete", operationId: "deleteWifiBroadcast",
    method: "DELETE", path: "/v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}",
    summary: "Delete a WiFi broadcast",
    args: [{ name: "wifiBroadcastId", desc: "WiFi broadcast ID" }],
    needsSite: true, paginatable: false, hasBody: false,
    extraQuery: [{ name: "force", required: false, desc: "Force deletion" }],
  },

  // ── Hotspot Vouchers ────────────────────────────────────────────────
  {
    group: "hotspot", action: "list", operationId: "getVouchers",
    method: "GET", path: "/v1/sites/{siteId}/hotspot/vouchers",
    summary: "List hotspot vouchers",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "hotspot", action: "get", operationId: "getVoucher",
    method: "GET", path: "/v1/sites/{siteId}/hotspot/vouchers/{voucherId}",
    summary: "Get voucher details",
    args: [{ name: "voucherId", desc: "Voucher ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "hotspot", action: "create", operationId: "createVouchers",
    method: "POST", path: "/v1/sites/{siteId}/hotspot/vouchers",
    summary: "Generate one or more hotspot vouchers",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "hotspot", action: "delete", operationId: "deleteVoucher",
    method: "DELETE", path: "/v1/sites/{siteId}/hotspot/vouchers/{voucherId}",
    summary: "Delete a specific voucher",
    args: [{ name: "voucherId", desc: "Voucher ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "hotspot", action: "delete-all", operationId: "deleteVouchers",
    method: "DELETE", path: "/v1/sites/{siteId}/hotspot/vouchers",
    summary: "Delete vouchers matching a filter",
    args: [], needsSite: true, paginatable: false, hasBody: false,
    extraQuery: [{ name: "filter", required: true, desc: "Filter expression" }],
  },

  // ── ACL Rules ───────────────────────────────────────────────────────
  {
    group: "acl", action: "list", operationId: "getAclRulePage",
    method: "GET", path: "/v1/sites/{siteId}/acl-rules",
    summary: "List ACL rules",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "acl", action: "get", operationId: "getAclRule",
    method: "GET", path: "/v1/sites/{siteId}/acl-rules/{aclRuleId}",
    summary: "Get an ACL rule",
    args: [{ name: "aclRuleId", desc: "ACL rule ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "acl", action: "create", operationId: "createAclRule",
    method: "POST", path: "/v1/sites/{siteId}/acl-rules",
    summary: "Create a new ACL rule",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "acl", action: "update", operationId: "updateAclRule",
    method: "PUT", path: "/v1/sites/{siteId}/acl-rules/{aclRuleId}",
    summary: "Update an ACL rule",
    args: [{ name: "aclRuleId", desc: "ACL rule ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "acl", action: "delete", operationId: "deleteAclRule",
    method: "DELETE", path: "/v1/sites/{siteId}/acl-rules/{aclRuleId}",
    summary: "Delete an ACL rule",
    args: [{ name: "aclRuleId", desc: "ACL rule ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "acl", action: "ordering", operationId: "getAclRuleOrdering",
    method: "GET", path: "/v1/sites/{siteId}/acl-rules/ordering",
    summary: "Get ACL rule ordering",
    args: [], needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "acl", action: "reorder", operationId: "updateAclRuleOrdering",
    method: "PUT", path: "/v1/sites/{siteId}/acl-rules/ordering",
    summary: "Reorder ACL rules",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },

  // ── Traffic Matching Lists ──────────────────────────────────────────
  {
    group: "traffic-lists", action: "list", operationId: "getTrafficMatchingLists",
    method: "GET", path: "/v1/sites/{siteId}/traffic-matching-lists",
    summary: "List traffic matching lists",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "traffic-lists", action: "get", operationId: "getTrafficMatchingList",
    method: "GET", path: "/v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}",
    summary: "Get a traffic matching list",
    args: [{ name: "trafficMatchingListId", desc: "Traffic matching list ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },
  {
    group: "traffic-lists", action: "create", operationId: "createTrafficMatchingList",
    method: "POST", path: "/v1/sites/{siteId}/traffic-matching-lists",
    summary: "Create a traffic matching list",
    args: [], needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "traffic-lists", action: "update", operationId: "updateTrafficMatchingList",
    method: "PUT", path: "/v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}",
    summary: "Update a traffic matching list",
    args: [{ name: "trafficMatchingListId", desc: "Traffic matching list ID" }],
    needsSite: true, paginatable: false, hasBody: true, extraQuery: [],
  },
  {
    group: "traffic-lists", action: "delete", operationId: "deleteTrafficMatchingList",
    method: "DELETE", path: "/v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}",
    summary: "Delete a traffic matching list",
    args: [{ name: "trafficMatchingListId", desc: "Traffic matching list ID" }],
    needsSite: true, paginatable: false, hasBody: false, extraQuery: [],
  },

  // ── Supporting Resources ────────────────────────────────────────────
  {
    group: "wans", action: "list", operationId: "getWansOverviewPage",
    method: "GET", path: "/v1/sites/{siteId}/wans",
    summary: "List WAN interfaces",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "vpn-tunnels", action: "list", operationId: "getSiteToSiteVpnTunnelPage",
    method: "GET", path: "/v1/sites/{siteId}/vpn/site-to-site-tunnels",
    summary: "List site-to-site VPN tunnels",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "vpn-servers", action: "list", operationId: "getVpnServerPage",
    method: "GET", path: "/v1/sites/{siteId}/vpn/servers",
    summary: "List VPN servers",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "radius-profiles", action: "list", operationId: "getRadiusProfileOverviewPage",
    method: "GET", path: "/v1/sites/{siteId}/radius/profiles",
    summary: "List RADIUS authentication profiles",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "device-tags", action: "list", operationId: "getDeviceTagPage",
    method: "GET", path: "/v1/sites/{siteId}/device-tags",
    summary: "List device tags (used for WiFi broadcast assignments)",
    args: [], needsSite: true, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "dpi", action: "categories", operationId: "getDpiApplicationCategories",
    method: "GET", path: "/v1/dpi/categories",
    summary: "List DPI application categories",
    args: [], needsSite: false, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: "dpi", action: "apps", operationId: "getDpiApplications",
    method: "GET", path: "/v1/dpi/applications",
    summary: "List DPI-recognized applications",
    args: [], needsSite: false, paginatable: true, hasBody: false, extraQuery: [],
  },
  {
    group: null, action: "countries", operationId: "getCountries",
    method: "GET", path: "/v1/countries",
    summary: "List ISO country codes (for region-based config)",
    args: [], needsSite: false, paginatable: true, hasBody: false, extraQuery: [],
  },
];

// ---------------------------------------------------------------------------
// Group descriptions
// ---------------------------------------------------------------------------

export const GROUP_DESCRIPTIONS: Record<string, string> = {
  sites: "Manage sites — list site IDs required for most other commands",
  devices: "Manage adopted and pending devices — adopt, remove, restart, get stats",
  clients: "View and manage connected clients — devices, phones, VPN users",
  networks: "Manage networks — VLANs, subnets, DHCP configuration",
  "firewall-zones": "Manage firewall zones — group networks for policy rules",
  "firewall-policies": "Manage firewall policies — traffic rules between zones",
  dns: "Manage DNS policies — DNS records, forwarding, filtering",
  wifi: "Manage WiFi broadcasts (SSIDs) — security, scheduling, device filters",
  hotspot: "Manage hotspot vouchers — create, list, delete guest access codes",
  acl: "Manage ACL rules — layer 2 access control",
  "traffic-lists": "Manage traffic matching lists — IP, port, and protocol groups",
  wans: "View WAN interfaces",
  "vpn-tunnels": "View site-to-site VPN tunnels",
  "vpn-servers": "View VPN servers",
  "radius-profiles": "View RADIUS authentication profiles",
  "device-tags": "View device tags for WiFi broadcast assignment",
  dpi: "Deep Packet Inspection — application and category lookups",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function camelCase(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/([A-Z])/g, (m, _c, i) => i === 0 ? m.toLowerCase() : m);
}

/** Generate a tool name from a command definition: group_action or just action */
export function toolName(cmd: CmdDef): string {
  if (cmd.group) {
    return `${cmd.group.replace(/-/g, "_")}_${cmd.action.replace(/-/g, "_")}`;
  }
  return cmd.action.replace(/-/g, "_");
}
