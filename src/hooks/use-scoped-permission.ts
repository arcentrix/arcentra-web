import { Apis } from "@/api";
import { useApiResource } from "./use-api-resource";

/** Resolve inherited permissions for one resource without replacing workspace menus. */
export function useScopedPermission(
  scopeType: "project" | "org",
  scopeId?: string,
) {
  const resource = useApiResource(
    scopeId ? `permissions:${scopeType}:${scopeId}` : null,
    (signal) => Apis.me.getEffectiveActions({ scopeType, scopeId }, signal),
  );
  return {
    ...resource,
    has: (action: string) =>
      !resource.loading &&
      !resource.error &&
      !!resource.data &&
      (resource.data.includes(action) || resource.data.includes("*:*")),
  };
}
