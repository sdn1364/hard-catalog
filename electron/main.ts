import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { BrowserWindow, Menu, app, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  closeDatabase,
  folderAssets,
  folders,
  getCurrentDbPath,
  getOrm,
  openDatabase,
  projectMeta,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let currentCatalogPath: string | null = null;

/** Last value sent on `window:fullscreen-changed` (single-window app). */
let lastSentFullscreen = false;

function windowIsFullscreenLike(win: BrowserWindow): boolean {
  if (win.isFullScreen()) return true;
  if (process.platform === "darwin" && win.isSimpleFullScreen()) return true;
  return false;
}

function publishFullscreenIfChanged(win: BrowserWindow): void {
  const fs = windowIsFullscreenLike(win);
  if (fs === lastSentFullscreen) return;
  lastSentFullscreen = fs;
  if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send("window:fullscreen-changed", fs);
  }
}

const RECENT_MAX = 15;

/** Stored in catalog SQLite `project_meta` as text (base64 payload + mime). */
const META_COVER_MIME = "project_cover_mime";
const META_COVER_BASE64 = "project_cover_base64";

type RecentEntry = {
  filePath: string;
  name: string;
  lastOpenedAt: number;
};

function getRecentStorePath(): string {
  return path.join(app.getPath("userData"), "recent-projects.json");
}

function loadRecentStore(): RecentEntry[] {
  const storePath = getRecentStorePath();
  try {
    if (!fs.existsSync(storePath)) return [];
    const raw = fs.readFileSync(storePath, "utf8");
    const data = JSON.parse(raw) as { items?: RecentEntry[] };
    if (!Array.isArray(data.items)) return [];
    return data.items.filter((x) => x && typeof x.filePath === "string");
  } catch {
    return [];
  }
}

function saveRecentStore(items: RecentEntry[]): void {
  const storePath = getRecentStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify({ items }, null, 2), "utf8");
}

function touchRecent(state: {
  filePath: string | null;
  name: string | null;
}): void {
  if (!state.filePath) return;
  const fp = path.normalize(state.filePath);
  const name = (state.name || "").trim() || defaultProjectName(fp);
  const now = Date.now();
  const next = loadRecentStore().filter(
    (e) => path.normalize(e.filePath) !== fp,
  );
  next.unshift({ filePath: fp, name, lastOpenedAt: now });
  saveRecentStore(next.slice(0, RECENT_MAX));
}

/** Legacy: copied cover files from older app versions. */
function deleteCoverFileIfAny(coverPath: string | undefined): void {
  if (!coverPath) return;
  try {
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  } catch {
    // ignore
  }
}

function withCatalogFile<T>(catalogFilePath: string, fn: () => T): T {
  const fp = path.normalize(catalogFilePath);
  if (!fs.existsSync(fp)) throw new Error("Catalog file not found.");
  const prevMain = currentCatalogPath;
  currentCatalogPath = fp;
  openDatabase(fp);
  try {
    return fn();
  } finally {
    currentCatalogPath = prevMain;
    if (prevMain && fs.existsSync(prevMain)) {
      openDatabase(prevMain);
    } else {
      closeDatabase();
    }
  }
}

function readProjectCoverDataUrl(): string | null {
  const db = getOrm();
  const mimeRow = db
    .select({ value: projectMeta.value })
    .from(projectMeta)
    .where(eq(projectMeta.key, META_COVER_MIME))
    .get() as { value: string } | undefined;
  const b64Row = db
    .select({ value: projectMeta.value })
    .from(projectMeta)
    .where(eq(projectMeta.key, META_COVER_BASE64))
    .get() as { value: string } | undefined;
  if (!mimeRow?.value || !b64Row?.value) return null;
  return `data:${mimeRow.value};base64,${b64Row.value}`;
}

function readCoverDataUrlForCatalogPath(catalogFilePath: string): string | null {
  const fp = path.normalize(catalogFilePath);
  if (!fs.existsSync(fp)) return null;
  try {
    return withCatalogFile(fp, () => readProjectCoverDataUrl());
  } catch {
    return null;
  }
}

