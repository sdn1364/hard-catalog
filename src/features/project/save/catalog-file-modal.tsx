import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";

type CatalogFileModalProps = {
  opened: boolean;
  busy: boolean;
  projectName: string;
  activeFilePath: string | null;
  onClose: () => void;
  onProjectNameChange: (value: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
};

export function CatalogFileModal({
  opened,
  busy,
  projectName,
  activeFilePath,
  onClose,
  onProjectNameChange,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
}: CatalogFileModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Catalog file" size="md">
      <Stack gap="md">
        <TextInput
          label="Project name (for New)"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.currentTarget.value)}
          disabled={busy}
        />
        <Group grow>
          <Button variant="light" onClick={onNew} disabled={busy}>
            New
          </Button>
          <Button variant="light" onClick={onOpen} disabled={busy}>
            Open
          </Button>
        </Group>
        <Group grow>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={onSave}
            disabled={busy || !activeFilePath}
          >
            Save
          </Button>
          <Button
            variant="default"
            onClick={onSaveAs}
            disabled={busy || !activeFilePath}
          >
            Save As
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Active file: {activeFilePath ?? "None"}
        </Text>
      </Stack>
    </Modal>
  );
}
