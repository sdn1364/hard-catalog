import { Box, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";
import { ProjectCoverPreview } from "../../../shared/ui/project-cover-preview/project-cover-preview";

type EditProjectModalProps = {
  opened: boolean;
  busy: boolean;
  name: string;
  previewSrc: string | null;
  canRemoveImage: boolean;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function EditProjectModal({
  opened,
  busy,
  name,
  previewSrc,
  canRemoveImage,
  onClose,
  onNameChange,
  onPickImage,
  onRemoveImage,
  onCancel,
  onSave,
}: EditProjectModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Edit project" size="md">
      <Stack gap="md">
        <TextInput
          label="Project name"
          value={name}
          onChange={(e) => onNameChange(e.currentTarget.value)}
          disabled={busy}
        />
        <Box>
          <Text size="sm" fw={500} mb={6}>
            Cover image
          </Text>
          <ProjectCoverPreview src={previewSrc} />
        </Box>
        <Group grow>
          <Button
            variant="light"
            leftSection={<IconPhoto size={16} />}
            onClick={onPickImage}
            disabled={busy}
          >
            Choose image...
          </Button>
          <Button
            variant="default"
            onClick={onRemoveImage}
            disabled={busy || !canRemoveImage}
          >
            Remove image
          </Button>
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
