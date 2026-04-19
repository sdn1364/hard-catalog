import {
  ActionIcon,
  Button,
  Card,
  Container,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure, useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconDeviceFloppy,
  IconFolderOpen,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useOpenTabs } from "../../open-tabs-context";

const VIEW_STORAGE_KEY = "hc-home-view";

export const Route = createFileRoute("/(app)/")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { ensureProjectTab } = useOpenTabs();
  const [opened, { open, close }] = useDisclosure(false);
  const [viewMode, setViewMode] = useLocalStorage<"list" | "tiles">({
    key: VIEW_STORAGE_KEY,
    defaultValue: "list",
  });
  const [recents, setRecents] = useState<RecentProjectItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({
    filePath: null,
    name: null,
    updatedAt: null,
  });
  const [modalProjectName, setModalProjectName] = useState("Untitled Catalog");

  const loadRecents = useCallback(async () => {
    try {
      const rows = await window.hcApi.catalogListRecent();
      setRecents(rows);
    } catch {
      setRecents([]);
    }
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const state = await window.hcApi.catalogGetState();
      setCatalogState(state);
    } catch {
      setCatalogState({ filePath: null, name: null, updatedAt: null });
    }
  }, []);

  useEffect(() => {
    void loadRecents();
    void refreshState();
  }, [loadRecents, refreshState]);

  const wrap = async (fn: () => Promise<void>) => {
    try {
      setBusy(true);
      await fn();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Action failed",
        message: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setBusy(false);
    }
  };

  const openRecent = (item: RecentProjectItem) =>
    wrap(async () => {
      if (!item.exists) {
        notifications.show({
          color: "orange",
          title: "File not found",
          message: "Removing from recent list.",
        });
        await window.hcApi.catalogRemoveRecent(item.filePath);
        await loadRecents();
        return;
      }
      const next = await window.hcApi.catalogOpen({ filePath: item.filePath });
      if (!next) return;
      setCatalogState(next);
      ensureProjectTab(next);
      await loadRecents();
      notifications.show({
        color: "green",
        title: "Catalog opened",
        message: next.filePath ?? "",
      });
      void navigate({ to: "/catalog" });
    });

  const removeRecent = (filePath: string) =>
    wrap(async () => {
      await window.hcApi.catalogRemoveRecent(filePath);
      await loadRecents();
    });

  const modalNew = () =>
    wrap(async () => {
      const next = await window.hcApi.catalogNew({
        projectName: modalProjectName.trim() || "Untitled Catalog",
      });
      if (!next) return;
      setCatalogState(next);
      ensureProjectTab(next);
      setModalProjectName(next.name ?? "Untitled Catalog");
      await loadRecents();
      close();
      notifications.show({
        color: "green",
        title: "Catalog created",
        message: next.filePath ?? "",
      });
      void navigate({ to: "/catalog" });
    });

  const modalOpen = () =>
    wrap(async () => {
      const next = await window.hcApi.catalogOpen();
      if (!next) return;
      setCatalogState(next);
      ensureProjectTab(next);
      setModalProjectName(next.name ?? "Untitled Catalog");
      await loadRecents();
      close();
      notifications.show({
        color: "green",
        title: "Catalog opened",
        message: next.filePath ?? "",
      });
      void navigate({ to: "/catalog" });
    });

  const modalSave = () =>
    wrap(async () => {
      const next = await window.hcApi.catalogSave();
      if (next) setCatalogState(next);
      await loadRecents();
      notifications.show({
        color: "green",
        title: "Catalog saved",
        message: next?.filePath ?? "Saved",
      });
    });

  const modalSaveAs = () =>
    wrap(async () => {
      const next = await window.hcApi.catalogSaveAs();
      if (!next) return;
      setCatalogState(next);
      ensureProjectTab(next);
      setModalProjectName(next.name ?? "Untitled Catalog");
      await loadRecents();
      notifications.show({
        color: "green",
        title: "Catalog saved as",
        message: next.filePath ?? "",
      });
    });

  const goToCatalogIfOpen = () =>
    wrap(async () => {
      const state = await window.hcApi.catalogGetState();
      if (!state.filePath) {
        notifications.show({
          color: "yellow",
          title: "No catalog open",
          message: "Create or open a catalog first.",
        });
        return;
      }
      void navigate({ to: "/catalog" });
    });

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Stack gap={4}>
          <Text fw={700} size="lg">
            Projects
          </Text>
          <Text size="sm" c="dimmed">
            Open a recent catalog or create a new one. Save actions apply to the
            active catalog in this session.
          </Text>
        </Stack>
        <Group>
          <SegmentedControl
            value={viewMode}
            onChange={(v) => setViewMode(v as "list" | "tiles")}
            data={[
              { label: "List", value: "list" },
              { label: "Tiles", value: "tiles" },
            ]}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New or open…
          </Button>
          <Button
            variant="light"
            leftSection={<IconFolderOpen size={16} />}
            onClick={() => void goToCatalogIfOpen()}
            disabled={busy}
          >
            Open editor
          </Button>
        </Group>
      </Group>

      {viewMode === "list" ? (
        <RecentListView
          recents={recents}
          busy={busy}
          onOpen={openRecent}
          onRemove={removeRecent}
        />
      ) : (
        <RecentTilesView
          recents={recents}
          busy={busy}
          onOpen={openRecent}
          onRemove={removeRecent}
        />
      )}

      <Modal opened={opened} onClose={close} title="Catalog file" size="md">
        <Stack gap="md">
          <TextInput
            label="Project name (for New)"
            value={modalProjectName}
            onChange={(e) => setModalProjectName(e.currentTarget.value)}
            disabled={busy}
          />
          <Group grow>
            <Button
              variant="light"
              onClick={() => void modalNew()}
              disabled={busy}
            >
              New
            </Button>
            <Button
              variant="light"
              onClick={() => void modalOpen()}
              disabled={busy}
            >
              Open
            </Button>
          </Group>
          <Group grow>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => void modalSave()}
              disabled={busy || !catalogState.filePath}
            >
              Save
            </Button>
            <Button
              variant="default"
              onClick={() => void modalSaveAs()}
              disabled={busy || !catalogState.filePath}
            >
              Save As
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Active file: {catalogState.filePath ?? "None"}
          </Text>
        </Stack>
      </Modal>
    </>
  );
}

function RecentListView({
  recents,
  busy,
  onOpen,
  onRemove,
}: {
  recents: RecentProjectItem[];
  busy: boolean;
  onOpen: (item: RecentProjectItem) => void;
  onRemove: (filePath: string) => void;
}) {
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
          <Table.Th>Name</Table.Th>
          <Table.Th>Path</Table.Th>
          <Table.Th w={120}>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {recents.map((item) => (
          <Table.Tr key={item.filePath}>
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

function RecentTilesView({
  recents,
  busy,
  onOpen,
  onRemove,
}: {
  recents: RecentProjectItem[];
  busy: boolean;
  onOpen: (item: RecentProjectItem) => void;
  onRemove: (filePath: string) => void;
}) {
  if (recents.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No recent catalogs yet. Use &quot;New or open…&quot; to create or open a
        file.
      </Text>
    );
  }
  return (
    <Container size="xl">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {recents.map((item) => (
          <Card key={item.filePath} withBorder padding="md" radius="md">
            <Stack gap="xs">
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
                <Tooltip label="Remove from list">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
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
