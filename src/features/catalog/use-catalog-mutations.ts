import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  findNode,
  findNodeByParentAndName,
  getUniqueFolderName,
} from "./catalog-tree-utils";
import {
  catalogFolderTreeQueryOptions,
  catalogQueryKeys,
} from "../../shared/catalog-query";

type CatalogPhotoPayload = {
  fileName: string;
  imageMime: string;
  imageBase64: string;
};

type AddFolderResult = {
  rows: FolderTreeNode[];
  added: FolderTreeNode;
};

function showActionError(error: unknown) {
  notifications.show({
    color: "red",
    title: "Action failed",
    message: error instanceof Error ? error.message : "Unexpected error",
  });
}

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
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result as string;
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
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

export function useCatalogMutations({
  folderTree,
  selectedNode,
}: {
  folderTree: FolderTreeNode[];
  selectedNode: FolderTreeNode | null;
}) {
  const queryClient = useQueryClient();

  const addFolderMutation = useMutation({
    mutationFn: async () => {
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
      const rows = await queryClient.fetchQuery(catalogFolderTreeQueryOptions());
      const added = findNodeByParentAndName(rows, parentId, folderName);
      if (!added) return null;
      return { rows, added } as AddFolderResult;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: catalogQueryKeys.catalogFolderTree,
      });
    },
    onError: showActionError,
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await window.hcApi.foldersRename({ id, name });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: catalogQueryKeys.catalogFolderTree,
      });
    },
    onError: showActionError,
  });

  const removeFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const confirmed = window.confirm(
        `Delete "${name}" and all subfolders? This cannot be undone.`,
      );
      if (!confirmed) return false;
      await window.hcApi.foldersRemove(id);
      return true;
    },
    onSuccess: async (removed) => {
      if (!removed) return;
      await queryClient.invalidateQueries({
        queryKey: catalogQueryKeys.catalogFolderTree,
      });
      await queryClient.invalidateQueries({
        queryKey: catalogQueryKeys.catalogProjectState,
      });
    },
    onError: showActionError,
  });

  const addDroppedPhotosMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!selectedNode) return { added: false };
      const photos = await readImageFilesForCatalog(files);
      if (photos.length === 0) return { added: false, noImageData: true };
      await window.hcApi.foldersAddPhotos({
        folderId: selectedNode.id,
        photos,
      });
      return { added: true, folderId: selectedNode.id };
    },
    onSuccess: async (result) => {
      if (result.noImageData) {
        notifications.show({
          color: "yellow",
          title: "No image data",
          message:
            "Could not read the dropped files. Try again or drop different images.",
        });
        return;
      }
      if (!result.added || !result.folderId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: catalogQueryKeys.catalogFolderTree,
        }),
        queryClient.invalidateQueries({
          queryKey: catalogQueryKeys.catalogFolderPhotos(result.folderId),
        }),
      ]);
    },
    onError: showActionError,
  });

  const removeFolderPhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      if (!selectedNode) throw new Error("Select a folder first.");
      await window.hcApi.foldersRemovePhoto({
        folderId: selectedNode.id,
        photoId,
      });
      return selectedNode.id;
    },
    onSuccess: async (folderId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: catalogQueryKeys.catalogFolderTree,
        }),
        queryClient.invalidateQueries({
          queryKey: catalogQueryKeys.catalogFolderPhotos(folderId),
        }),
      ]);
    },
    onError: showActionError,
  });

  const busy = useMemo(
    () =>
      addFolderMutation.isPending ||
      renameFolderMutation.isPending ||
      removeFolderMutation.isPending ||
      addDroppedPhotosMutation.isPending ||
      removeFolderPhotoMutation.isPending,
    [
      addFolderMutation.isPending,
      renameFolderMutation.isPending,
      removeFolderMutation.isPending,
      addDroppedPhotosMutation.isPending,
      removeFolderPhotoMutation.isPending,
    ],
  );

  return {
    busy,
    addFolderFromSelection: async () => addFolderMutation.mutateAsync(),
    renameFolder: async (id: string, name: string) =>
      renameFolderMutation.mutateAsync({ id, name }),
    removeFolder: async (id: string) => {
      const node = findNode(folderTree, id);
      const fallbackName = selectedNode?.name ?? "Folder";
      const name = node?.name ?? fallbackName;
      await removeFolderMutation.mutateAsync({ id, name });
    },
    addDroppedPhotosToFolder: async (files: File[]) =>
      addDroppedPhotosMutation.mutateAsync(files),
    removeFolderPhoto: async (photoId: string) =>
      removeFolderPhotoMutation.mutateAsync(photoId),
  };
}
