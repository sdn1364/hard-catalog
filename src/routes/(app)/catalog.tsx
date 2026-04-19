import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Divider,
  getTreeExpandedState,
  Group,
  Image,
  RenderTreeNodePayload,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  Tree,
  TreeNodeData,
  useTree,
} from "@mantine/core";

import { notifications } from "@mantine/notifications";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
  IconChevronDown,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconPhotoPlus,
  IconTrash,
} from "@tabler/icons-react";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { Split } from "@gfazioli/mantine-split-pane";
import { useOpenTabs } from "../../open-tabs-context";

export const Route = createFileRoute("/(app)/catalog")({
  component: CatalogPage,
});

function folderNodesToTreeData(nodes: FolderTreeNode[]): TreeNodeData[] {
  return nodes.map((n) => ({
    value: n.id,

    label: n.name,

    children:
      n.children.length > 0 ? folderNodesToTreeData(n.children) : undefined,
  }));
}

function CatalogPage() {
  const navigate = useNavigate();

  const { ensureProjectTab } = useOpenTabs();

  const [project, setProject] = useState<CatalogState>({
    filePath: null,
    name: null,
    updatedAt: null,
  });

  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [newRootName, setNewRootName] = useState("");

  const [newChildName, setNewChildName] = useState("");

  const [renameName, setRenameName] = useState("");

  const [busy, setBusy] = useState(false);

  const [ready, setReady] = useState(false);

  const treeData = useMemo(
    () => folderNodesToTreeData(folderTree),
    [folderTree],
  );

  const [expandedState, setExpandedState] = useState<Record<string, boolean>>(
    {},
  );

  useLayoutEffect(() => {
    setExpandedState(getTreeExpandedState(treeData, "*"));
  }, [treeData]);

  const treeController = useTree({
    selectedState: selectedId ? [selectedId] : [],

    onSelectedStateChange: (next) => setSelectedId(next[0] ?? null),

    expandedState,

    onExpandedStateChange: setExpandedState,
  });

  const selectedNode = useMemo(
    () => findNode(folderTree, selectedId),
    [folderTree, selectedId],
  );

  const selectedIsLeaf = selectedNode
    ? selectedNode.children.length === 0
    : false;

  const renderFolderNode = useCallback(
    ({ node, expanded, hasChildren, elementProps }: RenderTreeNodePayload) => {
      const meta = findNode(folderTree, node.value);

      return (
        <Group gap={6} wrap="nowrap" {...elementProps}>
          {hasChildren ? (
            <IconChevronDown
              size={14}
              style={{
                flexShrink: 0,

                transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",

                transition: "transform 100ms ease",
              }}
            />
          ) : (
            <Box w={14} style={{ flexShrink: 0 }} />
          )}

          {hasChildren ? (
            expanded ? (
              <IconFolderOpen
                size={16}
                style={{ flexShrink: 0 }}
                color="var(--mantine-color-yellow-9)"
              />
            ) : (
              <IconFolder
                size={16}
                style={{ flexShrink: 0 }}
                color="var(--mantine-color-yellow-9)"
              />
            )
          ) : (
            <IconFolder
              size={16}
              style={{ flexShrink: 0 }}
              color="var(--mantine-color-dimmed)"
            />
          )}

          <Text size="sm" style={{ flex: 1 }}>
            {node.label}
          </Text>

          {meta?.image ? (
            <Badge size="xs" style={{ flexShrink: 0 }}>
              image
            </Badge>
          ) : null}
        </Group>
      );
    },

    [folderTree],
  );

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
  }, [navigate, ensureProjectTab]);

  const reloadTree = async () => {
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
  };

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

  const addRootFolder = async () =>
    wrapAction(async () => {
      await window.hcApi.foldersAdd({
        parentId: null,
        name: newRootName || "Folder",
      });

      setNewRootName("");

      await reloadTree();
    });

  const seedDemoTree = async () =>
    wrapAction(async () => {
      await window.hcApi.foldersSeedDemo();

      await reloadTree();

      notifications.show({
        color: "green",

        title: "Seed data added",

        message: "Demo hierarchy is ready to explore.",
      });
    });

  const addChildFolder = async () =>
    wrapAction(async () => {
      if (!selectedNode) throw new Error("Select a parent folder first.");

      await window.hcApi.foldersAdd({
        parentId: selectedNode.id,
        name: newChildName || "Folder",
      });

      setNewChildName("");

      await reloadTree();
    });

  const renameSelectedFolder = async () =>
    wrapAction(async () => {
      if (!selectedNode) throw new Error("Select a folder first.");

      await window.hcApi.foldersRename({
        id: selectedNode.id,
        name: renameName || selectedNode.name,
      });

      setRenameName("");

      await reloadTree();
    });

  const removeSelectedFolder = async () =>
    wrapAction(async () => {
      if (!selectedNode) throw new Error("Select a folder first.");

      await window.hcApi.foldersRemove(selectedNode.id);

      await reloadTree();
    });

  const chooseImageForLeaf = async () =>
    wrapAction(async () => {
      if (!selectedNode) throw new Error("Select a bottom-most folder first.");

      if (!selectedIsLeaf)
        throw new Error("Only bottom-most folders can have a preview image.");

      const imagePath = await window.hcApi.pickImageFile();

      if (!imagePath) return;

      await window.hcApi.foldersSetLeafImage({
        folderId: selectedNode.id,
        imagePath,
      });

      await reloadTree();
    });

  const clearLeafImage = async () =>
    wrapAction(async () => {
      if (!selectedNode) throw new Error("Select a folder first.");

      await window.hcApi.foldersClearLeafImage(selectedNode.id);

      await reloadTree();
    });

  if (!ready) {
    return null;
  }

  return (
    <Stack gap="md">
      <Split cursorVertical="vertical-resize" withKnob>
        <Split.Pane maxWidth="30%" minWidth="20%">
          <Stack gap="sm">
            <Group>
              <TextInput
                placeholder="Root folder name"
                value={newRootName}
                onChange={(event) => setNewRootName(event.currentTarget.value)}
                disabled={!project.filePath || busy}
              />

              <Button
                leftSection={<IconFolderPlus size={16} />}
                onClick={() => void addRootFolder()}
                disabled={!project.filePath || busy}
              >
                Add Root
              </Button>

              <Button
                variant="default"
                onClick={() => void seedDemoTree()}
                disabled={!project.filePath || busy || folderTree.length > 0}
              >
                Seed Demo Data
              </Button>
            </Group>

            <ScrollArea h={480} type="always" offsetScrollbars>
              {folderTree.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No folders yet. Add a root folder to start.
                </Text>
              ) : (
                <Tree
                  data={treeData}
                  tree={treeController}
                  selectOnClick
                  expandOnClick
                  clearSelectionOnOutsideClick
                  levelOffset="md"
                  renderNode={renderFolderNode}
                />
              )}
            </ScrollArea>
          </Stack>
        </Split.Pane>
        <Split.Resizer />

        <Split.Pane grow>
          <Stack
            w="52%"
            gap="sm"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Divider label="Selected Folder" />

            <Group justify="space-between">
              <Text fw={600}>{selectedNode?.name ?? "No folder selected"}</Text>

              {selectedNode ? (
                <Badge color={selectedIsLeaf ? "teal" : "blue"}>
                  {selectedIsLeaf ? "Leaf Folder" : "Parent Folder"}
                </Badge>
              ) : null}
            </Group>

            <Group>
              <TextInput
                placeholder="New subfolder name"
                value={newChildName}
                onChange={(event) => setNewChildName(event.currentTarget.value)}
                disabled={!selectedNode || busy}
              />

              <Button
                onClick={() => void addChildFolder()}
                disabled={!selectedNode || busy}
              >
                Add Subfolder
              </Button>
            </Group>

            <Group>
              <TextInput
                placeholder="Rename selected folder"
                value={renameName}
                onChange={(event) => setRenameName(event.currentTarget.value)}
                disabled={!selectedNode || busy}
              />

              <Button
                variant="default"
                onClick={() => void renameSelectedFolder()}
                disabled={!selectedNode || busy}
              >
                Rename
              </Button>

              <Tooltip label="Delete selected folder and all children">
                <ActionIcon
                  color="red"
                  variant="light"
                  size="lg"
                  onClick={() => void removeSelectedFolder()}
                  disabled={!selectedNode || busy}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Divider label="Leaf Preview Image" />

            <Group>
              <Button
                leftSection={<IconPhotoPlus size={16} />}
                onClick={() => void chooseImageForLeaf()}
                disabled={!selectedNode || !selectedIsLeaf || busy}
              >
                Set Image
              </Button>

              <Button
                variant="default"
                onClick={() => void clearLeafImage()}
                disabled={!selectedNode || busy}
              >
                Clear Image
              </Button>
            </Group>

            {!selectedNode ? (
              <Text size="sm" c="dimmed">
                Select a folder to edit it.
              </Text>
            ) : selectedNode.image ? (
              <Stack>
                <Text size="sm" c="dimmed">
                  {selectedNode.image.fileName}
                </Text>

                <Box maw={620}>
                  <Image
                    src={selectedNode.image.dataUrl}
                    radius="md"
                    fit="contain"
                    h={360}
                  />
                </Box>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                {selectedIsLeaf
                  ? "No image assigned for this leaf folder."
                  : "Only bottom-most folders can have a preview image."}
              </Text>
            )}
          </Stack>
        </Split.Pane>
      </Split>
      <AppShell.Footer p="md">
        <Group
          justify="space-between"
          gap="md"
          wrap="nowrap"
          align="flex-start"
        >
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            {project.filePath ? (
              <>
                <Text size="xs" c="dimmed">
                  <Text span fw={600} c="var(--mantine-color-text)">
                    Project:
                  </Text>{" "}
                  <Text span inherit title="Name stored in the catalog file">
                    {(project.name ?? "").trim() || "Untitled Catalog"}
                  </Text>
                </Text>

                <Text
                  size="xs"
                  c="dimmed"
                  title={project.filePath ?? undefined}
                >
                  <Text span fw={600} c="var(--mantine-color-text)">
                    File:
                  </Text>{" "}
                  <Text span inherit>
                    {project.filePath}
                  </Text>
                </Text>
              </>
            ) : (
              <Text size="xs" c="dimmed">
                No catalog file
              </Text>
            )}
          </Stack>

          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {project.updatedAt != null
              ? `Last saved ${formatSavedAt(project.updatedAt)}`
              : "Last saved —"}
          </Text>
        </Group>
      </AppShell.Footer>
    </Stack>
  );
}

function formatSavedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function findNode(
  nodes: FolderTreeNode[],
  id: string | null,
): FolderTreeNode | null {
  if (!id) return null;

  for (const node of nodes) {
    if (node.id === id) return node;

    const nested = findNode(node.children, id);

    if (nested) return nested;
  }

  return null;
}
