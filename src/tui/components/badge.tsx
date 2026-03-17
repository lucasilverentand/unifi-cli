import { Text } from "ink";
import { colors, symbols } from "../theme.ts";

export interface BadgeProps {
  status: "online" | "offline" | "pending" | "upgrading" | "warning";
  label?: string;
}

const STATUS_COLORS: Record<BadgeProps["status"], string> = {
  online: colors.online,
  offline: colors.offline,
  pending: colors.pending,
  upgrading: colors.upgrading,
  warning: colors.warning,
};

const DEFAULT_LABELS: Record<BadgeProps["status"], string> = {
  online: "Online",
  offline: "Offline",
  pending: "Pending",
  upgrading: "Upgrading",
  warning: "Warning",
};

export function Badge({ status, label }: BadgeProps) {
  const color = STATUS_COLORS[status];
  const displayLabel = label ?? DEFAULT_LABELS[status];

  return (
    <Text color={color}>
      {symbols.bullet} {displayLabel}
    </Text>
  );
}
