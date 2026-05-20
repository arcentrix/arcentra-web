import { proxy, useSnapshot } from "valtio";

const DOCK_PINNED_KEY = "UI_DOCK_PINNED";

function readDockPinned(): boolean {
  try {
    return localStorage.getItem(DOCK_PINNED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDockPinned(pinned: boolean) {
  try {
    localStorage.setItem(DOCK_PINNED_KEY, pinned ? "1" : "0");
  } catch {
    /* localStorage 不可用时静默忽略 */
  }
}

interface UIShellState {
  paletteOpen: boolean;
  copilotOpen: boolean;
  /** 左侧 AppDock 是否固定展开（点击收起/展开按钮切换，持久化）。 */
  dockPinned: boolean;
}

const state = proxy<UIShellState>({
  paletteOpen: false,
  copilotOpen: false,
  dockPinned: readDockPinned(),
});

export const uiShellStore = {
  state,
  useState: () => useSnapshot(state),
  openPalette: () => {
    state.paletteOpen = true;
  },
  closePalette: () => {
    state.paletteOpen = false;
  },
  togglePalette: () => {
    state.paletteOpen = !state.paletteOpen;
  },
  openCopilot: () => {
    state.copilotOpen = true;
  },
  closeCopilot: () => {
    state.copilotOpen = false;
  },
  toggleCopilot: () => {
    state.copilotOpen = !state.copilotOpen;
  },
  setPaletteOpen: (open: boolean) => {
    state.paletteOpen = open;
  },
  setCopilotOpen: (open: boolean) => {
    state.copilotOpen = open;
  },
  setDockPinned: (pinned: boolean) => {
    state.dockPinned = pinned;
    writeDockPinned(pinned);
  },
  toggleDockPinned: () => {
    state.dockPinned = !state.dockPinned;
    writeDockPinned(state.dockPinned);
  },
};
