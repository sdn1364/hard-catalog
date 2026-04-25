import { contextBridge, ipcRenderer } from "electron";
import type {
  CatalogState,
  FolderPhoto,
  FolderTreeNode,
  RecentProjectItem,
} from "../shared/ipc-contract";

function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return encodeURI(`file:///${normalized.startsWith("/") ? normalized.slice(1) : normalized}`);
}

const api = {
  /** Host OS (`process.platform`), for layout around window controls. */
  platform: process.platform,
  isWindowFullscreen: (): Promise<boolean> =>
    ipcRenderer.invoke("window:isFullscreen"),
  onFullscreenChange: (cb: (fullscreen: boolean) => void): (() => void) => {
    const handler = (_e: unknown, fullscreen: boolean) => cb(fullscreen);
    ipcRenderer.on("window:fullscreen-changed", handler);
    return () => {
      ipcRenderer.removeListener("window:fullscreen-changed", handler);
    };
  },
  catalogNew: (payload?: {
    filePath?: string;
    projectName?: string;
  }): Promise<CatalogState | null> =>
    ipcRenderer.invoke("catalog:new", payload),
  catalogOpen: (payload?: {
    filePath?: string;
  }): Promise<CatalogState | null> =>
    ipcRenderer.invoke("catalog:open", payload),
  catalogSave: (): Promise<CatalogState | null> =>
    ipcRenderer.invoke("catalog:save"),
  catalogSaveAs: (payload?: {
    filePath?: string;
  }): Promise<CatalogState | null> =>
    ipcRenderer.invoke("catalog:saveAs", payload),
  catalogGetState: (): Promise<CatalogState> =>
    ipcRenderer.invoke("catalog:getState"),
  catalogClose: (): Promise<void> => ipcRenderer.invoke("catalog:close"),
  setWindowTitle: (title: string): Promise<void> =>
    ipcRenderer.invoke("window:setTitle", title),
  setTitleBarOverlay: (opts: {
    color?: string;
    symbolColor?: string;
    height?: number;
  }): Promise<void> => ipcRenderer.invoke("window:setTitleBarOverlay", opts),
  catalogListRecent: (): Promise<RecentProjectItem[]> =>
    ipcRenderer.invoke("catalog:listRecent"),
  catalogRemoveRecent: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("catalog:removeRecent", filePath),
  catalogUpdateRecentProject: (payload: {
    filePath: string;
    name?: string;
    sourceImagePath?: string | null;
    clearCover?: boolean;
  }): Promise<void> =>
    ipcRenderer.invoke("catalog:updateRecentProject", payload),
  pathToFileUrl: (filePath: string): string => toFileUrl(filePath),
  pickImageFile: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:pickImageFile"),
  pickImageFiles: (): Promise<string[]> => ipcRenderer.invoke("dialog:pickImageFiles"),
  projectSetName: (name: string): Promise<void> =>
    ipcRenderer.invoke("project:setName", name),
  foldersGetTree: (): Promise<FolderTreeNode[]> =>
    ipcRenderer.invoke("folders:getTree"),
  foldersGetPhotos: (folderId: string): Promise<FolderPhoto[]> =>
    ipcRenderer.invoke("folders:getPhotos", folderId),
  foldersSeedDemo: (): Promise<void> => ipcRenderer.invoke("folders:seedDemo"),
  foldersAdd: (payload: {
    parentId: string | null;
    name: string;
  }): Promise<void> => ipcRenderer.invoke("folders:add", payload),
  foldersRename: (payload: { id: string; name: string }): Promise<void> =>
    ipcRenderer.invoke("folders:rename", payload),
  foldersRemove: (id: string): Promise<void> =>
    ipcRenderer.invoke("folders:remove", id),
  foldersSetLeafImage: (payload: {
    folderId: string;
    imagePath: string;
  }): Promise<void> => ipcRenderer.invoke("folders:setLeafImage", payload),
  foldersClearLeafImage: (folderId: string): Promise<void> =>
    ipcRenderer.invoke("folders:clearLeafImage", folderId),
  foldersAddPhotos: (payload: {
    folderId: string;
    photos: Array<{
      fileName: string;
      imageMime: string;
      imageBase64: string;
    }>;
  }): Promise<void> => ipcRenderer.invoke("folders:addPhotos", payload),
  foldersRemovePhoto: (payload: {
    folderId: string;
    photoId: string;
  }): Promise<void> => ipcRenderer.invoke("folders:removePhoto", payload),
  foldersClearPhotos: (folderId: string): Promise<void> =>
    ipcRenderer.invoke("folders:clearPhotos", folderId),
};

contextBridge.exposeInMainWorld("hcApi", api);
