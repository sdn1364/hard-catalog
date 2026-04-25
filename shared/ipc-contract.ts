export type CatalogState = {
  filePath: string | null;
  name: string | null;
  updatedAt: number | null;
};

export type RecentProjectItem = {
  filePath: string;
  name: string;
  lastOpenedAt: number;
  exists: boolean;
  coverImageUrl: string | null;
};

export type FolderPhoto = {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  position: number;
  createdAt: number;
  updatedAt: number;
};

export type FolderTreeNode = {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  createdAt: number;
  updatedAt: number;
  photoCount: number;
  children: FolderTreeNode[];
};
