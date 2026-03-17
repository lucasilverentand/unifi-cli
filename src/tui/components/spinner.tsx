import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { colors } from "../theme.ts";

export interface SpinnerViewProps {
  label?: string;
}

export function SpinnerView({ label }: SpinnerViewProps) {
  return (
    <Box justifyContent="center" alignItems="center" padding={1}>
      <Text color={colors.primary}>
        <Spinner type="dots" />
      </Text>
      {label && (
        <Text color={colors.muted}> {label}</Text>
      )}
    </Box>
  );
}
