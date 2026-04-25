import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  catalogProjectStateQueryOptions,
  catalogQueryKeys,
  homeCatalogStateQueryOptions,
} from "../../../shared/catalog-query";
import { CatalogFileModal } from "../save/catalog-file-modal";

type UseCatalogFileModalFlowArgs = {
  activeFilePath: string | null;
  initialProjectName: string | null;
  onCatalogActivated: (next: CatalogState) => void;
};

function showActionError(error: unknown) {
  notifications.show({
    color: "red",
    title: "Action failed",
    message: error instanceof Error ? error.message : "Unexpected error",
  });
}

export function useCatalogFileModalFlow({
  activeFilePath,
  initialProjectName,
  onCatalogActivated,
}: UseCatalogFileModalFlowArgs) {
  const queryClient = useQueryClient();
  const [projectName, setProjectName] = useState("Untitled Catalog");
  const [catalogModalId, setCatalogModalId] = useState<string | null>(null);

  useEffect(() => {
    if (catalogModalId) return;
    setProjectName(initialProjectName ?? "Untitled Catalog");
  }, [catalogModalId, initialProjectName]);

  const invalidateHomeQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.homeRecents }),
      queryClient.invalidateQueries({
        queryKey: catalogQueryKeys.homeCatalogState,
      }),
      queryClient.invalidateQueries({
        queryKey: catalogQueryKeys.catalogProjectState,
      }),
    ]);
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: () =>
      window.hcApi.catalogNew({
        projectName: projectName.trim() || "Untitled Catalog",
      }),
    onSuccess: async (next) => {
      if (!next) return;
      await invalidateHomeQueries();
      setProjectName(next.name ?? "Untitled Catalog");
      onCatalogActivated(next);
      modals.closeAll();
      notifications.show({
        color: "green",
        title: "Catalog created",
        message: next.filePath ?? "",
      });
    },
    onError: showActionError,
  });

  const openMutation = useMutation({
    mutationFn: () => window.hcApi.catalogOpen(),
    onSuccess: async (next) => {
      if (!next) return;
      await invalidateHomeQueries();
      setProjectName(next.name ?? "Untitled Catalog");
      onCatalogActivated(next);
      modals.closeAll();
      notifications.show({
        color: "green",
        title: "Catalog opened",
        message: next.filePath ?? "",
      });
    },
    onError: showActionError,
  });

  const saveMutation = useMutation({
    mutationFn: () => window.hcApi.catalogSave(),
    onSuccess: async (next) => {
      await invalidateHomeQueries();
      const effectiveState =
        next ??
        (await queryClient.fetchQuery(catalogProjectStateQueryOptions())) ??
        (await queryClient.fetchQuery(homeCatalogStateQueryOptions()));
      if (effectiveState?.filePath) onCatalogActivated(effectiveState);
      notifications.show({
        color: "green",
        title: "Catalog saved",
        message: effectiveState?.filePath ?? "Saved",
      });
    },
    onError: showActionError,
  });

  const saveAsMutation = useMutation({
    mutationFn: () => window.hcApi.catalogSaveAs(),
    onSuccess: async (next) => {
      if (!next) return;
      await invalidateHomeQueries();
      setProjectName(next.name ?? "Untitled Catalog");
      onCatalogActivated(next);
      notifications.show({
        color: "green",
        title: "Catalog saved as",
        message: next.filePath ?? "",
      });
    },
    onError: showActionError,
  });

  const busy = useMemo(
    () =>
      createMutation.isPending ||
      openMutation.isPending ||
      saveMutation.isPending ||
      saveAsMutation.isPending,
    [
      createMutation.isPending,
      openMutation.isPending,
      saveMutation.isPending,
      saveAsMutation.isPending,
    ],
  );

  const openCatalogFileModal = useCallback(() => {
    const modalId = modals.open({
      title: "Catalog file",
      size: "md",
      onClose: () => {
        setCatalogModalId(null);
      },
      children: (
        <CatalogFileModal
          busy={busy}
          projectName={projectName}
          activeFilePath={activeFilePath}
          onProjectNameChange={setProjectName}
          onNew={() => createMutation.mutate()}
          onOpen={() => openMutation.mutate()}
          onSave={() => saveMutation.mutate()}
          onSaveAs={() => saveAsMutation.mutate()}
        />
      ),
    });
    setCatalogModalId(modalId);
  }, [
    activeFilePath,
    busy,
    createMutation,
    openMutation,
    projectName,
    saveAsMutation,
    saveMutation,
  ]);

  useEffect(() => {
    if (!catalogModalId) return;
    modals.updateModal({
      modalId: catalogModalId,
      children: (
        <CatalogFileModal
          busy={busy}
          projectName={projectName}
          activeFilePath={activeFilePath}
          onProjectNameChange={setProjectName}
          onNew={() => createMutation.mutate()}
          onOpen={() => openMutation.mutate()}
          onSave={() => saveMutation.mutate()}
          onSaveAs={() => saveAsMutation.mutate()}
        />
      ),
    });
  }, [
    activeFilePath,
    busy,
    catalogModalId,
    createMutation,
    openMutation,
    projectName,
    saveAsMutation,
    saveMutation,
  ]);

  return {
    busy,
    openCatalogFileModal,
  };
}
