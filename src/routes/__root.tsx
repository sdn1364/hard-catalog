import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ContextMenuProvider } from "mantine-contextmenu";
import { TitleBarOverlaySync } from "../title-bar-overlay-sync";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <MantineProvider defaultColorScheme="auto">
      <ContextMenuProvider>
        <TitleBarOverlaySync />
        <ModalsProvider>
          <Notifications position="bottom-right" limit={4} />
          <Outlet />
          {import.meta.env.DEV ? (
            <TanStackRouterDevtools position="bottom-right" />
          ) : null}
        </ModalsProvider>
      </ContextMenuProvider>
    </MantineProvider>
  );
}
