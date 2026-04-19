/** Shown in the OS / browser title bar when no project is focused */
export const APP_WINDOW_TITLE = 'Hard Catalog'

export type ProjectTabLike = { filePath: string; name: string }

function normalizePathKey(p: string): string {
  return p.trim().replace(/\\/g, '/').toLowerCase()
}

/** Project or "Catalog" / file stem — shared by in-app header and window title */
export function resolveOpenWorkspaceName(
  pathname: string,
  activeFilePath: string | null,
  tabs: ProjectTabLike[],
): string {
  if (pathname === '/') return 'Home'
  if (pathname === '/catalog' && activeFilePath) {
    const tab = tabs.find((t) => normalizePathKey(t.filePath) === normalizePathKey(activeFilePath))
    if (tab?.name) return tab.name
    const parts = activeFilePath.split(/[/\\]/)
    const base = parts[parts.length - 1]
    return base?.replace(/\.[^.]+$/, '') || 'Catalog'
  }
  return 'Home'
}

/** Native window / document title */
export function getOsWindowTitle(pathname: string, activeFilePath: string | null, tabs: ProjectTabLike[]): string {
  if (pathname === '/') return APP_WINDOW_TITLE
  if (pathname === '/catalog' && activeFilePath) {
    const name = resolveOpenWorkspaceName(pathname, activeFilePath, tabs)
    if (name === 'Home') return APP_WINDOW_TITLE
    return `${name} — ${APP_WINDOW_TITLE}`
  }
  return APP_WINDOW_TITLE
}