function writeProjectCoverFromFile(sourceImagePath: string): void {
  const src = path.normalize(sourceImagePath);
  if (!fs.existsSync(src)) throw new Error("Image file not found.");
  const buf = fs.readFileSync(src);
  const mime = inferMimeType(src);
  const b64 = buf.toString("base64");
  const db = getOrm();
  db.insert(projectMeta)
    .values({ key: META_COVER_MIME, value: mime })
    .onConflictDoUpdate({
      target: projectMeta.key,
      set: { value: mime },
    })
    .run();
  db.insert(projectMeta)
    .values({ key: META_COVER_BASE64, value: b64 })
    .onConflictDoUpdate({
      target: projectMeta.key,
      set: { value: b64 },
    })
    .run();
  touchProjectUpdatedAt();
}

function clearProjectCoverInDb(): void {
  const db = getOrm();
  db.delete(projectMeta)
    .where(inArray(projectMeta.key, [META_COVER_MIME, META_COVER_BASE64]))
    .run();
}

function listRecentProjects(): Array<
  RecentEntry & { exists: boolean; coverImageUrl: string | null }
> {
  return loadRecentStore().map((e) => {
    const fp = path.normalize(e.filePath);
    let coverImageUrl: string | null = null;
    if (fs.existsSync(fp)) {
      coverImageUrl = readCoverDataUrlForCatalogPath(fp);
    }
    return { ...e, filePath: fp, exists: fs.existsSync(fp), coverImageUrl };
  });
}

function removeRecentProject(filePath: string): void {
  const fp = path.normalize(filePath);
  const items = loadRecentStore();
  const found = items.find((e) => path.normalize(e.filePath) === fp);
  const legacy = found as RecentEntry & { coverImagePath?: string };
  if (legacy?.coverImagePath) deleteCoverFileIfAny(legacy.coverImagePath);
  const next = items.filter((e) => path.normalize(e.filePath) !== fp);
  saveRecentStore(next);
}

type FolderTreeNode = {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  createdAt: number;
  updatedAt: number;
  children: FolderTreeNode[];
  image?: {
    fileName: string;
    mimeType: string;
    dataUrl: string;
    updatedAt: number;
  } | null;
};

