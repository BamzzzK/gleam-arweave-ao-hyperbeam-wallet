import { browser } from "wxt/browser";
import type { SidePanelPort } from "@gleam/app/src/app-platform/types.ts";

/**
 * `sidePanel.open` needs the window id and a live user gesture, so the id
 * is looked up when the surface loads rather than after the click.
 */
export function createSidePanelPort(surface: "popup" | "sidepanel"): SidePanelPort {
  // Absent outside a real extension page, such as under tests.
  const windows = browser.windows as typeof browser.windows | undefined;
  const windowId: Promise<number | undefined> = surface === "popup" && windows
    ? windows.getCurrent().then((win) => win.id, () => undefined)
    : Promise.resolve(undefined);
  return {
    docked: surface === "sidepanel",
    async toggle() {
      if (surface === "popup") {
        const id = await windowId;
        if (id === undefined) return;
        await browser.sidePanel.open({ windowId: id });
        window.close();
        return;
      }
      // `action.openPopup` from an extension page needs Chrome 127; on an
      // older browser the panel stays open rather than leaving no surface.
      await browser.action.openPopup();
      window.close();
    },
  };
}
