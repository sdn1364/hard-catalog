import {
  ActionIcon,
  Badge,
  Box,
  getTreeExpandedState,
  Group,
  RenderTreeNodePayload,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  Tree,
  useTree,
} from "@mantine/core";
import {
  IconChevronDown,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useContextMenu } from "mantine-contextmenu";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "@mantine/hooks";
import classes from "./catalog-folders-pane.module.css";

import {
  findNode,
  folderNodesToTreeData,
  getExpandedPathState,
} from "./catalog-tree-utils";

type AddFolderResult = {
  rows: FolderTreeNode[];
  added: FolderTreeNode;
};

type CatalogFoldersPaneProps = {
  folderTree: FolderTreeNode[];
  selectedId: string | null;
  selectedNode: FolderTreeNode | null;
  busy: boolean;
  hasProjectFile: boolean;
  onSelectedIdChange: (id: string | null) => void;
  onAddFolderFromSelection: () => Promise<AddFolderResult | null>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onRemoveFolder: (id: string) => Promise<void>;
};

export function CatalogFoldersPane({
  folderTree,
  selectedId,
  selectedNode,
  busy,
  hasProjectFile,
  onSelectedIdChange,
  onAddFolderFromSelection,
  onRenameFolder,
  onRemoveFolder,
}: CatalogFoldersPaneProps) {
  const { showContextMenu } = useContextMenu();
  const reduceMotion = useReducedMotion();
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>(
    {},
  );

  const treeData = useMemo(() => folderNodesToTreeData(folderTree), [folderTree]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, FolderTreeNode>();
    const walk = (nodes: FolderTreeNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (node.children.length > 0) walk(node.children);
      }
    };
    walk(folderTree);
    return map;
  }, [folderTree]);

  useEffect(() => {
    const defaults = getTreeExpandedState(treeData, "*");
    setExpandedState((prev) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(defaults)) {
        next[key] = prev[key] ?? defaults[key];
      }
      return next;
    });
  }, [treeData]);

  const treeController = useTree({
    selectedState: selectedId ? [selectedId] : [],
    onSelectedStateChange: (next) => onSelectedIdChange(next[0] ?? null),
    expandedState,
    onExpandedStateChange: setExpandedState,
  });

  function cancelInlineRename() {
    setEditingFolderId(null);
    setEditingFolderName("");
  }

  function startInlineRename(id: string) {
    const current = findNode(folderTree, id);
    if (!current) return;
    onSelectedIdChange(id);
    setEditingFolderId(id);
    setEditingFolderName(current.name);
  }

  async function finishInlineRename(id: string) {
    const current = findNode(folderTree, id);
    if (!current) {
      cancelInlineRename();
      return;
    }

    const nextName = editingFolderName.trim() || "Folder";
    cancelInlineRename();
    if (nextName === current.name) return;
    await onRenameFolder(id, nextName);
  }

  const renderFolderNode = useCallback(
    ({ node, expanded, hasChildren, elementProps }: RenderTreeNodePayload) => {
      const meta = nodeMap.get(node.value);
      const isEditing = editingFolderId === node.value;

      return (
        <Group
          gap={6}
          wrap="nowrap"
          py={4}
          pr="xs"
          {...elementProps}
          onContextMenu={
            isEditing
              ? undefined
              : (e) => {
                  onSelectedIdChange(node.value);
                  showContextMenu([
                    {
                      key: "rename",
                      icon: <IconPencil size={16} />,
                      title: "Rename",
                      onClick: () => startInlineRename(node.value),
                    },
                    {
                      key: "delete",
                      icon: <IconTrash size={16} />,
                      title: "Delete",
                      color: "red",
                      onClick: () => void onRemoveFolder(node.value),
                    },
                  ])(e);
                }
          }
          onDoubleClick={(event) => {
            event.stopPropagation();
            startInlineRename(node.value);
          }}
        >
          {hasChildren ? (
            <IconChevronDown
              size={14}
              className={classes.chevron}
              data-expanded={expanded || undefined}
              data-reduced-motion={reduceMotion || undefined}
              aria-hidden="true"
            />
          ) : (
            <Box w={14} className={classes.noShrink} />
          )}

          {hasChildren ? (
            expanded ? (
              <IconFolderOpen
                size={16}
                className={classes.noShrink}
                color="var(--mantine-color-yellow-9)"
                aria-hidden="true"
              />
            ) : (
              <IconFolder
                size={16}
                className={classes.noShrink}
                color="var(--mantine-color-yellow-9)"
                aria-hidden="true"
              />
            )
          ) : (
            <IconFolder
              size={16}
              className={classes.noShrink}
              color="var(--mantine-color-dimmed)"
              aria-hidden="true"
            />
          )}

          {isEditing ? (
            <TextInput
              size="xs"
              autoFocus
              name="folderName"
              autoComplete="off"
              value={editingFolderName}
              onChange={(event) => setEditingFolderName(event.currentTarget.value)}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void finishInlineRename(node.value);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelInlineRename();
                }
              }}
              onBlur={() => void finishInlineRename(node.value)}
              className={classes.flex1}
            />
          ) : (
            <Text
              size="sm"
              className={classes.flex1MinWidth0}
              truncate
              title={typeof node.label === "string" ? node.label : undefined}
            >
              {node.label}
            </Text>
          )}

          {meta && meta.photoCount > 0 ? (
            <Badge size="xs" className={classes.noShrink}>
              {meta.photoCount === 1
                ? "1 photo"
                : `${meta.photoCount} photos`}
            </Badge>
          ) : null}
        </Group>
      );
    },
    [
      editingFolderId,
      editingFolderName,
      nodeMap,
      folderTree,
      reduceMotion,
      onSelectedIdChange,
      showContextMenu,
      onRemoveFolder,
    ],
  );

  async function handleAddFolder() {
    const result = await onAddFolderFromSelection();
    if (!result) return;

    setExpandedState((prev) => ({
      ...prev,
      ...getExpandedPathState(result.rows, result.added.id),
    }));
    setEditingFolderId(result.added.id);
    setEditingFolderName(result.added.name);
  }

  return (
    <Stack gap="sm" h="100%" className={classes.minHeight0} miw={0}>
      <Group
        justify="space-between"
        wrap="nowrap"
        gap="sm"
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <Text size="sm" fw={600} lineClamp={1} className={classes.minWidth0}>
          Folders
        </Text>
        <Tooltip label={selectedNode ? "Add subfolder here" : "Add root folder"}>
          <ActionIcon
            variant="light"
            size="md"
            aria-label={selectedNode ? "Add subfolder" : "Add root folder"}
            onClick={() => void handleAddFolder()}
            loading={busy}
            disabled={!hasProjectFile || busy}
          >
            <IconFolderPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea offsetScrollbars className={classes.flex1MinHeight0}>
        {folderTree.length === 0 ? (
          <Box py="md" px="xs">
            <Text size="sm" c="dimmed" ta="center" maw={280} mx="auto" lh={1.5}>
              No folders yet. Use the button above to add a root folder, then add
              photos on the right.
            </Text>
          </Box>
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
  );
}