function applyInitialTitleBarOverlay(win: BrowserWindow): void {
  if (process.platform !== "win32" && process.platform !== "linux") return;
  win.setTitleBarOverlay({
    // Windows WCO does not accept the CSS keyword `transparent` here.
    color: "#00000000",
    symbolColor: "#c1c2c5",
    height: 48,
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hidden",
    titleBarOverlay: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) applyInitialTitleBarOverlay(mainWindow);
    mainWindow?.show();
    if (mainWindow) publishFullscreenIfChanged(mainWindow);
  });

  const onFullscreenMaybeChanged = (): void => {
    if (mainWindow && !mainWindow.isDestroyed())
      publishFullscreenIfChanged(mainWindow);
  };
  mainWindow.on("enter-full-screen", onFullscreenMaybeChanged);
  mainWindow.on("leave-full-screen", onFullscreenMaybeChanged);
  if (process.platform === "darwin") {
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    mainWindow.on("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onFullscreenMaybeChanged, 80);
    });
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc(): void {
  ipcMain.handle(
    "catalog:new",
    async (_e, payload?: { filePath?: string; projectName?: string }) => {
      const chosen =
        payload?.filePath ??
        (await pickCatalogPath({
          title: "Create Catalog File",
          buttonLabel: "Create Catalog",
        }));
      if (!chosen) return null;

      ensureDbDirectory(chosen);
      if (fs.existsSync(chosen)) fs.rmSync(chosen, { force: true });

      currentCatalogPath = chosen;
      openDatabase(chosen);
      const db = getOrm();
      const now = Date.now();
      db.update(projectMeta)
        .set({
          value: payload?.projectName?.trim() || defaultProjectName(chosen),
        })
        .where(eq(projectMeta.key, "name"))
        .run();
      db.update(projectMeta)
        .set({ value: String(now) })
        .where(eq(projectMeta.key, "updated_at"))
        .run();
      const state = getProjectState();
      touchRecent(state);
      return state;
    },
  );

  ipcMain.handle(
    "catalog:open",
    async (_e, payload?: { filePath?: string }) => {
      const chosen =
        payload?.filePath ??
        (await pickExistingCatalogPath({
          title: "Open Catalog File",
          buttonLabel: "Open Catalog",
        }));
      if (!chosen) return null;
      ensureDbDirectory(chosen);
      currentCatalogPath = chosen;
      openDatabase(chosen);
      const state = getProjectState();
      touchRecent(state);
      return state;
    },
  );

  ipcMain.handle("catalog:save", () => {
    if (!currentCatalogPath) return null;
    touchProjectUpdatedAt();
    return getProjectState();
  });

  ipcMain.handle(
    "catalog:saveAs",
    async (_e, payload?: { filePath?: string }) => {
      const source = currentCatalogPath ?? getCurrentDbPath();
      if (!source || !fs.existsSync(source)) return null;
      const target =
        payload?.filePath ??
        (await pickCatalogPath({
          title: "Save Catalog As",
          buttonLabel: "Save Copy",
        }));
      if (!target) return null;
      ensureDbDirectory(target);
      if (source !== target) fs.copyFileSync(source, target);
      currentCatalogPath = target;
      openDatabase(target);
      touchProjectUpdatedAt();
      const state = getProjectState();
      touchRecent(state);
      return state;
    },
  );

  ipcMain.handle("catalog:getState", () => getProjectState());

  ipcMain.handle("catalog:close", () => {
    currentCatalogPath = null;
    closeDatabase();
  });

  ipcMain.handle("window:setTitle", (_e, title: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (win && !win.isDestroyed()) win.setTitle(title);
  });

  ipcMain.handle("window:isFullscreen", () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!win || win.isDestroyed()) return false;
    return windowIsFullscreenLike(win);
  });

  ipcMain.handle(
    "window:setTitleBarOverlay",
    (_e, opts: { color?: string; symbolColor?: string; height?: number }) => {
      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
      if (!win || win.isDestroyed()) return;
      if (process.platform !== "win32" && process.platform !== "linux") return;
      const patch =
        opts.color === "transparent" ? { ...opts, color: "#00000000" } : opts;
      win.setTitleBarOverlay(patch);
    },
  );

  ipcMain.handle("catalog:listRecent", () => listRecentProjects());

  ipcMain.handle("catalog:removeRecent", (_e, filePath: string) => {
    removeRecentProject(filePath);
  });

  ipcMain.handle(
    "catalog:updateRecentProject",
    (
      _e,
      payload: {
        filePath: string;
        name?: string;
        sourceImagePath?: string | null;
        clearCover?: boolean;
      },
    ) => {
      const fp = path.normalize(payload.filePath);
      const items = loadRecentStore();
      const idx = items.findIndex((e) => path.normalize(e.filePath) === fp);
      if (idx < 0) throw new Error("Project is not in the recent list.");
      if (!fs.existsSync(fp)) throw new Error("Catalog file not found.");

      if (typeof payload.name === "string") {
        const nextName = payload.name.trim() || defaultProjectName(fp);
        items[idx] = { ...items[idx], name: nextName };
        withCatalogFile(fp, () => {
          const db = getOrm();
          db.update(projectMeta)
            .set({ value: nextName })
            .where(eq(projectMeta.key, "name"))
            .run();
          touchProjectUpdatedAt();
        });
      }

      if (payload.clearCover) {
        withCatalogFile(fp, () => {
          clearProjectCoverInDb();
          touchProjectUpdatedAt();
        });
      } else if (
        payload.sourceImagePath != null &&
        payload.sourceImagePath !== ""
      ) {
        const src = path.normalize(payload.sourceImagePath);
        withCatalogFile(fp, () => {
          writeProjectCoverFromFile(src);
        });
      }

      saveRecentStore(items);
    },
  );

  ipcMain.handle("dialog:pickImageFile", async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const openFileProperties: Array<"openFile"> = ["openFile"];
    const dialogOptions = {
      properties: openFileProperties,
      filters: [
        {
          name: "Images",
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "gif",
            "bmp",
            "tif",
            "tiff",
          ],
        },
      ],
    };
    const r = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (r.canceled || r.filePaths.length === 0) return null;
    return r.filePaths[0] ?? null;
  });

  ipcMain.handle("project:setName", (_e, name: string) => {
    const db = requireOrm();
    db.update(projectMeta)
      .set({ value: (name || "").trim() || "Untitled Catalog" })
      .where(eq(projectMeta.key, "name"))
      .run();
    touchProjectUpdatedAt();
  });

  ipcMain.handle("folders:getTree", () => {
    const db = requireOrm();
    const rows = db
      .select({
        id: folders.id,
        parent_id: folders.parentId,
        name: folders.name,
        position: folders.position,
        created_at: folders.createdAt,
        updated_at: folders.updatedAt,
        image_blob: folderAssets.imageBlob,
        image_name: folderAssets.imageName,
        image_mime: folderAssets.imageMime,
        image_updated_at: folderAssets.updatedAt,
      })
      .from(folders)
      .leftJoin(folderAssets, eq(folderAssets.folderId, folders.id))
      .orderBy(asc(folders.position), sql`${folders.name} COLLATE NOCASE`)
      .all() as {
      id: string;
      parent_id: string | null;
      name: string;
      position: number;
      created_at: number;
      updated_at: number;
      image_blob: Buffer | null;
      image_name: string | null;
      image_mime: string | null;
      image_updated_at: number | null;
    }[];

    return buildTree(rows);
  });

  ipcMain.handle("folders:seedDemo", () => {
    const db = requireOrm();
    const hasAnyFolder = db
      .select({ id: folders.id })
      .from(folders)
      .limit(1)
      .get();
    if (hasAnyFolder)
      throw new Error("Seed data can only be added to an empty catalog.");

    const now = Date.now();

    const seedRows: Array<{
      id: string;
      parentId: string | null;
      name: string;
      position: number;
    }> = [
      { id: randomUUID(), parentId: null, name: "Photography", position: 0 },
      { id: randomUUID(), parentId: null, name: "Design", position: 1 },
      { id: randomUUID(), parentId: null, name: "Archive", position: 2 },
    ];

    const photographyId = seedRows[0].id;
    const designId = seedRows[1].id;
    const archiveId = seedRows[2].id;

    seedRows.push(
      { id: randomUUID(), parentId: photographyId, name: "RAW", position: 0 },
      { id: randomUUID(), parentId: photographyId, name: "Edits", position: 1 },
      {
        id: randomUUID(),
        parentId: photographyId,
        name: "Exports",
        position: 2,
      },
      { id: randomUUID(), parentId: designId, name: "Branding", position: 0 },
      { id: randomUUID(), parentId: designId, name: "UI", position: 1 },
      { id: randomUUID(), parentId: archiveId, name: "2024", position: 0 },
      { id: randomUUID(), parentId: archiveId, name: "2025", position: 1 },
    );

    const photographyRawId = seedRows[3].id;
    const photographyEditsId = seedRows[4].id;
    const designUiId = seedRows[7].id;
    const archive2025Id = seedRows[9].id;

    seedRows.push(
      {
        id: randomUUID(),
        parentId: photographyRawId,
        name: "Wedding",
        position: 0,
      },
      {
        id: randomUUID(),
        parentId: photographyRawId,
        name: "Travel",
        position: 1,
      },
      {
        id: randomUUID(),
        parentId: photographyEditsId,
        name: "Client Finals",
        position: 0,
      },
      { id: randomUUID(), parentId: designUiId, name: "Mobile", position: 0 },
      { id: randomUUID(), parentId: designUiId, name: "Desktop", position: 1 },
      { id: randomUUID(), parentId: archive2025Id, name: "Q1", position: 0 },
      { id: randomUUID(), parentId: archive2025Id, name: "Q2", position: 1 },
    );

    db.transaction((trx) => {
      for (const row of seedRows) {
        trx
          .insert(folders)
          .values({
            id: row.id,
            parentId: row.parentId,
            name: row.name,
            position: row.position,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    });
    touchProjectUpdatedAt();
  });

  ipcMain.handle(
    "folders:add",
    (_e, payload: { parentId: string | null; name: string }) => {
      const db = requireOrm();
      const parentId = payload.parentId ?? null;
      const folderName = (payload.name || "").trim() || "Folder";
      const dupe = db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            parentId
              ? eq(folders.parentId, parentId)
              : isNull(folders.parentId),
            sql`lower(${folders.name}) = lower(${folderName})`,
          ),
        )
        .limit(1)
        .get();
      if (dupe)
        throw new Error(
          "A folder with this name already exists at this level.",
        );

      if (parentId) {
        const hasImage = db
          .select({ folderId: folderAssets.folderId })
          .from(folderAssets)
          .where(eq(folderAssets.folderId, parentId))
          .limit(1)
          .get();
        if (hasImage)
          throw new Error(
            "Remove the parent folder image before adding subfolders.",
          );
      }

      const maxPos =
        db
          .select({
            n: sql<number>`COALESCE(MAX(${folders.position}), -1) + 1`,
          })
          .from(folders)
          .where(
            parentId
              ? eq(folders.parentId, parentId)
              : isNull(folders.parentId),
          )
          .get()?.n ?? 0;

      const now = Date.now();
      db.insert(folders)
        .values({
          id: randomUUID(),
          parentId,
          name: folderName,
          position: maxPos,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      touchProjectUpdatedAt();
    },
  );

  ipcMain.handle(
    "folders:rename",
    (_e, payload: { id: string; name: string }) => {
      const db = requireOrm();
      const row = db
        .select({ parent_id: folders.parentId })
        .from(folders)
        .where(eq(folders.id, payload.id))
        .get() as { parent_id: string | null } | undefined;
      if (!row) throw new Error("Folder not found.");
      const nextName = (payload.name || "").trim() || "Folder";
      const duplicate = db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            row.parent_id
              ? eq(folders.parentId, row.parent_id)
              : isNull(folders.parentId),
            ne(folders.id, payload.id),
            sql`lower(${folders.name}) = lower(${nextName})`,
          ),
        )
        .limit(1)
        .get();
      if (duplicate)
        throw new Error("A sibling folder with this name already exists.");
      db.update(folders)
        .set({ name: nextName, updatedAt: Date.now() })
        .where(eq(folders.id, payload.id))
        .run();
      touchProjectUpdatedAt();
    },
  );

  ipcMain.handle("folders:remove", (_e, id: string) => {
    const db = requireOrm();
    db.delete(folders).where(eq(folders.id, id)).run();
    touchProjectUpdatedAt();
  });

  ipcMain.handle(
    "folders:setLeafImage",
    (_e, payload: { folderId: string; imagePath: string }) => {
      const db = requireOrm();
      assertLeafFolder(db, payload.folderId);
      const normalizedPath = path.normalize(payload.imagePath);
      const imageData = fs.readFileSync(normalizedPath);
      const imageName = path.basename(normalizedPath);
      const imageMime = inferMimeType(normalizedPath);
      const now = Date.now();
      db.insert(folderAssets)
        .values({
          folderId: payload.folderId,
          imageBlob: imageData,
          imageName,
          imageMime,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: folderAssets.folderId,
          set: {
            imageBlob: imageData,
            imageName,
            imageMime,
            updatedAt: now,
          },
        })
        .run();
      db.update(folders)
        .set({ updatedAt: now })
        .where(eq(folders.id, payload.folderId))
        .run();
      touchProjectUpdatedAt();
    },
  );

  ipcMain.handle("folders:clearLeafImage", (_e, folderId: string) => {
    const db = requireOrm();
    db.delete(folderAssets).where(eq(folderAssets.folderId, folderId)).run();
    db.update(folders)
      .set({ updatedAt: Date.now() })
      .where(eq(folders.id, folderId))
      .run();
    touchProjectUpdatedAt();
  });
}

