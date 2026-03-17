// ---------------------------------------------------------------------------
// Prompt definitions for the MCP server
// ---------------------------------------------------------------------------

export interface PromptDef {
  name: string;
  description: string;
  arguments: { name: string; description: string; required: boolean }[];
}

type PromptMessage = { role: "user"; content: { type: "text"; text: string } };

export function getPromptList(): PromptDef[] {
  return [
    // ── Existing prompts ──────────────────────────────────────────────
    {
      name: "audit-firewall",
      description: "Audit firewall zones, policies, and ACL rules for a site",
      arguments: [
        { name: "siteId", description: "Site ID to audit", required: true },
      ],
    },
    {
      name: "network-topology",
      description: "Map the network topology — networks, VLANs, WAN links, and VPN tunnels",
      arguments: [
        { name: "siteId", description: "Site ID to analyze", required: true },
      ],
    },
    {
      name: "device-health",
      description: "Check device health — CPU, memory, uptime, and connectivity",
      arguments: [
        { name: "siteId", description: "Site ID to check", required: true },
      ],
    },
    {
      name: "troubleshoot-connectivity",
      description: "Diagnose connectivity issues using an OSI-model approach",
      arguments: [
        { name: "siteId", description: "Site ID to troubleshoot", required: true },
        { name: "target", description: "Optional target client or device to focus on", required: false },
      ],
    },
    {
      name: "wifi-optimization",
      description: "Analyze WiFi configuration and suggest optimizations",
      arguments: [
        { name: "siteId", description: "Site ID to analyze", required: true },
      ],
    },
    {
      name: "security-hardening",
      description: "Review network security posture and recommend hardening measures",
      arguments: [
        { name: "siteId", description: "Site ID to review", required: true },
      ],
    },
    // ── New prompts ───────────────────────────────────────────────────
    {
      name: "plan-vlans",
      description: "Analyze current VLAN setup and recommend a segmentation strategy",
      arguments: [
        { name: "siteId", description: "Site ID to analyze", required: true },
      ],
    },
    {
      name: "setup-guest-network",
      description: "Step-by-step guide to creating an isolated guest network with WiFi, VLAN, firewall, and optional hotspot portal",
      arguments: [
        { name: "siteId", description: "Site ID to configure", required: true },
        { name: "ssidName", description: "SSID name for the guest network (default: \"Guest\")", required: false },
      ],
    },
    {
      name: "configure-vpn",
      description: "Review VPN tunnel and server configuration, check encryption settings, and suggest improvements",
      arguments: [
        { name: "siteId", description: "Site ID to review", required: true },
      ],
    },
    {
      name: "manage-dns",
      description: "Assess DNS filtering coverage, check for bypass risks, and recommend categories to block",
      arguments: [
        { name: "siteId", description: "Site ID to review", required: true },
      ],
    },
    {
      name: "onboard-devices",
      description: "Guide through device adoption — naming conventions, site assignment, and network configuration",
      arguments: [
        { name: "siteId", description: "Site ID for device onboarding", required: true },
      ],
    },
    {
      name: "capacity-planning",
      description: "Analyze AP density, switch port utilization, and subnet capacity to flag bottlenecks",
      arguments: [
        { name: "siteId", description: "Site ID to analyze", required: true },
      ],
    },
    {
      name: "incident-response",
      description: "Structured triage workflow for network incidents — device health, connectivity, firewall, DNS",
      arguments: [
        { name: "siteId", description: "Site ID to investigate", required: true },
        { name: "issue", description: "Description of the problem or incident", required: true },
      ],
    },
    {
      name: "compare-sites",
      description: "Compare configurations between two sites — networks, devices, firewall, WiFi, DNS",
      arguments: [
        { name: "siteId1", description: "First site ID", required: true },
        { name: "siteId2", description: "Second site ID", required: true },
      ],
    },
  ];
}

