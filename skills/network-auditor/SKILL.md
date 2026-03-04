---
name: network-auditor
description: Run a read-only security audit on a UniFi network site — checks segmentation, firewall posture, WiFi security, DNS, VPN, and unused resources
user-invocable: true
argument-hint: "[siteId]"
---

# Network Auditor

Read-only security audit for UniFi networks. You NEVER make changes — only read and report.

## Prerequisites

This skill requires the **unifi-cli** MCP server to be configured and connected.

Start by calling `sites_list` to get the site ID if the user didn't provide one.

## Audit Framework

### 1. Gather Data

For site `$ARGUMENTS` (or the default site), collect:

- **Networks** (`networks_list`) — VLANs, subnets, DHCP ranges
- **Firewall zones** (`firewall_zones_list`) — zone definitions and network assignments
- **Firewall policies** (`firewall_policies_list`) — inter-zone rules
- **ACL rules** (`acl_list`) — layer 2 access control
- **WiFi broadcasts** (`wifi_list`) — SSIDs, security modes, VLAN bindings
- **DNS policies** (`dns_list`) — DNS filtering config
- **VPN tunnels** (`vpn_tunnels_list`) and **VPN servers** (`vpn_servers_list`)
- **Devices** (`devices_list`) — firmware versions, models
- **Clients** (`clients_list`) — connected client distribution

### 2. Analyze

Check each area against these criteria:

**Segmentation**
- IoT, guest, and management on separate VLANs
- No flat network with all devices on one subnet

**Firewall posture**
- Default-deny between zones (no implicit allow-all)
- No overly permissive rules (e.g. allow any-any between zones)
- Policy ordering is correct (deny before allow for restrictive rules)
- No shadowed or redundant rules

**WiFi security**
- WPA3 or WPA2/WPA3 transitional (flag WPA2-only)
- No open networks without guest portal
- Guest networks isolated from internal VLANs
- 4 or fewer SSIDs per radio (beacon overhead)

**DNS**
- DNS filtering active on untrusted networks
- No DNS bypass possible from IoT/guest VLANs

**VPN**
- Strong encryption (no deprecated ciphers)
- Split tunneling awareness

**Unused resources**
- Networks with no clients
- Firewall zones with no policies
- Disabled WiFi broadcasts still configured

### 3. Report

Output format:

1. **Executive Summary** — 2-3 sentence overview of security posture
2. **Findings Table** — columns: Area | Severity (Critical/High/Medium/Low/Info) | Finding | Recommendation
3. **Remediation Plan** — prioritized list of actions, highest impact first
