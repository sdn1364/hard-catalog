import { ActionIcon, Button, Group, Table, Text, Tooltip } from "@mantine/core";
import { IconPencil, IconX } from "@tabler/icons-react";
import { ProjectThumb } from "../../shared/ui/project-thumb/project-thumb";
import type { RecentProjectViewProps } from "./recent-project-types";
import classes from "./recent-list-view.module.css";

export function RecentListView({
  recents,
  busy,
  onOpen,
  onRemove,
  onEdit,
}: RecentProjectViewProps) {
  if (recents.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No recent catalogs yet. Use &quot;New or open…&quot; to create or open a
        file.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={64}> </Table.Th>
          <Table.Th>Name</Table.Th>
          <Table.Th>Path</Table.Th>
          <Table.Th w={180}>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {recents.map((item) => (
          <Table.Tr
            key={item.filePath}
            className={classes.row}
          >
            <Table.Td>
              <ProjectThumb src={item.coverImageUrl} />
            </Table.Td>
            <Table.Td>
              <Text
                fw={500}
                td={!item.exists ? "line-through" : undefined}
                c={!item.exists ? "dimmed" : undefined}
              >
                {item.name}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {item.filePath}
              </Text>
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
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
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => void onOpen(item)}
                  disabled={busy}
                >
                  Open
                </Button>
                <Tooltip label="Remove from list">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Remove ${item.name} from list`}
                    onClick={() => void onRemove(item.filePath)}
                    disabled={busy}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
