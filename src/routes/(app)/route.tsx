import { AppShell } from "@mantine/core";
import {
  Outlet,
  createFileRoute,
} from "@tanstack/react-router";
import { OpenTabsProvider } from "../../open-tabs-context";
import { AppTabBar } from "../../widgets/app-shell/app-tab-bar";

export const Route = createFileRoute("/(app)")({
  component: IndexLayout,
});

function AppHeader() {
  return <AppTabBar />;
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
