import { useMantineTheme } from "@mantine/core";
import { useEffect } from "react";

/** Matches `AppShell` header height in `(app)/route.tsx`. */
const HEADER_HEIGHT = 39;

/**
 * Keeps Electron Window Controls Overlay (min/max/close) aligned with the header:
 * transparent caption region so the tab bar shows through, with symbols readable
 * on `AppTabBar`'s `dark[5]` strip.
 */
/** Electron WCO on Windows rejects the keyword `transparent`; use ARGB hex. */
const OVERLAY_BG_TRANSPARENT = "#00000000";

export function TitleBarOverlaySync() {
  const theme = useMantineTheme();
  const symbolColor = theme.colors.dark[0];

  useEffect(() => {
    void window.hcApi.setTitleBarOverlay({
      color: OVERLAY_BG_TRANSPARENT,
      symbolColor,
      height: HEADER_HEIGHT,
    });
  }, [symbolColor]);

  return null;
}
