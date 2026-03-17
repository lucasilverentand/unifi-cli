import { Box, Text, useStdout } from "ink";
import { useMemo } from "react";
import { colors, symbols } from "../theme.ts";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  width?: number;
  render?: (row: T) => string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (item: T) => void;
  maxHeight?: number;
}

function getCellValue<T>(row: T, column: Column<T>): string {
  if (column.render) return column.render(row);
  const value = (row as Record<string, unknown>)[column.key as string];
  if (value === undefined || value === null) return "-";
  return String(value);
}

export function DataTable<T>({
  columns,
  data,
  selectedIndex,
  maxHeight,
}: DataTableProps<T>) {
  const { stdout } = useStdout();
  const terminalRows = maxHeight ?? (stdout.rows ? stdout.rows - 6 : 20);
  const visibleRows = Math.max(1, terminalRows - 2); // reserve space for header + border

  const { startIndex, endIndex } = useMemo(() => {
    let start = 0;
    if (selectedIndex >= visibleRows) {
      start = selectedIndex - visibleRows + 1;
    }
    return {
      startIndex: start,
      endIndex: Math.min(start + visibleRows, data.length),
    };
  }, [selectedIndex, visibleRows, data.length]);

  const visibleData = data.slice(startIndex, endIndex);

  if (data.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>No data to display</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        <Box width={3}>
          <Text dimColor> </Text>
        </Box>
        {columns.map((col) => (
          <Box key={String(col.key)} width={col.width ?? 16}>
            <Text bold color={colors.muted}>
              {col.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Data rows */}
      {visibleData.map((row, visibleIdx) => {
        const actualIndex = startIndex + visibleIdx;
        const isSelected = actualIndex === selectedIndex;
        return (
          <Box key={actualIndex}>
            <Box width={3}>
              <Text color={colors.primary}>
                {isSelected ? symbols.arrow + " " : "  "}
              </Text>
            </Box>
            {columns.map((col) => (
              <Box key={String(col.key)} width={col.width ?? 16}>
                <Text
                  color={isSelected ? colors.primary : colors.text}
                  bold={isSelected}
                >
                  {getCellValue(row, col)}
                </Text>
              </Box>
            ))}
          </Box>
        );
      })}

      {/* Scroll indicators */}
      {data.length > visibleRows && (
        <Box>
          <Text dimColor>
            {startIndex > 0 ? symbols.arrowUp : " "}
            {" "}
            {actualIndex(selectedIndex, data.length)}
            {" "}
            {endIndex < data.length ? symbols.arrowDown : " "}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function actualIndex(selected: number, total: number): string {
  return `${selected + 1}/${total}`;
}
