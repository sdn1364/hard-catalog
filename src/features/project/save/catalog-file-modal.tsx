import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";

type CatalogFileModalProps = {
  busy: boolean;
  projectName: string;
  activeFilePath: string | null;
  onProjectNameChange: (value: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
};

export function CatalogFileModal({
  busy,
  projectName,
  activeFilePath,
  onProjectNameChange,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
}: CatalogFileModalProps) {
  return (
    <Stack gap="md">
      <TextInput
        label="Project name (for New)"
        name="projectName"
        autoComplete="off"
        value={projectName}
        onChange={(e) => onProjectNameChange(e.currentTarget.value)}
        disabled={busy}
      />
      <Group grow>
        <Button variant="light" onClick={onNew} disabled={busy} loading={busy}>
          New
        </Button>
        <Button variant="light" onClick={onOpen} disabled={busy} loading={busy}>
          Open
        </Button>
      </Group>
      <Group grow>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={onSave}
          loading={busy}
          disabled={busy || !activeFilePath}
        >
          Save
        </Button>
        <Button
          variant="default"
          onClick={onSaveAs}
          loading={busy}
          disabled={busy || !activeFilePath}
        >
          Save As…
        </Button>
      </Group>
      <Text size="xs" c="dimmed" lineClamp={2} title={activeFilePath ?? "None"}>
        Active file: {activeFilePath ?? "None"}
      </Text>
    </Stack>
  );
}
