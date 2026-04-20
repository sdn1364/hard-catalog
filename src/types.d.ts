type FolderTreeNode = {
  id: string
  parentId: string | null
  name: string
  position: number
  createdAt: number
  updatedAt: number
  children: FolderTreeNode[]
  image?: {
    fileName: string
    mimeType: string
    dataUrl: string
    updatedAt: number
  } | null
}

type CatalogState = {
  filePath: string | null
  name: string | null
  updatedAt: number | null
}

type RecentProjectItem = {
  filePath: string
  name: string
  lastOpenedAt: number
  exists: boolean
  coverImageUrl: string | null
}

type HardCatalogApi = {
  catalogNew: (payload?: { filePath?: string; projectName?: string }) => Promise<CatalogState | null>
  catalogOpen: (payload?: { filePath?: string }) => Promise<CatalogState | null>
  catalogSave: () => Promise<CatalogState | null>
  catalogSaveAs: (payload?: { filePath?: string }) => Promise<CatalogState | null>
  catalogGetState: () => Promise<CatalogState>
  catalogClose: () => Promise<void>
  setWindowTitle: (title: string) => Promise<void>
  setTitleBarOverlay: (opts: {
    color?: string
    symbolColor?: string
    height?: number
  }) => Promise<void>
  catalogListRecent: () => Promise<RecentProjectItem[]>
  catalogRemoveRecent: (filePath: string) => Promise<void>
  catalogUpdateRecentProject: (payload: {
    filePath: string
    name?: string
    sourceImagePath?: string | null
    clearCover?: boolean
  }) => Promise<void>
  pathToFileUrl: (filePath: string) => string
  pickImageFile: () => Promise<string | null>
  projectSetName: (name: string) => Promise<void>
  foldersGetTree: () => Promise<FolderTreeNode[]>
  foldersSeedDemo: () => Promise<void>
  foldersAdd: (payload: { parentId: string | null; name: string }) => Promise<void>
  foldersRename: (payload: { id: string; name: string }) => Promise<void>
  foldersRemove: (id: string) => Promise<void>
  foldersSetLeafImage: (payload: { folderId: string; imagePath: string }) => Promise<void>
  foldersClearLeafImage: (folderId: string) => Promise<void>
}

interface Window {
  hcApi: HardCatalogApi
}