function getProjectState(): {
  filePath: string | null;
  name: string | null;
  updatedAt: number | null;
} {
  const activePath = currentCatalogPath ?? getCurrentDbPath();
  if (!activePath) return { filePath: null, name: null, updatedAt: null };
  if (!fs.existsSync(activePath))
    return { filePath: activePath, name: null, updatedAt: null };
  const db = getOrm();
  const nameRow = db
    .select({ value: projectMeta.value })
    .from(projectMeta)
    .where(eq(projectMeta.key, "name"))
    .get() as { value: string } | undefined;
  const updatedRow = db
    .select({ value: projectMeta.value })
    .from(projectMeta)
    .where(eq(projectMeta.key, "updated_at"))
    .get() as { value: string } | undefined;
  const rawUpdated = updatedRow?.value != null ? Number(updatedRow.value) : NaN;
  const updatedAt = Number.isFinite(rawUpdated) ? rawUpdated : null;
  return {
    filePath: activePath,
    name: nameRow?.value ?? defaultProjectName(activePath),
    updatedAt,
  };
}

function requireOrm() {
  const activePath = currentCatalogPath ?? getCurrentDbPath();
  if (!activePath) throw new Error("No catalog file is open.");
  if (!fs.existsSync(activePath))
    throw new Error("Catalog file does not exist.");
  return getOrm();
}

