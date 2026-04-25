import {
  ActionIcon,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { ProjectCoverPreview } from "../../shared/ui/project-cover-preview/project-cover-preview";
import type { RecentProjectViewProps } from "./recent-project-types";
import classes from "./recent-tiles-view.module.css";

export function RecentTilesView({
  recents,
  busy,
  onOpen,
  onRemove,
  onEdit,
}: RecentProjectViewProps) {
  if (recents.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No recent catalogs yet. Use &quot;New or open…&quot; to create or open
        a file.
      </Text>
    );
  }

  return (
    <Container fluid p="md" h="100%">
      <SimpleGrid cols={{ base: 2, sm: 4, md: 6 }} spacing="md">
        {recents.map((item) => (
          <Card
            key={item.filePath}
            withBorder
            padding={0}
            radius="md"
            className={classes.card}
          >
            <ProjectCoverPreview src={item.coverImageUrl} />
            <Stack gap="xs" p="md">
              <Text
                fw={600}
                size="sm"
                lineClamp={2}
                td={!item.exists ? "line-through" : undefined}
                c={!item.exists ? "dimmed" : undefined}
              >
                {item.name}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={3}>
                {item.filePath}
              </Text>
              <Group justify="flex-end" mt="auto">
                <Tooltip label="Edit name and cover">
                  <ActionIcon
                    variant="light"
                    color="gray"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => onEdit(item)}
                    disabled={busy}
                  >
                    <IconPencil size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Remove from list">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Remove ${item.name} from list`}
                    onClick={() => void onRemove(item.filePath)}
                    disabled={busy}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
                <Button
                  size="xs"
                  onClick={() => void onOpen(item)}
                  disabled={busy}
                >
                  Open
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}
