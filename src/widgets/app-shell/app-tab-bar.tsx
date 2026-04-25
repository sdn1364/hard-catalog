import { ActionIcon, Box, Tabs, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSmartHome, IconX } from "@tabler/icons-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createCatalogHeaderActions } from "../../features/project/save/catalog-header-actions";
import { useOpenTabs } from "../../open-tabs-context";
import classes from "./app-tab-bar.module.css";

const HOME_TAB = "home";

function projectTabValue(filePath: string): string {
  return `p:${encodeURIComponent(filePath)}`;
}

function parseProjectTabValue(value: string): string | null {
  if (!value.startsWith("p:")) return null;
  return decodeURIComponent(value.slice(2));
}

export function AppTabBar() {
  const [windowFullscreen, setWindowFullscreen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const {
    tabs,
    activeFilePath,
    tabBusy,
    ensureProjectTab,
    selectHome,
    selectProjectTab,
    closeProjectTab,
  } = useOpenTabs();

  const activeTabValue = useMemo(() => {
    if (pathname === "/") return HOME_TAB;
    if (pathname === "/catalog" && activeFilePath) {
      return projectTabValue(activeFilePath);
    }
    return HOME_TAB;
  }, [pathname, activeFilePath]);

  useEffect(() => {
    if (window.hcApi.platform !== "darwin") return;
    void window.hcApi.isWindowFullscreen().then(setWindowFullscreen);
    return window.hcApi.onFullscreenChange(setWindowFullscreen);
  }, []);

  const onTabChange = (value: string | null) => {
    if (!value || tabBusy) return;
    if (value === HOME_TAB) {
      selectHome();
      return;
    }
    const path = parseProjectTabValue(value);
    if (path) void selectProjectTab(path);
  };

  const navigateToCatalog = useCallback(
    () => {
      void navigate({ to: "/catalog" });
    },
    [navigate],
  );

  const headerActions = useMemo(
    () =>
      createCatalogHeaderActions({
        ensureProjectTab,
        navigateToCatalog,
      }),
    [ensureProjectTab, navigateToCatalog],
  );

  const runHeaderAction = async (fn: () => Promise<void>) => {
    if (tabBusy) return;
    try {
      await fn();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Action failed",
        message: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  };

  return (
    <Tabs
      value={activeTabValue}
      onChange={onTabChange}
      variant="outline"
      radius="xs"
      className={classes.tabsRoot}
      classNames={{
        tab: classes.tab,
        list: [
          classes.list,
          window.hcApi.platform === "darwin" && !windowFullscreen
            ? classes.listDarwinWindowed
            : classes.listDefaultPadding,
        ].join(" "),
      }}
    >
      <Tabs.List aria-label="Workspace" justify="flex-start">
        <Tabs.Tab
          value={HOME_TAB}
          leftSection={<IconSmartHome size={16} stroke={1.75} />}
          aria-label="Home"
          disabled={tabBusy}
        />

        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.filePath}
            value={projectTabValue(tab.filePath)}
            disabled={tabBusy}
            title={tab.name}
            rightSection={
              <Tooltip label="Close tab">
                <ActionIcon
                  component="span"
                  variant="subtle"
                  color="gray"
                  disabled={tabBusy}
                  size="xs"
                  radius="xs"
                  aria-label={`Close ${tab.name}`}
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

        <Box className={classes.headerActions}>
          <ActionIcon.Group>
            {headerActions.map((action) => {
              const Icon = action.icon;
              return (
                <Tooltip key={action.value} label={action.label}>
                  <ActionIcon
                    variant="default"
                    radius="sm"
                    className={classes.headerActionIcon}
                    aria-label={action.label}
                    disabled={tabBusy}
                    onClick={() => {
                      void runHeaderAction(action.onClick);
                    }}
                  >
                    <Icon size={16} />
                  </ActionIcon>
                </Tooltip>
              );
            })}
          </ActionIcon.Group>
        </Box>
      </Tabs.List>
    </Tabs>
  );
}
