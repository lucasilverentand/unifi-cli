import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { useState, useCallback } from "react";
import { colors } from "../theme.ts";

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
}

export interface FormProps {
  title: string;
  fields: FormField[];
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function Form({ title, fields, onSubmit, onCancel }: FormProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.name] = "";
    }
    return initial;
  });

  const isSubmitButton = focusIndex === fields.length;

  const handleFieldChange = useCallback(
    (name: string, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.name];
      if (!raw && !field.required) continue;
      if (field.type === "number" || field.type === "integer") {
        result[field.name] = Number(raw);
      } else if (field.type === "boolean") {
        result[field.name] = raw === "true";
      } else {
        result[field.name] = raw;
      }
    }
    onSubmit(result);
  }, [fields, values, onSubmit]);

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.tab || (key.return && !isSubmitButton)) {
      setFocusIndex((prev) => Math.min(prev + 1, fields.length));
      return;
    }
    if (key.shift && key.tab) {
      setFocusIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return && isSubmitButton) {
      handleSubmit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>
          {title}
        </Text>
      </Box>

      {fields.map((field, i) => {
        const isFocused = i === focusIndex;
        return (
          <Box key={field.name} flexDirection="column" marginBottom={1}>
            <Box gap={1}>
              <Text color={isFocused ? colors.primary : colors.text} bold={isFocused}>
                {field.name}
              </Text>
              {field.required && <Text color={colors.error}>*</Text>}
              {field.description && (
                <Text dimColor>({field.description})</Text>
              )}
            </Box>
            <Box marginLeft={2}>
              {field.enum ? (
                isFocused ? (
                  <SelectInput
                    items={field.enum.map((v) => ({ label: v, value: v }))}
                    onSelect={(item) => handleFieldChange(field.name, item.value)}
                  />
                ) : (
                  <Text dimColor>{values[field.name] || "(select)"}</Text>
                )
              ) : (
                <TextInput
                  value={values[field.name] ?? ""}
                  onChange={(v) => handleFieldChange(field.name, v)}
                  focus={isFocused}
                  placeholder={field.type}
                />
              )}
            </Box>
          </Box>
        );
      })}

      <Box marginTop={1} gap={2}>
        <Text
          color={isSubmitButton ? colors.primary : colors.muted}
          bold={isSubmitButton}
          inverse={isSubmitButton}
        >
          {" Submit "}
        </Text>
        <Text dimColor>Esc: Cancel | Tab: Next field</Text>
      </Box>
    </Box>
  );
}
