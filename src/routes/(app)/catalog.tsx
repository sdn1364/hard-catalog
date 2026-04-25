import { AppShell, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { IconFolderPlus } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useContextMenu } from "mantine-contextmenu";
import { useCallback, useEffect, useMemo, useState } from "react";
import classes from "./catalog.module.css";

import { Split } from "@gfazioli/mantine-split-pane";
import { CatalogFoldersPane } from "../../features/catalog/catalog-folders-pane";
import { CatalogPhotosPane } from "../../features/catalog/catalog-photos-pane";
import {
  findNode,
  findNodeByParentAndName,
  getUniqueFolderName,
} from "../../features/catalog/catalog-tree-utils";
import { useOpenTabs } from "../../open-tabs-context";

export const Route = createFileRoute("/(app)/catalog")({
  component: CatalogPage,
});

type CatalogPhotoPayload = {
  fileName: string;
  imageMime: string;
  imageBase64: string;
};

function mimeTypeFromFileName(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  const ext = i >= 0 ? fileName.slice(i).toLowerCase() : "";
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

function readFileAsDataUrlBase64Part(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function readImageFilesForCatalog(
  files: File[],
): Promise<CatalogPhotoPayload[]> {
  const chunks: CatalogPhotoPayload[] = [];
  const batchSize = 6;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const rows = await Promise.all(
      batch.map(async (file) => {
        const imageMime = file.type?.trim() || mimeTypeFromFileName(file.name);
        const imageBase64 = await readFileAsDataUrlBase64Part(file);
        return imageBase64.length > 0
          ? { fileName: file.name, imageMime, imageBase64 }
          : null;
      }),
    );
    for (const row of rows) {
      if (row) chunks.push(row);
    }
  }
  return chunks;
}

function CatalogPage() {
  const navigate = useNavigate();
  const { showContextMenu } = useContextMenu();

  const { ensureProjectTab } = useOpenTabs();

  const [project, setProject] = useState<CatalogState>({
    filePath: null,
    name: null,
    updatedAt: null,
  });

  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<FolderPhoto[]>([]);

  const [busy, setBusy] = useState(false);

  const [ready, setReady] = useState(false);

  const selectedNode = useMemo(
    () => findNode(folderTree, selectedId),
    [folderTree, selectedId],
  );

  const reloadTree = useCallback(async () => {
    const rows = await window.hcApi.foldersGetTree();

    setFolderTree(rows);

    setSelectedId((prev) =>
      prev && findNode(rows, prev) ? prev : (rows[0]?.id ?? null),
    );

    try {
      const next = await window.hcApi.catalogGetState();

      setProject(next);

      if (next.filePath) ensureProjectTab(next);
    } catch {
      /* ignore */
    }

    return rows;
  }, [ensureProjectTab]);

  useEffect(() => {
    const init = async () => {
      try {
        const state = await window.hcApi.catalogGetState();

        if (!state.filePath) {
          void navigate({ to: "/" });

          return;
        }

        setProject(state);

        ensureProjectTab(state);

        await reloadTree();
      } catch {
        void navigate({ to: "/" });

        return;
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [navigate, reloadTree]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedPhotos([]);
      return;
    }
    let mounted = true;
    void window.hcApi
      .foldersGetPhotos(selectedId)
      .then((rows) => {
        if (mounted) setSelectedPhotos(rows);
      })
      .catch(() => {
        if (mounted) setSelectedPhotos([]);
      });
    return () => {
      mounted = false;
    };
  }, [selectedId]);

  const setFolderPhotoCount = useCallback((folderId: string, count: number) => {
    const update = (nodes: FolderTreeNode[]): FolderTreeNode[] =>
      nodes.map((node) => {
        if (node.id === folderId) {
          return { ...node, photoCount: count };
        }
        if (node.children.length === 0) return node;
        return { ...node, children: update(node.children) };
      });
    setFolderTree((prev) => update(prev));
  }, []);

  const wrapAction = async (fn: () => Promise<void>) => {
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

  const addFolderFromSelection = async (): Promise<{
    rows: FolderTreeNode[];
    added: FolderTreeNode;
  } | null> => {
    let result: { rows: FolderTreeNode[]; added: FolderTreeNode } | null = null;
    await wrapAction(async () => {
      const parentId = selectedNode?.id ?? null;
      const folderName = getUniqueFolderName(
        folderTree,
        parentId,
        "New Folder",
      );
      await window.hcApi.foldersAdd({
        parentId,
        name: folderName,
      });
      const rows = await reloadTree();
      const added = findNodeByParentAndName(rows, parentId, folderName);
      if (!added) return;
      setSelectedId(added.id);
      result = { rows, added };
    });
    return result;
  };

  const renameFolder = async (id: string, name: string) => {
    await wrapAction(async () => {
      await window.hcApi.foldersRename({ id, name });
      await reloadTree();
    });
  };

  const removeFolder = async (id: string) =>
    wrapAction(async () => {
      const node = findNode(folderTree, id);
      if (!node) throw new Error("Folder not found.");
      const confirmed = window.confirm(
        `Delete "${node.name}" and all subfolders? This cannot be undone.`,
      );
      if (!confirmed) return;

      await window.hcApi.foldersRemove(id);

      await reloadTree();
    });

  const addDroppedPhotosToFolder = async (files: File[]) => {
    const folder = selectedNode;
    if (!folder) return;
    const photos = await readImageFilesForCatalog(files);
    if (photos.length === 0) {
      notifications.show({
        color: "yellow",
        title: "No image data",
        message:
          "Could not read the dropped files. Try again or drop different images.",
      });
      return;
    }
    await wrapAction(async () => {
      await window.hcApi.foldersAddPhotos({
        folderId: folder.id,
        photos,
      });
      const nextPhotos = await window.hcApi.foldersGetPhotos(folder.id);
      setSelectedPhotos(nextPhotos);
      setFolderPhotoCount(folder.id, nextPhotos.length);
    });
  };

  const removeFolderPhoto = async (photoId: string) =>
    wrapAction(async () => {
      if (!selectedNode) throw new Error("Select a folder first.");
      await window.hcApi.foldersRemovePhoto({
        folderId: selectedNode.id,
        photoId,
      });
      const nextPhotos = selectedPhotos.filter((photo) => photo.id !== photoId);
      setSelectedPhotos(nextPhotos);
      setFolderPhotoCount(selectedNode.id, nextPhotos.length);
    });

  const handlePageContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      showContextMenu([
        {
          key: "create-folder",
          icon: <IconFolderPlus size={16} />,
          title: "Create New Folder",
          disabled: busy || !project.filePath,
          onClick: () => void addFolderFromSelection(),
        },
      ])(event);
    },
    [addFolderFromSelection, busy, project.filePath, showContextMenu],
  );

  if (!ready) {
    return (
      <Center h="calc(100dvh - 48px)" p="xl" role="status" aria-live="polite">
        <Stack align="center" gap="sm">
          <Loader size="md" type="dots" />
          <Text size="sm" c="dimmed">
            Loading catalog…
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack
      gap="md"
      p="md"
      h="calc(100dvh - 48px)"
      className={classes.pageStack}
      onContextMenu={handlePageContextMenu}
    >
      <Split
        cursorVertical="vertical-resize"
        withKnob
        className={classes.splitRoot}
      >
        <Split.Pane maxWidth="30%" minWidth="20%">
          <CatalogFoldersPane
            folderTree={folderTree}
            selectedId={selectedId}
            selectedNode={selectedNode}
            busy={busy}
            hasProjectFile={Boolean(project.filePath)}
            onSelectedIdChange={setSelectedId}
            onAddFolderFromSelection={addFolderFromSelection}
            onRenameFolder={renameFolder}
            onRemoveFolder={removeFolder}
          />
        </Split.Pane>
        <Split.Resizer />

        <Split.Pane
          grow
          p="md"
          className={classes.photosPane}
        >
          <CatalogPhotosPane
            selectedNode={selectedNode}
            selectedPhotos={selectedPhotos}
            busy={busy}
            onDropPhotos={addDroppedPhotosToFolder}
            onAddFolderFromSelection={async () => {
              await addFolderFromSelection();
            }}
            onRenameFolder={renameFolder}
            onRemoveFolder={removeFolder}
            onRemoveFolderPhoto={removeFolderPhoto}
          />
        </Split.Pane>
      </Split>
      <AppShell.Footer p="md" withBorder>
        <Group justify="space-between" gap="md" align="flex-start" wrap="wrap">
          <Stack gap={2} className={classes.projectMetaStack} maw="100%">
            {project.filePath ? (
              <>
                <Text size="xs" c="dimmed" className={classes.wordBreak}>
                  <Text span fw={600} c="var(--mantine-color-text)">
                    Project
                  </Text>
                  {": "}
                  <Text span title="Name stored in the catalog file">
                    {(project.name ?? "").trim() || "Untitled Catalog"}
                  </Text>
                </Text>

                <Text
                  size="xs"
                  c="dimmed"
                  title={project.filePath ?? undefined}
                  className={classes.overflowAnywhere}
                  lineClamp={2}
                >
                  <Text span fw={600} c="var(--mantine-color-text)">
                    File 
                  </Text>
                  {": "}
                  <Text span>{project.filePath}</Text>
                </Text>
              </>
            ) : (
              <Text size="xs" c="dimmed">
                No catalog file
              </Text>
            )}
          </Stack>

          <Text size="xs" c="dimmed" className={classes.noShrink} ta="right">
            {project.updatedAt != null
              ? `Last saved ${formatSavedAt(project.updatedAt)}`
              : "Not saved yet"}
          </Text>
        </Group>
      </AppShell.Footer>
    </Stack>
  );
}
function formatSavedAt(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