export function getPromptMessages(name: string, args: Record<string, string | undefined>): PromptMessage[] {
  const siteId = args.siteId ?? "default";

  switch (name) {
    case "audit-firewall":
      return [msg([
        `Perform a comprehensive firewall audit for site "${siteId}".`,
        "",
        "Steps:",
        `1. Use the **firewall_zones_list** tool (siteId: "${siteId}") to get all firewall zones.`,
        `2. Use the **firewall_policies_list** tool (siteId: "${siteId}") to get all firewall policies.`,
        `3. Use the **acl_list** tool (siteId: "${siteId}") to get all ACL rules.`,
        `4. Use the **networks_list** tool (siteId: "${siteId}") to understand zone-to-network mapping.`,
        "",
        "Then analyze:",
        "- Are there any overly permissive rules (allow-all between zones)?",
        "- Are there zones with no policies defined?",
        "- Are inter-VLAN policies properly restricting traffic?",
        "- Are there redundant or shadowed rules?",
        "- Provide a summary table of zone pairs and their policy counts.",
      ])];

    case "network-topology":
      return [msg([
        `Map the full network topology for site "${siteId}".`,
        "",
        "Steps:",
        `1. Use the **networks_list** tool (siteId: "${siteId}") to get all networks and VLANs.`,
        `2. Use the **devices_list** tool (siteId: "${siteId}") to get all adopted devices.`,
        `3. Use the **wans_list** tool (siteId: "${siteId}") to get WAN interfaces.`,
        `4. Use the **vpn_tunnels_list** tool (siteId: "${siteId}") to get VPN tunnels.`,
        `5. Use the **wifi_list** tool (siteId: "${siteId}") to get WiFi broadcasts.`,
        "",
        "Then produce:",
        "- A text-based topology diagram showing the gateway, switches, APs, and their interconnections.",
        "- A table of networks with VLAN ID, subnet, DHCP range, and purpose.",
        "- A summary of WAN links and VPN tunnels.",
        "- WiFi SSID-to-network mappings.",
      ])];

    case "device-health":
      return [msg([
        `Check device health for site "${siteId}".`,
        "",
        "Steps:",
        `1. Use the **devices_list** tool (siteId: "${siteId}") to get all adopted devices.`,
        `2. For each device, use the **devices_stats** tool (siteId: "${siteId}", deviceId: <id>) to get real-time statistics.`,
        "",
        "Then report:",
        "- A health summary table: device name, model, status, CPU %, memory %, uptime.",
        "- Flag any devices with high CPU (>80%), high memory (>80%), or recent restarts (uptime < 1 hour).",
        "- Note any devices that are offline or unreachable.",
        "- Provide recommendations for any issues found.",
      ])];

    case "troubleshoot-connectivity": {
      const target = args.target;
      const targetHint = target
        ? `Focus on this specific client or device: "${target}".`
        : "No specific target — investigate general connectivity.";
      return [msg([
        `Troubleshoot connectivity issues for site "${siteId}".`,
        targetHint,
        "",
        "Use an OSI-model bottom-up approach:",
        "",
        "Layer 1 — Physical:",
        `1. Use **devices_list** (siteId: "${siteId}") to check device status and uptime.`,
        `2. For each device, use **devices_stats** to check for errors or high utilization.`,
        "",
        "Layer 2 — Data Link:",
        `3. Use **clients_list** (siteId: "${siteId}") to check client connections and signal quality.`,
        `4. Use **wifi_list** (siteId: "${siteId}") to verify SSID configuration.`,
        "",
        "Layer 3 — Network:",
        `5. Use **networks_list** (siteId: "${siteId}") to verify subnet/VLAN config.`,
        `6. Use **wans_list** (siteId: "${siteId}") to check WAN link status.`,
        "",
        "Layer 3+ — Firewall/Routing:",
        `7. Use **firewall_zones_list** and **firewall_policies_list** to check for blocking rules.`,
        `8. Use **dns_list** (siteId: "${siteId}") to check DNS policies.`,
        "",
        "For each layer, report:",
        "- Status: OK / Warning / Error",
        "- Findings and potential root causes",
        "- Recommended fixes (ordered by likelihood)",
      ])];
    }

    case "wifi-optimization":
      return [msg([
        `Analyze WiFi configuration and suggest optimizations for site "${siteId}".`,
        "",
        "Steps:",
        `1. Use **wifi_list** (siteId: "${siteId}") to get all WiFi broadcasts (SSIDs).`,
        `2. Use **networks_list** (siteId: "${siteId}") to understand VLAN assignments.`,
        `3. Use **devices_list** (siteId: "${siteId}") to identify APs and their models.`,
        `4. Use **clients_list** (siteId: "${siteId}") to see client distribution.`,
        `5. Use **device_tags_list** (siteId: "${siteId}") to check AP group assignments.`,
        `6. Use **radius_profiles_list** (siteId: "${siteId}") to review auth profiles.`,
        "",
        "Analyze and report on:",
        "- SSID count (recommend ≤4 per radio to reduce beacon overhead)",
        "- Security settings per SSID (WPA3 preferred, flag WPA2-only or open networks)",
        "- Band steering / WiFi 6E readiness",
        "- VLAN-to-SSID mapping (each SSID should have its own VLAN for segmentation)",
        "- Client load balancing across APs",
        "- Guest network isolation",
        "- Recommendations prioritized by impact",
      ])];

    case "security-hardening":
      return [msg([
        `Review security posture and recommend hardening for site "${siteId}".`,
        "",
        "Gather data:",
        `1. Use **networks_list** (siteId: "${siteId}") to review network segmentation.`,
        `2. Use **firewall_zones_list** and **firewall_policies_list** (siteId: "${siteId}") for firewall posture.`,
        `3. Use **wifi_list** (siteId: "${siteId}") for WiFi security settings.`,
        `4. Use **dns_list** (siteId: "${siteId}") for DNS filtering policies.`,
        `5. Use **vpn_tunnels_list** and **vpn_servers_list** (siteId: "${siteId}") for VPN config.`,
        `6. Use **acl_list** (siteId: "${siteId}") for layer 2 access control.`,
        `7. Use **devices_list** (siteId: "${siteId}") to check firmware versions.`,
        "",
        "Audit areas:",
        "- **Segmentation**: Are IoT, guest, and management networks properly isolated?",
        "- **Firewall**: Is there a default-deny between zones? Any allow-all rules?",
        "- **WiFi**: WPA3 adoption, open/guest network isolation, rogue AP detection",
        "- **DNS**: Is DNS filtering active? Are there bypass risks?",
        "- **VPN**: Are tunnels using strong encryption? Any deprecated protocols?",
        "- **Access Control**: Are ACL rules in place for sensitive VLANs?",
        "- **Firmware**: Are all devices on the latest stable firmware?",
        "",
        "Output format:",
        "1. Executive summary (1-2 paragraphs)",
        "2. Findings table: Area | Severity (Critical/High/Medium/Low) | Finding | Recommendation",
        "3. Prioritized remediation plan",
      ])];

    case "plan-vlans":
      return [msg([
        `Analyze the current VLAN setup and recommend a segmentation strategy for site "${siteId}".`,
        "",
        "Steps:",
        `1. Use **networks_list** (siteId: "${siteId}") to get all networks and VLANs.`,
        `2. Use **devices_list** (siteId: "${siteId}") to get all adopted devices and their network assignments.`,
        `3. Use **clients_list** (siteId: "${siteId}") to see connected clients and their network distribution.`,
        `4. Use **firewall_zones_list** (siteId: "${siteId}") to understand current zone groupings.`,
        "",
        "Then analyze:",
        "- Current VLAN topology: which networks exist, their subnets, and VLAN IDs.",
        "- Client distribution: how many clients are on each network.",
        "- Device types: identify IoT devices, guest clients, workstations, servers, and management devices.",
        "",
        "Recommend a segmentation strategy covering:",
        "- **IoT**: Isolated VLAN for smart home / IoT devices with restricted internet access.",
        "- **Guest**: Separate VLAN with internet-only access, no local network visibility.",
        "- **Management**: Dedicated VLAN for network infrastructure (controllers, APs, switches).",
        "- **Corporate/Trusted**: VLAN for workstations and trusted devices.",
        "- **Servers**: VLAN for local servers and NAS devices.",
        "",
        "For each proposed VLAN, specify:",
        "- VLAN ID and subnet recommendation",
        "- Which existing clients/devices should be migrated",
        "- Firewall zone and inter-VLAN policy recommendations",
        "- Migration order to minimize downtime",
      ])];

    case "setup-guest-network": {
      const ssidName = args.ssidName ?? "Guest";
      return [msg([
        `Guide through creating an isolated guest network on site "${siteId}" with SSID "${ssidName}".`,
        "",
        "Follow these steps in order, using the specified tools:",
        "",
        "Step 1 — Create VLAN/Network:",
        `- Use **networks_create** (siteId: "${siteId}") to create a new network for guests.`,
        "- Recommend a VLAN ID (e.g. 50), subnet (e.g. 192.168.50.0/24), and DHCP range.",
        "- Set purpose to guest isolation.",
        "",
        "Step 2 — Create WiFi Broadcast:",
        `- Use **wifi_create** (siteId: "${siteId}") to create an SSID named "${ssidName}".`,
        "- Assign it to the guest network created in step 1.",
        "- Recommend WPA2/WPA3 security settings.",
        "",
        "Step 3 — Create Firewall Zone:",
        `- Use **firewall_zones_create** (siteId: "${siteId}") to create a guest zone.`,
        "- Associate the guest network with this zone.",
        "",
        "Step 4 — Add Isolation Policies:",
        `- Use **firewall_policies_create** (siteId: "${siteId}") to add policies:`,
        "  - ALLOW guest zone → WAN (internet access)",
        "  - DENY guest zone → all other zones (network isolation)",
        "  - DENY all other zones → guest zone (prevent inbound access)",
        "",
        "Step 5 — Optional Hotspot Portal:",
        `- Use **hotspot_create** (siteId: "${siteId}") to generate vouchers for guest access.`,
        "- Explain how to enable the captive portal on the WiFi broadcast.",
        "",
        "Before each step, check existing configuration to avoid conflicts:",
        `- Use **networks_list** (siteId: "${siteId}") for existing VLANs.`,
        `- Use **wifi_list** (siteId: "${siteId}") for existing SSIDs.`,
        `- Use **firewall_zones_list** (siteId: "${siteId}") for existing zones.`,
      ])];
    }

    case "configure-vpn":
      return [msg([
        `Review VPN configuration for site "${siteId}" and suggest improvements.`,
        "",
        "Steps:",
        `1. Use **vpn_tunnels_list** (siteId: "${siteId}") to get all site-to-site VPN tunnels.`,
        `2. Use **vpn_servers_list** (siteId: "${siteId}") to get all VPN servers (WireGuard, L2TP, etc.).`,
        `3. Use **networks_list** (siteId: "${siteId}") to understand which networks are routed through VPN tunnels.`,
        "",
        "Then analyze:",
        "- **Tunnel status**: Which tunnels are up/down? Any flapping tunnels?",
        "- **Encryption settings**: Check for strong ciphers (AES-256, ChaCha20). Flag weak or deprecated protocols (PPTP, L2TP without IPsec).",
        "- **Protocol review**: Prefer WireGuard over legacy IPsec/L2TP for new deployments.",
        "- **Routing**: Are the correct networks routed through each tunnel? Any overlap or leaks?",
        "- **Performance**: Any MTU issues or fragmentation hints?",
        "",
        "Recommendations:",
        "- Prioritized list of changes to improve security and performance.",
        "- Migration path from legacy protocols to WireGuard where applicable.",
        "- Subnet and routing best practices for multi-site VPN.",
      ])];

    case "manage-dns":
      return [msg([
        `Assess DNS filtering configuration for site "${siteId}".`,
        "",
        "Steps:",
        `1. Use **dns_list** (siteId: "${siteId}") to get all DNS policies.`,
        `2. Use **networks_list** (siteId: "${siteId}") to see which networks have DNS policies applied.`,
        `3. Use **firewall_zones_list** (siteId: "${siteId}") to check for DNS bypass risks.`,
        "",
        "Then analyze:",
        "- **Coverage**: Which networks have DNS filtering? Are any unprotected?",
        "- **Bypass risks**: Can clients use alternate DNS servers? Are there firewall rules to block DNS to external servers (port 53/853)?",
        "- **Category blocking**: Which content categories are blocked? Recommend additional categories based on network purpose (e.g., malware, phishing, adult content on guest networks).",
        "- **Policy per network**: IoT and guest networks should have stricter DNS filtering than trusted networks.",
        "",
        "Recommendations:",
        "- Missing policies that should be created (use **dns_create** tool).",
        "- Firewall rules to prevent DNS bypass (redirect all DNS to the gateway).",
        "- Content categories to add per network type.",
      ])];

    case "onboard-devices":
      return [msg([
        `Guide through device onboarding for site "${siteId}".`,
        "",
        "Steps:",
        `1. Use **devices_pending** to fetch all devices pending adoption.`,
        `2. Use **devices_list** (siteId: "${siteId}") to see currently adopted devices.`,
        `3. Use **networks_list** (siteId: "${siteId}") to understand available networks.`,
        "",
        "Then for each pending device:",
        "- Identify the device type (AP, switch, gateway, etc.) from its model.",
        "- Suggest a naming convention: `<type>-<location>-<number>` (e.g., `ap-office-01`, `sw-rack-01`).",
        `- Use **devices_adopt** (siteId: "${siteId}") to adopt each device.`,
        "",
        "Post-adoption configuration per device type:",
        "- **Access Points**: Assign WiFi broadcasts, set channel/power, assign device tags for AP groups.",
        "- **Switches**: Configure port profiles, VLANs on ports, PoE settings.",
        "- **Gateways**: WAN configuration, firewall zones, routing.",
        "",
        "Generate a summary table:",
        "| Device | Model | Suggested Name | Network Assignment | Notes |",
      ])];

    case "capacity-planning":
      return [msg([
        `Perform capacity analysis for site "${siteId}".`,
        "",
        "Steps:",
        `1. Use **devices_list** (siteId: "${siteId}") to get all adopted devices (APs, switches, gateways).`,
        `2. Use **clients_list** (siteId: "${siteId}") to get all connected clients.`,
        `3. Use **networks_list** (siteId: "${siteId}") to get subnet sizes and DHCP ranges.`,
        `4. Use **wifi_list** (siteId: "${siteId}") to get WiFi broadcast configurations.`,
        `5. Use **wans_list** (siteId: "${siteId}") to get WAN interface capacity.`,
        "",
        "Analyze:",
        "",
        "**AP Density (clients per AP):**",
        "- Count wireless clients per AP. Flag APs with >30 clients (high density).",
        "- Identify areas that may need additional APs.",
        "",
        "**Switch Port Utilization:**",
        "- Count used ports vs total ports per switch.",
        "- Flag switches with >80% port utilization.",
        "",
        "**Subnet Capacity:**",
        "- For each network, calculate: subnet size, DHCP range, active leases, % used.",
        "- Flag subnets with >70% utilization.",
        "",
        "**WAN Bandwidth:**",
        "- Review WAN link capacity and current utilization if available.",
        "",
        "Output:",
        "1. Capacity summary table: Resource | Current | Max | Utilization % | Status",
        "2. Bottlenecks and risk areas",
        "3. Recommendations for upgrades or rebalancing",
      ])];

    case "incident-response": {
      const issue = args.issue ?? "unspecified issue";
      return [msg([
        `Structured incident response for site "${siteId}".`,
        `Reported issue: "${issue}"`,
        "",
        "Follow this triage workflow using an OSI-model approach:",
        "",
        "**Phase 1 — Assess Current State:**",
        `1. Use **devices_list** (siteId: "${siteId}") to check device status (online/offline/adopting).`,
        `2. Use **clients_list** (siteId: "${siteId}") to check client connectivity.`,
        `3. Use **wans_list** (siteId: "${siteId}") to check WAN link status.`,
        "",
        "**Phase 2 — Check Infrastructure:**",
        `4. For devices showing issues, use **devices_stats** (siteId: "${siteId}", deviceId: <id>) to get CPU, memory, and error counts.`,
        `5. Use **networks_list** (siteId: "${siteId}") to verify network/VLAN configuration.`,
        `6. Use **wifi_list** (siteId: "${siteId}") to verify WiFi broadcast status.`,
        "",
        "**Phase 3 — Check Security/Routing:**",
        `7. Use **firewall_zones_list** and **firewall_policies_list** (siteId: "${siteId}") to check for recently changed or blocking rules.`,
        `8. Use **dns_list** (siteId: "${siteId}") to check DNS policy status.`,
        `9. Use **acl_list** (siteId: "${siteId}") to check for ACL rules that may be blocking traffic.`,
        "",
        "**Phase 4 — Generate Report:**",
        "Based on findings, produce:",
        "1. **Timeline**: Sequence of events and anomalies detected.",
        "2. **Root Cause Analysis**: Most likely cause based on data.",
        "3. **Immediate Actions**: Steps to restore service now.",
        "4. **Investigation Steps**: Further diagnostics if root cause is unclear.",
        "5. **Prevention**: Recommendations to prevent recurrence.",
      ])];
    }

    case "compare-sites": {
      const siteId1 = args.siteId1 ?? "default";
      const siteId2 = args.siteId2 ?? "default";
      return [msg([
        `Compare configurations between site "${siteId1}" and site "${siteId2}".`,
        "",
        "Fetch data from both sites in parallel:",
        "",
        `**Site 1 ("${siteId1}"):**`,
        `1. Use **networks_list** (siteId: "${siteId1}")`,
        `2. Use **devices_list** (siteId: "${siteId1}")`,
        `3. Use **firewall_zones_list** (siteId: "${siteId1}")`,
        `4. Use **firewall_policies_list** (siteId: "${siteId1}")`,
        `5. Use **wifi_list** (siteId: "${siteId1}")`,
        `6. Use **dns_list** (siteId: "${siteId1}")`,
        "",
        `**Site 2 ("${siteId2}"):**`,
        `7. Use **networks_list** (siteId: "${siteId2}")`,
        `8. Use **devices_list** (siteId: "${siteId2}")`,
        `9. Use **firewall_zones_list** (siteId: "${siteId2}")`,
        `10. Use **firewall_policies_list** (siteId: "${siteId2}")`,
        `11. Use **wifi_list** (siteId: "${siteId2}")`,
        `12. Use **dns_list** (siteId: "${siteId2}")`,
        "",
        "Then compare and produce:",
        "",
        "**Networks Diff:**",
        "- Networks present in one site but not the other.",
        "- Networks with matching names but different VLAN IDs or subnets.",
        "",
        "**Firewall Diff:**",
        "- Zones present in one site but not the other.",
        "- Policies that differ between sites (missing rules, different actions).",
        "",
        "**WiFi Diff:**",
        "- SSIDs present in one site but not the other.",
        "- SSIDs with different security settings or network assignments.",
        "",
        "**DNS Diff:**",
        "- DNS policies present in one site but not the other.",
        "- Different content filtering categories.",
        "",
        "**Devices Diff:**",
        "- Device model distribution comparison.",
        "- Firmware version differences.",
        "",
        "Output: A diff table per category showing Site 1 vs Site 2 values, with drift highlighted.",
      ])];
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function msg(lines: string[]): PromptMessage {
  return {
    role: "user",
    content: { type: "text", text: lines.join("\n") },
  };
}
