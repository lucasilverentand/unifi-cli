---
name: troubleshooter
description: Diagnose UniFi network connectivity issues using a systematic OSI-model approach — checks physical, data link, network, firewall, and application layers
user-invocable: true
argument-hint: "[siteId] [target]"
---

# Network Troubleshooter

Diagnose UniFi network connectivity problems using a systematic OSI-model approach — working from the physical layer up.

## Prerequisites

This skill requires the **unifi-cli** MCP server to be configured and connected.

## Diagnostic Approach

### Step 1 — Gather Context

The first argument is the site ID: `$0`
The optional second argument is a target client or device: `$1`

Ask (or infer from the prompt):
- What is the symptom? (no internet, slow speeds, can't reach a service, intermittent drops)
- Which clients/devices are affected?
- When did it start?

### Step 2 — Layer-by-Layer Analysis

Work bottom-up through the OSI model:

**Layer 1 — Physical**
- `devices_list` — are all devices online and adopted?
- `devices_stats` — check for high CPU, memory pressure, recent restarts
- Look for devices with short uptime (crashed/rebooted recently)

**Layer 2 — Data Link**
- `clients_list` — is the client connected? What's the signal quality?
- `wifi_list` — is the correct SSID active and broadcasting?
- Check for clients stuck on wrong AP or band

**Layer 3 — Network**
- `networks_list` — correct VLAN, subnet, DHCP config
- `wans_list` — WAN link status (up/down, IP assigned)
- Verify client is on the expected network/VLAN

**Layer 3+ — Firewall / Routing**
- `firewall_zones_list` + `firewall_policies_list` — is traffic being blocked?
- `firewall_policies_ordering` — rule ordering issues?
- `dns_list` — DNS resolution issues?

**Layer 7 — Application**
- `vpn_tunnels_list` / `vpn_servers_list` — VPN connectivity
- Cross-reference with traffic matching lists if DPI is involved

### Step 3 — Report

For each layer:
- **Status**: OK / Warning / Error
- **Findings**: what was observed
- **Root cause** (if identified)
- **Fix**: specific tool calls or manual steps to resolve

Order recommendations by likelihood — most probable cause first.

## Safety

- Never make changes without explicit user confirmation
- If a fix requires a destructive action (device restart, policy change), describe it and ask first
- Always fetch current state before recommending changes
