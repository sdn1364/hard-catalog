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
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { EditProjectModal } from "../../features/project/edit/edit-project-modal";
import { ViewModeToggle } from "../../features/project/open-recent/view-mode-toggle";
import { CatalogFileModal } from "../../features/project/save/catalog-file-modal";
import { useOpenTabs } from "../../open-tabs-context";
import { pathEquals } from "../../shared/lib/path/path-equals";
import { RecentListView } from "../../widgets/project-list/recent-list-view";
import { RecentTilesView } from "../../widgets/project-list/recent-tiles-view";

const VIEW_STORAGE_KEY = "hc-home-view";

export const Route = createFileRoute("/(app)/")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { ensureProjectTab } = useOpenTabs();
  const [viewMode, setViewMode] = useLocalStorage<"list" | "tiles">({
    key: VIEW_STORAGE_KEY,
    defaultValue: "list",
  });
  const [recents, setRecents] = useState<RecentProjectItem[]>([]);
  const [recentsInitialLoading, setRecentsInitialLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({
    filePath: null,
    name: null,
    updatedAt: null,
  });
  const [modalProjectName, setModalProjectName] = useState("Untitled Catalog");
  const [catalogModalId, setCatalogModalId] = useState<string | null>(null);
  const [editModalId, setEditModalId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<RecentProjectItem | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingImagePath, setPendingImagePath] = useState<string | null>(null);
  const [clearCover, setClearCover] = useState(false);

  const loadRecents = useCallback(async () => {
    try {
      const rows = await window.hcApi.catalogListRecent();
      setRecents(rows);
    } catch {
      setRecents([]);
    } finally {
      setRecentsInitialLoading(false);
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

  const wrap = useCallback(async (fn: () => Promise<void>) => {
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
  }, []);

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
      modals.closeAll();
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
      modals.closeAll();
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

  const openCatalogFileModal = () => {
    const modalId = modals.open({
      title: "Catalog file",
      size: "md",
      onClose: () => {
        setCatalogModalId(null);
      },
      children: (
        <CatalogFileModal
          busy={busy}
          projectName={modalProjectName}
          activeFilePath={catalogState.filePath}
          onProjectNameChange={setModalProjectName}
          onNew={() => void modalNew()}
          onOpen={() => void modalOpen()}
          onSave={() => void modalSave()}
          onSaveAs={() => void modalSaveAs()}
        />
      ),
    });
    setCatalogModalId(modalId);
  };

  const beginEditProject = (item: RecentProjectItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setPendingImagePath(null);
    setClearCover(false);
    const modalId = modals.open({
      title: "Edit project",
      size: "md",
      onClose: () => {
        setEditModalId(null);
        setEditTarget(null);
      },
      children: (
        <EditProjectModal
          busy={busy}
          name={item.name}
          onNameChange={setEditName}
          previewSrc={item.coverImageUrl ?? null}
          onPickImage={() => void pickEditCover()}
          onRemoveImage={() => {
            setPendingImagePath(null);
            setClearCover(true);
          }}
          canRemoveImage={Boolean(item.coverImageUrl)}
          onCancel={() => {
            modals.close(modalId);
          }}
          onSave={() => void saveEditProject()}
        />
      ),
    });
    setEditModalId(modalId);
  };

  const saveEditProject = useCallback(
    () =>
      wrap(async () => {
      if (!editTarget) return;
      const payload: Parameters<
        typeof window.hcApi.catalogUpdateRecentProject
      >[0] = {
        filePath: editTarget.filePath,
        name: editName.trim() || editTarget.name,
      };
      if (pendingImagePath) {
        payload.sourceImagePath = pendingImagePath;
      } else if (clearCover) {
        payload.clearCover = true;
      }
      await window.hcApi.catalogUpdateRecentProject(payload);
      await loadRecents();
      const state = await window.hcApi.catalogGetState();
      if (state.filePath && pathEquals(state.filePath, editTarget.filePath)) {
        await window.hcApi.setWindowTitle(payload.name ?? editTarget.name);
      }
      if (editModalId) {
        modals.close(editModalId);
        setEditModalId(null);
      }
      setEditTarget(null);
      notifications.show({
        color: "green",
        title: "Project updated",
        message: "Your changes were saved.",
      });
      }),
    [
      clearCover,
      editModalId,
      editName,
      editTarget,
      loadRecents,
      pendingImagePath,
      wrap,
    ],
  );

  const pickEditCover = useCallback(
    () =>
      wrap(async () => {
      const picked = await window.hcApi.pickImageFile();
      if (!picked) return;
      setPendingImagePath(picked);
      setClearCover(false);
      }),
    [wrap],
  );

  useEffect(() => {
    if (!catalogModalId) return;
    modals.updateModal({
      modalId: catalogModalId,
      children: (
        <CatalogFileModal
          busy={busy}
          projectName={modalProjectName}
          activeFilePath={catalogState.filePath}
          onProjectNameChange={setModalProjectName}
          onNew={() => void modalNew()}
          onOpen={() => void modalOpen()}
          onSave={() => void modalSave()}
          onSaveAs={() => void modalSaveAs()}
        />
      ),
    });
  }, [busy, catalogModalId, catalogState.filePath, modalProjectName]);

  useEffect(() => {
    if (!editModalId || !editTarget) return;
    modals.updateModal({
      modalId: editModalId,
      children: (
        <EditProjectModal
          busy={busy}
          name={editName}
          onNameChange={setEditName}
          previewSrc={
            pendingImagePath
              ? window.hcApi.pathToFileUrl(pendingImagePath)
              : clearCover
                ? null
                : (editTarget.coverImageUrl ?? null)
          }
          onPickImage={() => void pickEditCover()}
          onRemoveImage={() => {
            setPendingImagePath(null);
            setClearCover(true);
          }}
          canRemoveImage={Boolean(
            editTarget.coverImageUrl || pendingImagePath || clearCover,
          )}
          onCancel={() => {
            modals.close(editModalId);
          }}
          onSave={() => void saveEditProject()}
        />
      ),
    });
  }, [
    busy,
    clearCover,
    editModalId,
    editName,
    editTarget,
    pendingImagePath,
    pickEditCover,
    saveEditProject,
  ]);

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
            onClick={openCatalogFileModal}
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

      {recentsInitialLoading ? (
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
          onOpen={openRecent}
          onRemove={removeRecent}
          onEdit={beginEditProject}
        />
      ) : (
        <RecentTilesView
          recents={recents}
          busy={busy}
          onOpen={openRecent}
          onRemove={removeRecent}
          onEdit={beginEditProject}
        />
      )}
    </Box>
  );
}
