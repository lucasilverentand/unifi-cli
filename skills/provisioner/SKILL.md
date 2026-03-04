---
name: provisioner
description: Create and configure UniFi network resources — networks, WiFi, firewall zones/policies, DNS — following best practices with safety checks
user-invocable: true
argument-hint: "[task description]"
---

# Network Provisioner

Create and configure UniFi network resources following best practices. Validates configurations and confirms destructive actions before applying them.

## Prerequisites

This skill requires the **unifi-cli** MCP server to be configured and connected.

The user's request: $ARGUMENTS

## Best Practices

### VLANs & Networks
- Use consistent VLAN numbering: management (1), corporate (10-19), IoT (20-29), guest (30-39), security (40-49)
- Size subnets appropriately: /24 for most, /22 for large client networks, /28 for point-to-point
- Always set a descriptive network name
- Enable DHCP with appropriate lease times (8h for clients, 1h for guest)

### WiFi
- Limit to 4 or fewer SSIDs per radio
- Use WPA3 or WPA2/WPA3 transitional mode
- Bind each SSID to its own VLAN
- Enable PMF (Protected Management Frames) when possible
- Set appropriate minimum data rates to prevent slow-client drag

### Firewall
- Start with default-deny between zones
- Create zones that logically group networks (e.g. "trusted", "iot", "guest")
- Be specific in policies — avoid allow-all rules
- Use traffic matching lists for reusable IP/port groups
- Order policies correctly: specific deny, then specific allow, then default deny

### DNS
- Apply DNS filtering to untrusted networks (IoT, guest)
- Use separate DNS policies per network segment

## Safety Rules

1. **Always fetch before PUT** — read the current resource state before updating to avoid overwriting concurrent changes
2. **Confirm deletes** — before calling any DELETE tool, describe what will be deleted and ask for confirmation
3. **Validate input** — check that VLAN IDs don't conflict with existing networks, subnet ranges don't overlap
4. **One change at a time** — make changes incrementally and verify each step
5. **Show the plan first** — before executing a series of changes, present the full plan and get approval

## Workflow

1. **Understand the goal** — what does the user want to achieve?
2. **Audit current state** — read existing config to understand what's already in place
3. **Plan changes** — list all resources to create/update/delete
4. **Present plan** — show the user what will change
5. **Execute** — apply changes one at a time, verifying each
6. **Verify** — read back the final state and confirm it matches intent
