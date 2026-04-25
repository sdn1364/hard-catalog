import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Image,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import {
  IconFolder,
  IconFolderPlus,
  IconPencil,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import classes from "./catalog-photos-pane.module.css";

type CatalogPhotosPaneProps = {
  selectedNode: FolderTreeNode | null;
  selectedPhotos: FolderPhoto[];
  busy: boolean;
  onDropPhotos: (files: File[]) => Promise<void>;
  onAddFolderFromSelection: () => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onRemoveFolder: (id: string) => Promise<void>;
  onRemoveFolderPhoto: (photoId: string) => Promise<void>;
};

function RenameFolderModalBody({
  initialName,
  onCancel,
  onSave,
}: {
  initialName: string;
  onCancel: () => void;
  onSave: (name: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave((name || initialName).trim() || "Folder");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Stack gap="md">
      <TextInput
        label="Name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        autoFocus
        autoComplete="off"
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button loading={saving} onClick={() => void submit()}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}

export function CatalogPhotosPane({
  selectedNode,
  selectedPhotos,
  busy,
  onDropPhotos,
  onAddFolderFromSelection,
  onRenameFolder,
  onRemoveFolder,
  onRemoveFolderPhoto,
}: CatalogPhotosPaneProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Array<{
      key: string;
      title: string;
      color?: string;
      disabled?: boolean;
      icon?: ReactNode;
      onClick: () => void | Promise<void>;
    }>;
  } | null>(null);

  const openRenameModal = useCallback(() => {
    if (!selectedNode) return;
    const { id, name: initialName } = selectedNode;
    modals.open({
      title: "Rename folder",
      size: "sm",
      children: (
        <RenameFolderModalBody
          initialName={initialName}
          onCancel={() => modals.closeAll()}
          onSave={async (next) => {
            if (next === initialName) {
              modals.closeAll();
              return;
            }
            await onRenameFolder(id, next);
            modals.closeAll();
          }}
        />
      ),
    });
  }, [selectedNode, onRenameFolder]);

  const titleContextItems = useMemo(() => {
    if (!selectedNode || busy) return null;
    return [
      {
        key: "rename",
        icon: <IconPencil size={16} />,
        title: "Rename",
        onClick: () => openRenameModal(),
      },
      {
        key: "delete",
        icon: <IconTrash size={16} />,
        title: "Delete",
        color: "red",
        onClick: () => void onRemoveFolder(selectedNode.id),
      },
    ];
  }, [selectedNode, busy, openRenameModal, onRemoveFolder]);

  const paneBodyContextItems = useMemo(
    () => [
      {
        key: "addNewFolder",
        icon: <IconFolderPlus size={16} />,
        title: "Add new folder",
        disabled: busy,
        onClick: () => void onAddFolderFromSelection(),
      },
    ],
    [busy, onAddFolderFromSelection],
  );

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [contextMenu]);

  return (
    <Dropzone
      onDrop={(files) => void onDropPhotos(files)}
      onReject={() =>
        notifications.show({
          color: "red",
          title: "Some files were rejected",
          message: "Only image files are accepted.",
        })
      }
      accept={IMAGE_MIME_TYPE}
      maxSize={40 * 1024 ** 2}
      multiple
      loading={busy}
      disabled={!selectedNode || busy}
      activateOnClick={false}
      enablePointerEvents
      className={classes.dropzone}
    >
      <Box pos="relative" className={classes.paneRoot}>
        <Dropzone.Accept>
          <Box pos="absolute" inset={0} className={classes.acceptOverlay}>
            <Center h="100%" p="md">
              <Stack align="center" gap="md">
                <IconUpload
                  size={48}
                  stroke={1.2}
                  color="var(--mantine-color-blue-6)"
                  aria-hidden="true"
                />
                <Text size="lg" fw={600} ta="center">
                  Drop images to add to this folder
                </Text>
                <Text size="sm" c="dimmed" ta="center" maw={360}>
                  Release to import into "{selectedNode?.name ?? "folder"}"
                </Text>
              </Stack>
            </Center>
          </Box>
        </Dropzone.Accept>
        <Dropzone.Reject>
          <Box pos="absolute" inset={0} className={classes.rejectOverlay}>
            <Center h="100%" p="md">
              <Group gap="sm" wrap="nowrap">
                <IconX
                  size={40}
                  stroke={1.5}
                  color="var(--mantine-color-red-6)"
                  aria-hidden="true"
                />
                <Text fw={500} c="red">
                  Only image files are accepted
                </Text>
              </Group>
            </Center>
          </Box>
        </Dropzone.Reject>
        <Stack
          w="100%"
          maw="100%"
          h="100%"
          gap="md"
          pos="relative"
          className={classes.contentStack}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              items: paneBodyContextItems,
            });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Text
            size="lg"
            fw={600}
            lh={1.3}
            lineClamp={2}
            title={selectedNode?.name}
            onContextMenu={
              titleContextItems
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      items: titleContextItems,
                    });
                  }
                : undefined
            }
            className={selectedNode ? classes.contextMenuCursor : undefined}
          >
            {selectedNode?.name ?? "No folder selected"}
          </Text>

          {selectedNode ? (
            <>
              <Divider label="Subfolders" labelPosition="left" />
              {(selectedNode.children?.length ?? 0) > 0 ? (
                <Stack gap="xs">
                  {(selectedNode.children ?? []).map((child) => (
                    <Group
                      key={child.id}
                      justify="space-between"
                      wrap="nowrap"
                      gap="xs"
                    >
                      <Group gap={6} wrap="nowrap" className={classes.minWidthZero}>
                        <IconFolder
                          size={16}
                          color="var(--mantine-color-yellow-9)"
                          className={classes.noShrink}
                          aria-hidden="true"
                        />
                        <Text size="sm" truncate title={child.name}>
                          {child.name}
                        </Text>
                      </Group>
                      <Badge size="xs" variant="light" className={classes.noShrink}>
                        {child.photoCount === 1
                          ? "1 photo"
                          : `${child.photoCount} photos`}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed" fs="italic">
                  No subfolders in this folder yet.
                </Text>
              )}
            </>
          ) : null}

          {!selectedNode ? (
            <Center className={classes.emptyStateCenter}>
              <Text size="sm" c="dimmed" ta="center">
                Select a folder in the list to add or manage content.
              </Text>
            </Center>
          ) : selectedPhotos.length > 0 ? (
            <Stack>
              <SimpleGrid
                cols={{ base: 1, sm: 2 }}
                spacing="md"
                verticalSpacing="md"
              >
                {selectedPhotos.map((photo) => (
                  <Stack key={photo.id} gap={6}>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="xs" c="dimmed" truncate title={photo.fileName}>
                        {photo.fileName}
                      </Text>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        size="sm"
                        aria-label={`Remove ${photo.fileName}`}
                        onClick={() => void onRemoveFolderPhoto(photo.id)}
                        disabled={busy}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                    <Box className={classes.photoFrame}>
                      <Image
                        src={photo.dataUrl}
                        alt=""
                        loading="lazy"
                        radius="md"
                        fit="cover"
                        h={200}
                      />
                    </Box>
                  </Stack>
                ))}
              </SimpleGrid>
            </Stack>
          ) : (
            <Center className={classes.emptyStateCenter}>
              <Text size="sm" c="dimmed" fs="italic" ta="center">
                No photos in this folder. Drop images anywhere in this panel to add
                them.
              </Text>
            </Center>
          )}
        </Stack>
        <Menu
          opened={Boolean(contextMenu)}
          onClose={() => setContextMenu(null)}
          withinPortal
          shadow="md"
          closeOnItemClick
        >
          <Menu.Target>
            <Box
              aria-hidden="true"
              className={classes.contextAnchor}
              left={contextMenu?.x ?? -9999}
              top={contextMenu?.y ?? -9999}
            />
          </Menu.Target>
          <Menu.Dropdown>
            {(contextMenu?.items ?? []).map((item) => (
              <Menu.Item
                key={item.key}
                leftSection={item.icon}
                color={item.color}
                disabled={item.disabled}
                onClick={() => {
                  void item.onClick();
                  setContextMenu(null);
                }}
              >
                {item.title}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Box>
    </Dropzone>
  );
}
