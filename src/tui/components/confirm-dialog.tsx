import { Box, Text, useInput } from "ink";
import { colors } from "../theme.ts";

export interface ConfirmDialogProps {
  message: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, isOpen, onConfirm, onCancel }: ConfirmDialogProps) {
  useInput(
    (input, key) => {
      if (!isOpen) return;
      if (input === "y" || input === "Y") {
        onConfirm();
      } else if (input === "n" || input === "N" || key.escape) {
        onCancel();
      }
    },
  );

  if (!isOpen) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.warning}
      padding={1}
      alignItems="center"
    >
      <Box marginBottom={1}>
        <Text color={colors.warning} bold>
          Confirm
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>{message}</Text>
      </Box>

      <Box gap={2}>
        <Text color={colors.success} bold>
          y:Confirm
        </Text>
        <Text color={colors.error} bold>
          n:Cancel
        </Text>
      </Box>
    </Box>
  );
}