function touchProjectUpdatedAt(): void {
  const db = requireOrm();
  db.update(projectMeta)
    .set({ value: String(Date.now()) })
    .where(eq(projectMeta.key, "updated_at"))
    .run();
}

function ensureDbDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function defaultProjectName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function buildTree(
  rows: {
    id: string;
    parent_id: string | null;
    name: string;
    position: number;
    created_at: number;
    updated_at: number;
    image_blob: Buffer | null;
    image_name: string | null;
    image_mime: string | null;
    image_updated_at: number | null;
  }[],
): FolderTreeNode[] {
  const nodes = new Map<string, FolderTreeNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      children: [],
      image:
        row.image_blob && row.image_name && row.image_mime
          ? {
              fileName: row.image_name,
              mimeType: row.image_mime,
              dataUrl: `data:${row.image_mime};base64,${row.image_blob.toString("base64")}`,
              updatedAt: row.image_updated_at ?? row.updated_at,
            }
          : null,
    });
  }

  const roots: FolderTreeNode[] = [];
  for (const node of nodes.values()) {
    if (!node.parentId) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (list: FolderTreeNode[]) => {
    list.sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
    for (const child of list) sortTree(child.children);
  };
  sortTree(roots);
  return roots;
}

function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

function assertLeafFolder(
  db: ReturnType<typeof getOrm>,
  folderId: string,
): void {
  const exists = db
    .select({ id: folders.id })
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1)
    .get();
  if (!exists) throw new Error("Folder not found.");
  const child = db
    .select({ id: folders.id })
    .from(folders)
    .where(eq(folders.parentId, folderId))
    .limit(1)
    .get();
  if (child)
    throw new Error("Only bottom-most folders can have a preview image.");
}

async function pickCatalogPath(opts: {
  title: string;
  buttonLabel: string;
}): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const dialogOptions = {
    title: opts.title,
    buttonLabel: opts.buttonLabel,
    filters: [
      { name: "Hard Catalog File", extensions: ["hcatalog", "db", "sqlite"] },
    ],
  };
  const result = win
    ? await dialog.showSaveDialog(win, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

async function pickExistingCatalogPath(opts: {
  title: string;
  buttonLabel: string;
}): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const openFileProperties: Array<"openFile"> = ["openFile"];
  const dialogOptions = {
    title: opts.title,
    buttonLabel: opts.buttonLabel,
    properties: openFileProperties,
    filters: [
      { name: "Hard Catalog File", extensions: ["hcatalog", "db", "sqlite"] },
    ],
  };
  const result = win
    ? await dialog.showOpenDialog(win, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0] ?? null;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  closeDatabase();
  if (process.platform !== "darwin") app.quit();
});
