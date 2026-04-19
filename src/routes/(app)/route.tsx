import {
  ActionIcon,
  AppShell,
  Scroller,
  Tabs,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { IconHome, IconX } from "@tabler/icons-react";
import {
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { OpenTabsProvider, useOpenTabs } from "../../open-tabs-context";

export const Route = createFileRoute("/(app)")({
  component: IndexLayout,
});

const HOME_TAB = "home";

function projectTabValue(filePath: string): string {
  return `p:${encodeURIComponent(filePath)}`;
}

function parseProjectTabValue(value: string): string | null {
  if (!value.startsWith("p:")) return null;
  return decodeURIComponent(value.slice(2));
}

function AppHeader() {
  return <AppTabBar />;
}

function AppTabBar() {
  const theme = useMantineTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    tabs,
    activeFilePath,
    tabBusy,
    selectHome,
    selectProjectTab,
    closeProjectTab,
  } = useOpenTabs();

  const activeTabValue = useMemo(() => {
    if (pathname === "/") return HOME_TAB;
    if (pathname === "/catalog" && activeFilePath)
      return projectTabValue(activeFilePath);
    return HOME_TAB;
  }, [pathname, activeFilePath]);

  const onTabChange = (value: string | null) => {
    if (!value || tabBusy) return;
    if (value === HOME_TAB) {
      selectHome();
      return;
    }
    const path = parseProjectTabValue(value);
    if (path) void selectProjectTab(path);
  };

  return (
    <Tabs
      value={activeTabValue}
      onChange={onTabChange}
      variant="outline"
      radius="xs"
      activateTabWithKeyboard={false}
      style={{ flex: 1, minWidth: 0 }}
      styles={{
        list: {
          flexWrap: "nowrap",
          flex: 1,
          alignSelf: "stretch",
          backgroundColor: theme.colors.dark[5],
        },
      }}
    >
      <Tabs.List aria-label="Workspace" justify="flex-start">
        <Tabs.Tab
          value={HOME_TAB}
          leftSection={<IconHome size={16} stroke={1.75} />}
          disabled={tabBusy}
        />
        <Scroller
          style={{
            flex: 1,
            minWidth: 0,
            // Drag the window from the tab strip; tabs use no-drag so they stay clickable.
            WebkitAppRegion: "drag",
          }}
        >
          {tabs.map((tab) => (
            <Tabs.Tab
              key={tab.filePath}
              value={projectTabValue(tab.filePath)}
              disabled={tabBusy}
              title={tab.name}
              style={{ maxWidth: 220, WebkitAppRegion: "no-drag" }}
              rightSection={
                <Tooltip label="Close tab">
                  <ActionIcon
                    component="span"
                    variant="subtle"
                    color="gray"
                    disabled={tabBusy}
                    size="xs"
                    radius="xs"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void closeProjectTab(tab.filePath);
                    }}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Tooltip>
              }
            >
              {tab.name}
            </Tabs.Tab>
          ))}
        </Scroller>
      </Tabs.List>
    </Tabs>
  );
}

function IndexLayout() {
  return (
    <OpenTabsProvider>
      <AppShell header={{ height: 48 }} withBorder={false}>
        <AppShell.Header>
          <AppHeader />
        </AppShell.Header>
        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </OpenTabsProvider>
  );
}
