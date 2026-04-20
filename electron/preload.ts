import { contextBridge, ipcRenderer } from 'electron'
import { pathToFileURL } from 'node:url'

export type CatalogState = {
  filePath: string | null
  name: string | null
  updatedAt: number | null
}

export type RecentProjectItem = {
  filePath: string
  name: string
  lastOpenedAt: number
  exists: boolean
  coverImageUrl: string | null
}

export type FolderTreeNode = {
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

const api = {
  catalogNew: (payload?: { filePath?: string; projectName?: string }): Promise<CatalogState | null> =>
    ipcRenderer.invoke('catalog:new', payload),
  catalogOpen: (payload?: { filePath?: string }): Promise<CatalogState | null> =>
    ipcRenderer.invoke('catalog:open', payload),
  catalogSave: (): Promise<CatalogState | null> => ipcRenderer.invoke('catalog:save'),
  catalogSaveAs: (payload?: { filePath?: string }): Promise<CatalogState | null> =>
    ipcRenderer.invoke('catalog:saveAs', payload),
  catalogGetState: (): Promise<CatalogState> => ipcRenderer.invoke('catalog:getState'),
  catalogClose: (): Promise<void> => ipcRenderer.invoke('catalog:close'),
  setWindowTitle: (title: string): Promise<void> => ipcRenderer.invoke('window:setTitle', title),
  setTitleBarOverlay: (opts: {
    color?: string
    symbolColor?: string
    height?: number
  }): Promise<void> => ipcRenderer.invoke('window:setTitleBarOverlay', opts),
  catalogListRecent: (): Promise<RecentProjectItem[]> => ipcRenderer.invoke('catalog:listRecent'),
  catalogRemoveRecent: (filePath: string): Promise<void> => ipcRenderer.invoke('catalog:removeRecent', filePath),
  catalogUpdateRecentProject: (payload: {
    filePath: string
    name?: string
    sourceImagePath?: string | null
    clearCover?: boolean
  }): Promise<void> => ipcRenderer.invoke('catalog:updateRecentProject', payload),
  pathToFileUrl: (filePath: string): string => pathToFileURL(filePath).href,
  pickImageFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickImageFile'),
  projectSetName: (name: string): Promise<void> => ipcRenderer.invoke('project:setName', name),
  foldersGetTree: (): Promise<FolderTreeNode[]> => ipcRenderer.invoke('folders:getTree'),
  foldersSeedDemo: (): Promise<void> => ipcRenderer.invoke('folders:seedDemo'),
  foldersAdd: (payload: { parentId: string | null; name: string }): Promise<void> =>
    ipcRenderer.invoke('folders:add', payload),
  foldersRename: (payload: { id: string; name: string }): Promise<void> => ipcRenderer.invoke('folders:rename', payload),
  foldersRemove: (id: string): Promise<void> => ipcRenderer.invoke('folders:remove', id),
  foldersSetLeafImage: (payload: { folderId: string; imagePath: string }): Promise<void> =>
    ipcRenderer.invoke('folders:setLeafImage', payload),
  foldersClearLeafImage: (folderId: string): Promise<void> => ipcRenderer.invoke('folders:clearLeafImage', folderId),
}

contextBridge.exposeInMainWorld('hcApi', api)
