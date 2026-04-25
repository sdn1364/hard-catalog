import { TreeNodeData } from "@mantine/core";

export function folderNodesToTreeData(nodes: FolderTreeNode[]): TreeNodeData[] {
  return nodes.map((n) => ({
    value: n.id,
    label: n.name,
    children:
      n.children.length > 0 ? folderNodesToTreeData(n.children) : undefined,
  }));
}

export function findNode(
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

export function findNodeByParentAndName(
  nodes: FolderTreeNode[],
  parentId: string | null,
  name: string,
): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.parentId === parentId && node.name === name) return node;
    const nested = findNodeByParentAndName(node.children, parentId, name);
    if (nested) return nested;
  }
  return null;
}

export function getUniqueFolderName(
  nodes: FolderTreeNode[],
  parentId: string | null,
  baseName: string,
): string {
  const usedNames = new Set(
    listSiblings(nodes, parentId).map((node) => node.name.toLocaleLowerCase()),
  );
  if (!usedNames.has(baseName.toLocaleLowerCase())) return baseName;
  let suffix = 2;
  while (usedNames.has(`${baseName} ${suffix}`.toLocaleLowerCase())) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

export function getExpandedPathState(
  nodes: FolderTreeNode[],
  targetId: string,
): Record<string, boolean> {
  const path = findNodePath(nodes, targetId);
  const state: Record<string, boolean> = {};
  for (const id of path.slice(0, -1)) {
    state[id] = true;
  }
  return state;
}

function listSiblings(
  nodes: FolderTreeNode[],
  parentId: string | null,
): FolderTreeNode[] {
  if (parentId == null) return nodes;
  const parent = findNode(nodes, parentId);
  return parent?.children ?? [];
}

function findNodePath(nodes: FolderTreeNode[], targetId: string): string[] {
  for (const node of nodes) {
    if (node.id === targetId) return [node.id];
    const childPath = findNodePath(node.children, targetId);
    if (childPath.length > 0) return [node.id, ...childPath];
  }
  return [];
}
