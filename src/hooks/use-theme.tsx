import { useSyncExternalStore } from "react";
import { useSnapshot } from "valtio";
import { themeStore, type Theme } from "@/store/theme";

function getResolvedTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

export function useTheme() {
  const snap = useSnapshot(themeStore);

  const resolvedTheme = useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => getResolvedTheme(snap.theme),
  );

  return {
    theme: snap.theme,
    resolvedTheme,
    setTheme: themeStore.setTheme,
  };
}

export type { Theme };
