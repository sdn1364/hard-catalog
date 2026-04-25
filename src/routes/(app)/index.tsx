import {
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconFile } from "@tabler/icons-react";
import { useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ViewModeToggle } from "../../features/project/open-recent/view-mode-toggle";
import { useCatalogFileModalFlow } from "../../features/project/home/use-catalog-file-modal-flow";
import { useEditProjectModalFlow } from "../../features/project/home/use-edit-project-modal-flow";
import { useOpenTabs } from "../../open-tabs-context";
import {
  catalogQueryKeys,
  homeCatalogStateQueryOptions,
  homeRecentsQueryOptions,
} from "../../shared/catalog-query";
import { RecentListView } from "../../widgets/project-list/recent-list-view";
import { RecentTilesView } from "../../widgets/project-list/recent-tiles-view";

const VIEW_STORAGE_KEY = "hc-home-view";

export const Route = createFileRoute("/(app)/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(homeRecentsQueryOptions()),
      context.queryClient.ensureQueryData(homeCatalogStateQueryOptions()),
    ]);
  },
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ensureProjectTab } = useOpenTabs();
  const [viewMode, setViewMode] = useLocalStorage<"list" | "tiles">({
    key: VIEW_STORAGE_KEY,
    defaultValue: "list",
  });

  const recentsQuery = useQuery({
    ...homeRecentsQueryOptions(),
    retry: false,
  });
  const catalogStateQuery = useQuery({
    ...homeCatalogStateQueryOptions(),
    retry: false,
  });

  const recents = recentsQuery.data ?? [];
  const catalogState = catalogStateQuery.data ?? {
    filePath: null,
    name: null,
    updatedAt: null,
  };

  const handleActionError = (error: unknown) => {
    notifications.show({
      color: "red",
      title: "Action failed",
      message: error instanceof Error ? error.message : "Unexpected error",
    });
  };

  const onCatalogActivated = (next: CatalogState) => {
    ensureProjectTab(next);
    void navigate({ to: "/catalog" });
  };

  const catalogFileFlow = useCatalogFileModalFlow({
    activeFilePath: catalogState.filePath,
    initialProjectName: catalogState.name,
    onCatalogActivated,
  });

  const editProjectFlow = useEditProjectModalFlow();

  const openRecentMutation = useMutation({
    mutationFn: async (item: RecentProjectItem) => {
      if (!item.exists) {
        await window.hcApi.catalogRemoveRecent(item.filePath);
        return { removedMissing: true as const };
      }
      const next = await window.hcApi.catalogOpen({ filePath: item.filePath });
      return { opened: next };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.homeRecents }),
        queryClient.invalidateQueries({
          queryKey: catalogQueryKeys.homeCatalogState,
        }),
        queryClient.invalidateQueries({
          queryKey: catalogQueryKeys.catalogProjectState,
        }),
      ]);

      if (result.removedMissing) {
        notifications.show({
          color: "orange",
          title: "File not found",
          message: "Removing from recent list.",
        });
        return;
      }

      if (!result.opened) return;
      onCatalogActivated(result.opened);
      notifications.show({
        color: "green",
        title: "Catalog opened",
        message: result.opened.filePath ?? "",
      });
    },
    onError: handleActionError,
  });

  const removeRecentMutation = useMutation({
    mutationFn: async (filePath: string) => {
      await window.hcApi.catalogRemoveRecent(filePath);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: catalogQueryKeys.homeRecents });
    },
    onError: handleActionError,
  });

  const busy =
    openRecentMutation.isPending ||
    removeRecentMutation.isPending ||
    catalogFileFlow.busy ||
    editProjectFlow.busy;

  return (
    <Box p={{ base: "sm", sm: "md" }} maw={1200} mx="auto">
      <Group
        justify="space-between"
        align="flex-start"
        mb="lg"
        wrap="wrap"
        gap="md"
      >
        <Stack gap={4} flex={1} maw="100%" miw={0}>
          <Title order={1} size="h3">
            Projects
          </Title>
          <Text size="sm" c="dimmed">
            Open a recent catalog or use{" "}
            <Text component="span" inherit fw={600}>
              Catalog file
            </Text>{" "}
            to create, open, or save. Save actions apply to the active catalog in
            this session.
          </Text>
        </Stack>
        <Group wrap="wrap" justify="flex-end" gap="sm">
          <Button
            variant="default"
            leftSection={<IconFile size={16} />}
            onClick={catalogFileFlow.openCatalogFileModal}
            loading={busy}
            aria-label="Open catalog file actions"
          >
            Catalog file
          </Button>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </Group>
      </Group>

      {catalogState.filePath ? (
        <Paper
          withBorder
          radius="md"
          mb="md"
          p="sm"
          bg="var(--mantine-color-body)"
        >
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={2} miw={0}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Active catalog
              </Text>
              <Text size="sm" fw={600} c="var(--mantine-color-text)" truncate>
                {catalogState.name ?? "Untitled Catalog"}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {catalogState.filePath}
              </Text>
            </Stack>
            <Badge variant="light" color="green">
              Open
            </Badge>
          </Group>
        </Paper>
      ) : null}

      {recentsQuery.isPending ? (
        <Center py="xl" role="status" aria-live="polite">
          <Stack align="center" gap="md">
            <Loader size="md" type="oval" aria-label="Loading recent projects" />
            <Text size="sm" c="dimmed">
              Loading recent catalogs…
            </Text>
          </Stack>
        </Center>
      ) : viewMode === "list" ? (
        <RecentListView
          recents={recents}
          busy={busy}
          onOpen={(item) => openRecentMutation.mutate(item)}
          onRemove={(filePath) => removeRecentMutation.mutate(filePath)}
          onEdit={editProjectFlow.beginEditProject}
        />
      ) : (
        <RecentTilesView
          recents={recents}
          busy={busy}
          onOpen={(item) => openRecentMutation.mutate(item)}
          onRemove={(filePath) => removeRecentMutation.mutate(filePath)}
          onEdit={editProjectFlow.beginEditProject}
        />
      )}
    </Box>
  );
}
