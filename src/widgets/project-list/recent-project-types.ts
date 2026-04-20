export type RecentProjectActions = {
  onOpen: (item: RecentProjectItem) => void;
  onRemove: (filePath: string) => void;
  onEdit: (item: RecentProjectItem) => void;
};

export type RecentProjectViewProps = RecentProjectActions & {
  recents: RecentProjectItem[];
  busy: boolean;
};
