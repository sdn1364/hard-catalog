declare global {
  type CatalogState = import("../shared/ipc-contract").CatalogState;
  type FolderPhoto = import("../shared/ipc-contract").FolderPhoto;
  type FolderTreeNode = import("../shared/ipc-contract").FolderTreeNode;
  type RecentProjectItem = import("../shared/ipc-contract").RecentProjectItem;

  type HardCatalogApi = {
    /** Electron main `process.platform` (e.g. `darwin`, `win32`). */
    platform: string;
    /** Native fullscreen (and macOS simple fullscreen); false in windowed mode. */
    isWindowFullscreen: () => Promise<boolean>;
    /** Subscribe to fullscreen transitions; returns unsubscribe. */
    onFullscreenChange: (cb: (fullscreen: boolean) => void) => () => void;
    catalogNew: (payload?: {
      filePath?: string;
      projectName?: string;
    }) => Promise<CatalogState | null>;
    catalogOpen: (payload?: {
      filePath?: string;
    }) => Promise<CatalogState | null>;
    catalogSave: () => Promise<CatalogState | null>;
    catalogSaveAs: (payload?: {
      filePath?: string;
    }) => Promise<CatalogState | null>;
    catalogGetState: () => Promise<CatalogState>;
    catalogClose: () => Promise<void>;
    setWindowTitle: (title: string) => Promise<void>;
    setTitleBarOverlay: (opts: {
      color?: string;
      symbolColor?: string;
      height?: number;
    }) => Promise<void>;
    catalogListRecent: () => Promise<RecentProjectItem[]>;
    catalogRemoveRecent: (filePath: string) => Promise<void>;
    catalogUpdateRecentProject: (payload: {
      filePath: string;
      name?: string;
      sourceImagePath?: string | null;
      clearCover?: boolean;
    }) => Promise<void>;
    pathToFileUrl: (filePath: string) => string;
    pickImageFile: () => Promise<string | null>;
    pickImageFiles: () => Promise<string[]>;
    projectSetName: (name: string) => Promise<void>;
    foldersGetTree: () => Promise<FolderTreeNode[]>;
    foldersGetPhotos: (folderId: string) => Promise<FolderPhoto[]>;
    foldersSeedDemo: () => Promise<void>;
    foldersAdd: (payload: {
      parentId: string | null;
      name: string;
    }) => Promise<void>;
    foldersRename: (payload: { id: string; name: string }) => Promise<void>;
    foldersRemove: (id: string) => Promise<void>;
    foldersSetLeafImage: (payload: {
      folderId: string;
      imagePath: string;
    }) => Promise<void>;
    foldersClearLeafImage: (folderId: string) => Promise<void>;
    foldersAddPhotos: (payload: {
      folderId: string;
      photos: Array<{
        fileName: string;
        imageMime: string;
        imageBase64: string;
      }>;
    }) => Promise<void>;
    foldersRemovePhoto: (payload: {
      folderId: string;
      photoId: string;
    }) => Promise<void>;
    foldersClearPhotos: (folderId: string) => Promise<void>;
  };

  interface Window {
    hcApi: HardCatalogApi;
  }
}

export {};
