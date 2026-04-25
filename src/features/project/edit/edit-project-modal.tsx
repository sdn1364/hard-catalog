import { Box, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";
import { ProjectCoverPreview } from "../../../shared/ui/project-cover-preview/project-cover-preview";

type EditProjectModalProps = {
  busy: boolean;
  name: string;
  previewSrc: string | null;
  canRemoveImage: boolean;
  onNameChange: (value: string) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function EditProjectModal({
  busy,
  name,
  previewSrc,
  canRemoveImage,
  onNameChange,
  onPickImage,
  onRemoveImage,
  onCancel,
  onSave,
}: EditProjectModalProps) {
  return (
    <Stack gap="md">
      <TextInput
        label="Project name"
        name="projectName"
        autoComplete="off"
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
          loading={busy}
          disabled={busy}
        >
          Choose image…
        </Button>
        <Button
          variant="default"
          onClick={onRemoveImage}
          loading={busy}
          disabled={busy || !canRemoveImage}
        >
          Remove image
        </Button>
      </Group>
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={busy} loading={busy}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={busy} loading={busy}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}
