import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { colors } from "../theme.ts";

export interface SearchInputProps {
  isActive: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
}

export function SearchInput({
  isActive,
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
}: SearchInputProps) {
  useInput(
    (_input, key) => {
      if (!isActive) return;
      if (key.escape) {
        onCancel();
      } else if (key.return) {
        onSubmit();
      }
    },
  );

  if (!isActive) return null;

  return (
    <Box>
      <Text color={colors.primary} bold>
        /{" "}
      </Text>
      <TextInput
        value={value}
        onChange={onChange}
        focus={isActive}
        placeholder={placeholder ?? "Search..."}
      />
    </Box>
  );
}
