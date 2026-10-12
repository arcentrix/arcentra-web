import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type PageModule = { default: ComponentType<any> };
type ModuleLoader = () => Promise<PageModule>;

export type RegistryComponent = LazyExoticComponent<ComponentType<any>>;
export type ComponentRegistry = Record<string, RegistryComponent>;

// Co-located regression tests are not routable production pages.
const pageModules = import.meta.glob<PageModule>([
  "../pages/**/*.tsx",
  "!../pages/**/*.test.tsx",
  "!../pages/**/*.spec.tsx",
  "!../pages/**/__tests__/**",
]);

function toRegistryKey(modulePath: string) {
  const normalized = modulePath
    .replace(/^..\/pages\//, "")
    .replace(/\/index\.tsx$/, "")
    .replace(/\.tsx$/, "");
  return normalized;
}

const componentRegistry: ComponentRegistry = Object.entries(pageModules).reduce(
  (acc, [path, loader]) => {
    const key = toRegistryKey(path);
    acc[key] = lazy(loader as ModuleLoader);
    return acc;
  },
  {} as ComponentRegistry,
);

export function resolveRouteComponent(
  componentKey: string,
): RegistryComponent | null {
  if (!componentKey) return null;
  return componentRegistry[componentKey] ?? null;
}

export { componentRegistry };
