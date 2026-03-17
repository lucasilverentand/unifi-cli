import { Box, Text } from "ink";
import { colors } from "../theme.ts";

export interface DetailPaneProps {
  title: string;
  entries: { label: string; value: string | number | boolean | undefined }[];
  onBack: () => void;
}

function formatValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function DetailPane({ title, entries }: DetailPaneProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>
          {title}
        </Text>
      </Box>

      {entries.map((entry) => (
        <Box key={entry.label} gap={1}>
          <Box width={24}>
            <Text dimColor>{entry.label}</Text>
          </Box>
          <Text color={colors.text}>{formatValue(entry.value)}</Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>Esc: Back</Text>
      </Box>
    </Box>
  );
}
