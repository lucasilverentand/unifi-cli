import { Box, Text } from "ink";
import { colors } from "../theme.ts";

export interface TabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  activeTab: T;
  onSwitch: (tab: T) => void;
}

export function Tabs<T extends string>({ tabs, activeTab }: TabsProps<T>) {
  return (
    <Box gap={1}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Box key={tab.id} marginRight={1}>
            <Text
              color={isActive ? colors.tabActive : colors.tabInactive}
              bold={isActive}
              underline={isActive}
            >
              {tab.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
