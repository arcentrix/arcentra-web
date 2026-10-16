import { get, post, put } from "../client";

export type StorageProvider = "minio" | "s3";
export interface StorageTarget {
  endpoint: string;
  bucket: string;
  region: string;
  basePath: string;
  useTLS: boolean;
}
export interface StorageConfiguration {
  storageId: string;
  name: string;
  description: string;
  storageType: string;
  isDefault: boolean;
  isEnabled: boolean;
  target: StorageTarget | null;
  credentials: { accessKey: boolean; secretKey: boolean };
}
export interface StorageCreation extends StorageTarget {
  storageId: string;
  name: string;
  description: string;
  storageType: StorageProvider;
  accessKey: string;
  secretKey: string;
}
export interface StorageChanges {
  name?: string;
  description?: string;
  accessKey?: string;
  secretKey?: string;
}

const privateRequest = { silence: true, sensitive: true };
const unavailable = () => new Error("Storage configuration is unavailable.");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw unavailable();
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw unavailable();
  return value;
}
export function editableProvider(value: string): value is StorageProvider {
  return value === "minio" || value === "s3";
}

/** Never retain credentials, masks, arbitrary keys or credential-bearing URLs from a read. */
function projectConfiguration(value: unknown): StorageConfiguration {
  const row = object(value);
  const config = object(row.config);
  const configured = Array.isArray(row.configuredFields)
    ? row.configuredFields
    : [];
  const storageType = string(row.storageType);
  let target: StorageTarget | null = null;
  if (
    editableProvider(storageType) &&
    typeof config.endpoint === "string" &&
    typeof config.bucket === "string" &&
    endpointIsSafe(config.endpoint)
  ) {
    target = {
      endpoint: config.endpoint,
      bucket: config.bucket,
      region: typeof config.region === "string" ? config.region : "",
      basePath: typeof config.basePath === "string" ? config.basePath : "",
      useTLS: config.useTLS === true,
    };
  }
  if (
    (row.isDefault !== 0 && row.isDefault !== 1) ||
    (row.isEnabled !== 0 && row.isEnabled !== 1)
  )
    throw unavailable();
  return {
    storageId: string(row.storageId),
    name: string(row.name),
    description: string(row.description),
    storageType,
    isDefault: row.isDefault === 1,
    isEnabled: row.isEnabled === 1,
    target,
    credentials: {
      accessKey: configured.includes("accessKey"),
      secretKey: configured.includes("secretKey"),
    },
  };
}
export function endpointIsSafe(endpoint: string): boolean {
  try {
    const url = new URL(
      endpoint.includes("://") ? endpoint : `https://${endpoint}`,
    );
    return (
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !endpoint.includes("?") &&
      !endpoint.includes("#") &&
      !/\s/.test(endpoint)
    );
  } catch {
    return false;
  }
}
export function isSecretPlaceholder(value: string): boolean {
  return [
    "[redacted]",
    "redacted",
    "<redacted>",
    "configured",
    "[configured]",
    "********",
    "******",
    "••••••••",
  ].includes(value.trim().toLowerCase());
}
/** Go []byte JSON fields require base64, including correct UTF-8 for non-ASCII text. */
function encodeConfig(config: Record<string, string | boolean>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function credentialChanges(changes: StorageChanges) {
  const config: Record<string, string> = {};
  for (const field of ["accessKey", "secretKey"] as const) {
    const value = changes[field];
    if (value?.trim()) {
      if (isSecretPlaceholder(value))
        throw new Error("Enter a new credential value.");
      config[field] = value;
    }
  }
  return config;
}
export async function listStorageConfigurations(signal?: AbortSignal) {
  const rows = await get<unknown>("/storage/configs", {
    ...privateRequest,
    signal,
  });
  if (!Array.isArray(rows)) throw unavailable();
  return rows.map(projectConfiguration);
}
export async function createStorageConfiguration(input: StorageCreation) {
  // Deliberately construct the payload; there are no default/enable flags or extra fields.
  await post(
    "/storage/configs",
    {
      storageId: input.storageId,
      name: input.name,
      description: input.description,
      storageType: input.storageType,
      config: encodeConfig({
        endpoint: input.endpoint,
        bucket: input.bucket,
        region: input.region,
        basePath: input.basePath,
        useTLS: input.useTLS,
        ...credentialChanges(input),
      }),
    },
    privateRequest,
  );
}
export async function updateStorageConfiguration(
  storageId: string,
  changes: StorageChanges,
) {
  const config = credentialChanges(changes);
  await put(
    `/storage/configs/${encodeURIComponent(storageId)}`,
    {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.description !== undefined
        ? { description: changes.description }
        : {}),
      ...(Object.keys(config).length > 0
        ? { config: encodeConfig(config) }
        : {}),
    },
    privateRequest,
  );
}
export async function setDefaultStorageConfiguration(storageId: string) {
  await post(
    `/storage/configs/${encodeURIComponent(storageId)}/default`,
    undefined,
    privateRequest,
  );
}
