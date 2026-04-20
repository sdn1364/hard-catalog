import { Center, SegmentedControl } from "@mantine/core";
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
        { label: (<Center><IconList size={16} /></Center>), value: "list" },
        {
          label: (
            <Center>
              <IconLayoutGrid size={16} />
            </Center>
          ),
          value: "tiles",
        },
      ]}
    />
  );
}
