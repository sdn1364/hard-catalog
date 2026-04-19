import { useComputedColorScheme, useMantineTheme } from "@mantine/core";
import { useEffect } from "react";

/** Matches `AppShell` header height in `(app)/route.tsx`. */
const HEADER_HEIGHT = 39;

/**
 * Keeps Electron Window Controls Overlay (min/max/close) colors aligned with the
 * Mantine scheme so they are not stuck on the OS default, and hover feedback
 * stays visible against the real header background.
 */
export function TitleBarOverlaySync() {
  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme("light");
  const color = colorScheme === "dark" ? "transparent" : theme.white;
  const symbolColor =
    colorScheme === "dark" ? theme.colors.dark[0] : theme.colors.dark[9];

  useEffect(() => {
    void window.hcApi.setTitleBarOverlay({
      color,
      symbolColor,
      height: HEADER_HEIGHT,
    });
  }, [color, symbolColor]);

  return null;
}
