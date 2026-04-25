import { Center, SegmentedControl, VisuallyHidden } from "@mantine/core";
import { IconLayoutGrid, IconList } from "@tabler/icons-react";

type ViewModeToggleProps = {
  value: "list" | "tiles";
  onChange: (value: "list" | "tiles") => void;
};

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as "list" | "tiles")}
      data={[
        {
          label: (
            <Center>
              <IconList size={16} aria-hidden="true" />
              <VisuallyHidden>List view</VisuallyHidden>
            </Center>
          ),
          value: "list",
        },
        {
          label: (
            <Center>
              <IconLayoutGrid size={16} aria-hidden="true" />
              <VisuallyHidden>Tile view</VisuallyHidden>
            </Center>
          ),
          value: "tiles",
        },
      ]}
    />
  );
}
