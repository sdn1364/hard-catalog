import { notifications } from '@mantine/notifications'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getOsWindowTitle } from './workspace-title'

const TABS_STORAGE_KEY = 'hc-open-project-tabs'

export type ProjectTab = { filePath: string; name: string }

function normalizePathKey(p: string): string {
  return p.trim().replace(/\\/g, '/').toLowerCase()
}

function loadTabsFromStorage(): ProjectTab[] {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as { tabs?: unknown }
    if (!Array.isArray(data.tabs)) return []
    return data.tabs.filter(
      (x): x is ProjectTab =>
        x != null && typeof x === 'object' && typeof (x as ProjectTab).filePath === 'string' && typeof (x as ProjectTab).name === 'string',
    )
  } catch {
    return []
  }
}

type OpenTabsContextValue = {
  tabs: ProjectTab[]
  activeFilePath: string | null
  tabBusy: boolean
  ensureProjectTab: (state: CatalogState) => void
  selectHome: () => void
  selectProjectTab: (filePath: string) => Promise<void>
  closeProjectTab: (filePath: string) => Promise<void>
}

const OpenTabsContext = createContext<OpenTabsContextValue | null>(null)

export function OpenTabsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [tabs, setTabs] = useState<ProjectTab[]>(loadTabsFromStorage)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [tabBusy, setTabBusy] = useState(false)

  const ensureProjectTab = useCallback((state: CatalogState) => {
    if (!state.filePath) return
    const fp = state.filePath
    const name = (state.name ?? '').trim() || 'Untitled Catalog'
    setActiveFilePath(fp)
    setTabs((prev) => {
      const key = normalizePathKey(fp)
      const idx = prev.findIndex((t) => normalizePathKey(t.filePath) === key)
      let next: ProjectTab[]
      if (idx === -1) {
        next = [...prev, { filePath: fp, name }]
      } else {
        next = [...prev]
        next[idx] = { filePath: fp, name }
      }
      try {
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ tabs: next }))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  /** Keep tab labels and window title in sync with `project_meta.name` inside the open catalog file. */
  useEffect(() => {
    void window.hcApi.catalogGetState().then((s) => {
      if (!s.filePath) return
      ensureProjectTab(s)
    })
  }, [ensureProjectTab])

  useEffect(() => {
    if (pathname !== '/catalog') return
    void window.hcApi.catalogGetState().then((s) => {
      if (!s.filePath) return
      ensureProjectTab(s)
    })
  }, [pathname, ensureProjectTab])

  useEffect(() => {
    const title = getOsWindowTitle(pathname, activeFilePath, tabs)
    document.title = title
    void window.hcApi.setWindowTitle(title)
  }, [pathname, activeFilePath, tabs])

  const selectHome = useCallback(() => {
    void navigate({ to: '/' })
  }, [navigate])

  const selectProjectTab = useCallback(
    async (filePath: string) => {
      try {
        setTabBusy(true)
        const next = await window.hcApi.catalogOpen({ filePath })
        if (!next?.filePath) return
        ensureProjectTab(next)
        void navigate({ to: '/catalog' })
      } catch (error) {
        notifications.show({
          color: 'red',
          title: 'Could not open catalog',
          message: error instanceof Error ? error.message : 'Unexpected error',
        })
      } finally {
        setTabBusy(false)
      }
    },
    [ensureProjectTab, navigate],
  )

  const closeProjectTab = useCallback(
    async (filePath: string) => {
      const key = normalizePathKey(filePath)
      let activeState: CatalogState
      try {
        activeState = await window.hcApi.catalogGetState()
      } catch {
        activeState = { filePath: null, name: null, updatedAt: null }
      }
      const activeKey = activeState.filePath ? normalizePathKey(activeState.filePath) : null
      const isClosingActive = activeKey === key

      setTabs((prev) => {
        const idx = prev.findIndex((t) => normalizePathKey(t.filePath) === key)
        if (idx === -1) return prev
        const remaining = prev.filter((t) => normalizePathKey(t.filePath) !== key)
        const prevLen = prev.length
        try {
          localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ tabs: remaining }))
        } catch {
          /* ignore */
        }

        queueMicrotask(() => {
          void (async () => {
            if (!isClosingActive) return
            try {
              setTabBusy(true)
              if (remaining.length > 0) {
                let nextPath: string
                if (idx < prevLen - 1) {
                  nextPath = remaining[idx]!.filePath
                } else {
                  nextPath = remaining[idx - 1]!.filePath
                }
                const next = await window.hcApi.catalogOpen({ filePath: nextPath })
                if (next?.filePath) {
                  ensureProjectTab(next)
                  void navigate({ to: '/catalog' })
                }
              } else {
                await window.hcApi.catalogClose()
                setActiveFilePath(null)
                void navigate({ to: '/' })
              }
            } catch (error) {
              notifications.show({
                color: 'red',
                title: 'Action failed',
                message: error instanceof Error ? error.message : 'Unexpected error',
              })
            } finally {
              setTabBusy(false)
            }
          })()
        })

        return remaining
      })
    },
    [ensureProjectTab, navigate],
  )

  const value = useMemo<OpenTabsContextValue>(
    () => ({
      tabs,
      activeFilePath,
      tabBusy,
      ensureProjectTab,
      selectHome,
      selectProjectTab,
      closeProjectTab,
    }),
    [tabs, activeFilePath, tabBusy, ensureProjectTab, selectHome, selectProjectTab, closeProjectTab],
  )

  return <OpenTabsContext.Provider value={value}>{children}</OpenTabsContext.Provider>
}

export function useOpenTabs(): OpenTabsContextValue {
  const ctx = useContext(OpenTabsContext)
  if (!ctx) throw new Error('useOpenTabs must be used within OpenTabsProvider')
  return ctx
}
