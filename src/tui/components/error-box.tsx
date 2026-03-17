import { Box, Text } from "ink";
import { colors, symbols } from "../theme.ts";

export interface ErrorBoxProps {
  error: Error;
  onRetry?: () => void;
}

export function ErrorBox({ error, onRetry }: ErrorBoxProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.error}
      padding={1}
    >
      <Box marginBottom={1}>
        <Text color={colors.error} bold>
          {symbols.cross} Error
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text wrap="wrap">{error.message}</Text>
      </Box>

      {onRetry && (
        <Box>
          <Text dimColor>r:Retry</Text>
        </Box>
      )}
    </Box>
  );
}
