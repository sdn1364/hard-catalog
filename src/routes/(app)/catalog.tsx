import { AppShell, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { IconFolderPlus } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useContextMenu } from "mantine-contextmenu";
import { type MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import classes from "./catalog.module.css";

import { Split } from "@gfazioli/mantine-split-pane";
import { CatalogFoldersPane } from "../../features/catalog/catalog-folders-pane";
import { CatalogPhotosPane } from "../../features/catalog/catalog-photos-pane";
import { findNode } from "../../features/catalog/catalog-tree-utils";
import { useCatalogMutations } from "../../features/catalog/use-catalog-mutations";
import { useOpenTabs } from "../../open-tabs-context";
import {
  catalogFolderPhotosQueryOptions,
  catalogFolderTreeQueryOptions,
  catalogProjectStateQueryOptions,
} from "../../shared/catalog-query";

export const Route = createFileRoute("/(app)/catalog")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(catalogProjectStateQueryOptions()),
      context.queryClient.ensureQueryData(catalogFolderTreeQueryOptions()),
    ]);
  },
  component: CatalogPage,
});

function CatalogPage() {
  const navigate = useNavigate();
  const { showContextMenu } = useContextMenu();

  const { ensureProjectTab } = useOpenTabs();

  const projectQuery = useQuery({
    ...catalogProjectStateQueryOptions(),
    retry: false,
  });
  const folderTreeQuery = useQuery({
    ...catalogFolderTreeQueryOptions(),
    retry: false,
  });

  const project = projectQuery.data ?? {
    filePath: null,
    name: null,
    updatedAt: null,
  };
  const folderTree = folderTreeQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => findNode(folderTree, selectedId),
    [folderTree, selectedId],
  );

  const selectedPhotosQuery = useQuery({
    ...(selectedId
      ? catalogFolderPhotosQueryOptions(selectedId)
      : {
          queryKey: ["catalog", "folder-photos", "none"] as const,
          queryFn: async () => [] as FolderPhoto[],
        }),
    enabled: Boolean(selectedId),
    retry: false,
  });
  const selectedPhotos = selectedPhotosQuery.data ?? [];

  const catalogMutations = useCatalogMutations({
    folderTree,
    selectedNode,
  });
  const busy = catalogMutations.busy;

  useEffect(() => {
    if (!project.filePath) {
      if (!projectQuery.isPending) {
        void navigate({ to: "/" });
      }
      return;
    }
    ensureProjectTab(project);
  }, [ensureProjectTab, navigate, project, projectQuery.isPending]);

  useEffect(() => {
    setSelectedId((prev) =>
      prev && findNode(folderTree, prev) ? prev : (folderTree[0]?.id ?? null),
    );
  }, [folderTree]);

  const handlePageContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      showContextMenu([
        {
          key: "create-folder",
          icon: <IconFolderPlus size={16} />,
          title: "Create New Folder",
          disabled: busy || !project.filePath,
          onClick: async () => {
            const result = await catalogMutations.addFolderFromSelection();
            if (result?.added) {
              setSelectedId(result.added.id);
            }
          },
        },
      ])(event);
    },
    [busy, catalogMutations, project.filePath, showContextMenu],
  );

  if (projectQuery.isPending || folderTreeQuery.isPending) {
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
            onAddFolderFromSelection={async () => {
              const result = await catalogMutations.addFolderFromSelection();
              if (result?.added) {
                setSelectedId(result.added.id);
              }
              return result;
            }}
            onRenameFolder={catalogMutations.renameFolder}
            onRemoveFolder={catalogMutations.removeFolder}
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
            onDropPhotos={async (files) => {
              await catalogMutations.addDroppedPhotosToFolder(files);
            }}
            onAddFolderFromSelection={async () => {
              const result = await catalogMutations.addFolderFromSelection();
              if (result?.added) {
                setSelectedId(result.added.id);
              }
            }}
            onRenameFolder={catalogMutations.renameFolder}
            onRemoveFolder={catalogMutations.removeFolder}
            onRemoveFolderPhoto={async (photoId) => {
              await catalogMutations.removeFolderPhoto(photoId);
            }}
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
