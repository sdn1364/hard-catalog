import { Box, Group, Stack, Text } from "@mantine/core";
import { useDisclosure, useLocalStorage } from "@mantine/hooks";
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
  const [editOpened, { open: openEdit, close: closeEdit }] =
    useDisclosure(false);
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

  const beginEditProject = (item: RecentProjectItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setPendingImagePath(null);
    setClearCover(false);
    openEdit();
  };

  const saveEditProject = () =>
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
      if (
        state.filePath &&
        pathEquals(state.filePath, editTarget.filePath)
      ) {
        await window.hcApi.setWindowTitle(payload.name ?? editTarget.name);
      }
      closeEdit();
      setEditTarget(null);
      notifications.show({
        color: "green",
        title: "Project updated",
        message: "Your changes were saved.",
      });
    });

  const pickEditCover = () =>
    wrap(async () => {
      const picked = await window.hcApi.pickImageFile();
      if (!picked) return;
      setPendingImagePath(picked);
      setClearCover(false);
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
    <Box p="md">
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
        <Group><ViewModeToggle value={viewMode} onChange={setViewMode} /></Group>
      </Group>

      {viewMode === "list" ? (
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

      <CatalogFileModal
        opened={opened}
        onClose={close}
        busy={busy}
        projectName={modalProjectName}
        activeFilePath={catalogState.filePath}
        onProjectNameChange={setModalProjectName}
        onNew={() => void modalNew()}
        onOpen={() => void modalOpen()}
        onSave={() => void modalSave()}
        onSaveAs={() => void modalSaveAs()}
      />

      <EditProjectModal
        opened={editOpened}
        onClose={() => {
          closeEdit();
          setEditTarget(null);
        }}
        busy={busy}
        name={editName}
        onNameChange={setEditName}
        previewSrc={
          pendingImagePath
            ? window.hcApi.pathToFileUrl(pendingImagePath)
            : clearCover
              ? null
              : (editTarget?.coverImageUrl ?? null)
        }
        onPickImage={() => void pickEditCover()}
        onRemoveImage={() => {
          setPendingImagePath(null);
          setClearCover(true);
        }}
        canRemoveImage={Boolean(
          editTarget?.coverImageUrl || pendingImagePath || clearCover,
        )}
        onCancel={() => {
          closeEdit();
          setEditTarget(null);
        }}
        onSave={() => void saveEditProject()}
      />
    </Box>
  );
}
