import { proxy, useSnapshot } from "valtio";

interface UIShellState {
  paletteOpen: boolean;
  copilotOpen: boolean;
}

const state = proxy<UIShellState>({
  paletteOpen: false,
  copilotOpen: false,
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
};
