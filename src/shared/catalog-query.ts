import { queryOptions } from "@tanstack/react-query";

export const catalogQueryKeys = {
  homeRecents: ["home", "recents"] as const,
  homeCatalogState: ["home", "catalog-state"] as const,
  catalogProjectState: ["catalog", "project-state"] as const,
  catalogFolderTree: ["catalog", "folder-tree"] as const,
  catalogFolderPhotos: (folderId: string) =>
    ["catalog", "folder-photos", folderId] as const,
};

export const homeRecentsQueryOptions = () =>
  queryOptions({
    queryKey: catalogQueryKeys.homeRecents,
    queryFn: () => window.hcApi.catalogListRecent(),
  });

export const homeCatalogStateQueryOptions = () =>
  queryOptions({
    queryKey: catalogQueryKeys.homeCatalogState,
    queryFn: () => window.hcApi.catalogGetState(),
  });

export const catalogProjectStateQueryOptions = () =>
  queryOptions({
    queryKey: catalogQueryKeys.catalogProjectState,
    queryFn: () => window.hcApi.catalogGetState(),
  });

export const catalogFolderTreeQueryOptions = () =>
  queryOptions({
    queryKey: catalogQueryKeys.catalogFolderTree,
    queryFn: () => window.hcApi.foldersGetTree(),
  });

export const catalogFolderPhotosQueryOptions = (folderId: string) =>
  queryOptions({
    queryKey: catalogQueryKeys.catalogFolderPhotos(folderId),
    queryFn: () => window.hcApi.foldersGetPhotos(folderId),
  });
