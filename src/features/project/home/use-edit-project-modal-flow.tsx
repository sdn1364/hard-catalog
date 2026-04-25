import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pathEquals } from "../../../shared/lib/path/path-equals";
import {
  catalogProjectStateQueryOptions,
  catalogQueryKeys,
} from "../../../shared/catalog-query";
import { EditProjectModal } from "../edit/edit-project-modal";

type UseEditProjectModalFlowArgs = {
  onRecentsChanged?: () => void;
};

function showActionError(error: unknown) {
  notifications.show({
    color: "red",
    title: "Action failed",
    message: error instanceof Error ? error.message : "Unexpected error",
  });
}

export function useEditProjectModalFlow({
  onRecentsChanged,
}: UseEditProjectModalFlowArgs = {}) {
  const queryClient = useQueryClient();
  const [editModalId, setEditModalId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<RecentProjectItem | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingImagePath, setPendingImagePath] = useState<string | null>(null);
  const [clearCover, setClearCover] = useState(false);

  const pickCoverMutation = useMutation({
    mutationFn: () => window.hcApi.pickImageFile(),
    onSuccess: (picked) => {
      if (!picked) return;
      setPendingImagePath(picked);
      setClearCover(false);
    },
    onError: showActionError,
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!editTarget) return null;
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
      return { payload, editTarget };
    },
    onSuccess: async (result) => {
      if (!result) return;
      await queryClient.invalidateQueries({ queryKey: catalogQueryKeys.homeRecents });
      await queryClient.invalidateQueries({
        queryKey: catalogQueryKeys.homeCatalogState,
      });
      const state = await queryClient.fetchQuery(catalogProjectStateQueryOptions());
      if (
        state.filePath &&
        pathEquals(state.filePath, result.editTarget.filePath)
      ) {
        await window.hcApi.setWindowTitle(
          result.payload.name ?? result.editTarget.name,
        );
      }
      if (editModalId) {
        modals.close(editModalId);
      }
      setEditModalId(null);
      setEditTarget(null);
      onRecentsChanged?.();
      notifications.show({
        color: "green",
        title: "Project updated",
        message: "Your changes were saved.",
      });
    },
    onError: showActionError,
  });

  const busy = useMemo(
    () => pickCoverMutation.isPending || saveEditMutation.isPending,
    [pickCoverMutation.isPending, saveEditMutation.isPending],
  );

  const beginEditProject = useCallback(
    (item: RecentProjectItem) => {
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
            onPickImage={() => pickCoverMutation.mutate()}
            onRemoveImage={() => {
              setPendingImagePath(null);
              setClearCover(true);
            }}
            canRemoveImage={Boolean(item.coverImageUrl)}
            onCancel={() => {
              modals.close(modalId);
            }}
            onSave={() => saveEditMutation.mutate()}
          />
        ),
      });
      setEditModalId(modalId);
    },
    [busy, pickCoverMutation, saveEditMutation],
  );

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
          onPickImage={() => pickCoverMutation.mutate()}
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
          onSave={() => saveEditMutation.mutate()}
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
    pickCoverMutation,
    saveEditMutation,
  ]);

  return {
    beginEditProject,
    busy,
  };
}
