import { get } from "../client";

type Access<T> = { access: "restricted" } | ({ access: "visible" } & T);

/** Authorization scopes are role-grant references, not organization records. */
export interface FirstBuildReadiness {
  scopeOptions: { scopeId: string; source: "role_grant" }[];
  scopeOptionsTruncated: boolean;
  canEnterScope: boolean;
  configuration: Access<{
    defaultStorageConfigured: boolean;
    agentSigningConfigured: boolean;
  }>;
  agent: Access<{ enabledRecentlySeen: boolean }>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("First-build status is unavailable.");
  return value as Record<string, unknown>;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new Error("First-build status is unavailable.");
  return value;
}

function access(value: unknown) {
  const row = object(value);
  if (row.access !== "visible" && row.access !== "restricted")
    throw new Error("First-build status is unavailable.");
  return row;
}

/** Project only the safe DTO fields; never keep settings, credentials or agent details. */
export async function getFirstBuildReadiness(
  signal?: AbortSignal,
): Promise<FirstBuildReadiness> {
  const row = object(
    await get<unknown>("/me/first-build", { signal, silence: true }),
  );
  if (!Array.isArray(row.scopeOptions))
    throw new Error("First-build status is unavailable.");
  const configuration = access(row.configuration);
  const agent = access(row.agent);
  return {
    scopeOptions: row.scopeOptions.map((value) => {
      const option = object(value);
      if (
        typeof option.scopeId !== "string" ||
        !option.scopeId.trim() ||
        option.source !== "role_grant"
      )
        throw new Error("First-build status is unavailable.");
      return { scopeId: option.scopeId, source: "role_grant" };
    }),
    scopeOptionsTruncated: boolean(row.scopeOptionsTruncated),
    canEnterScope: boolean(row.canEnterScope),
    configuration:
      configuration.access === "restricted"
        ? { access: "restricted" }
        : {
            access: "visible",
            defaultStorageConfigured: boolean(
              configuration.defaultStorageConfigured,
            ),
            agentSigningConfigured: boolean(
              configuration.agentSigningConfigured,
            ),
          },
    agent:
      agent.access === "restricted"
        ? { access: "restricted" }
        : {
            access: "visible",
            enabledRecentlySeen: boolean(agent.enabledRecentlySeen),
          },
  };
}
