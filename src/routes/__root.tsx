import type { QueryClient } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ContextMenuProvider } from "mantine-contextmenu";
import { TitleBarOverlaySync } from "../title-bar-overlay-sync";

type AppRouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<AppRouterContext>()({
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
