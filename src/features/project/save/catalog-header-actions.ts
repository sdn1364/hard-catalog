import { notifications } from "@mantine/notifications";
import type { TablerIcon } from "@tabler/icons-react";
import {
  IconDeviceFloppy,
  IconFolderOpen,
  IconPlus,
} from "@tabler/icons-react";

type HeaderAction = {
  icon: TablerIcon;
  label: string;
  value: string;
  onClick: () => Promise<void>;
};

type CreateCatalogHeaderActionsArgs = {
  ensureProjectTab: (state: CatalogState) => void;
  navigateToCatalog: () => void;
};

export function createCatalogHeaderActions({
  ensureProjectTab,
  navigateToCatalog,
}: CreateCatalogHeaderActionsArgs): HeaderAction[] {
  return [
    {
      icon: IconPlus,
      label: "New catalog",
      value: "new-catalog",
      onClick: async () => {
        const next = await window.hcApi.catalogNew();
        if (!next?.filePath) return;
        ensureProjectTab(next);
        notifications.show({
          color: "green",
          title: "Catalog created",
          message: next.filePath,
        });
        navigateToCatalog();
      },
    },
    {
      icon: IconFolderOpen,
      label: "Open catalog",
      value: "open-catalog",
      onClick: async () => {
        const next = await window.hcApi.catalogOpen();
        if (!next?.filePath) return;
        ensureProjectTab(next);
        notifications.show({
          color: "green",
          title: "Catalog opened",
          message: next.filePath,
        });
        navigateToCatalog();
      },
    },
    {
      icon: IconDeviceFloppy,
      label: "Save catalog",
      value: "save-catalog",
      onClick: async () => {
        const next = await window.hcApi.catalogSave();
        notifications.show({
          color: "green",
          title: "Catalog saved",
          message: next?.filePath ?? "Saved",
        });
      },
    },
  ];
}
