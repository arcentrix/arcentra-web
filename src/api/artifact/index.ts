import { get, getBlob } from "../client";

export const artifactStatuses = [
  "available",
  "expired",
  "unavailable",
] as const;
export type ArtifactStatus = (typeof artifactStatuses)[number];

export interface ProjectArtifact {
  artifactId: string;
  projectId: string;
  pipelineId: string;
  pipelineRunId: string;
  jobRunId: string;
  stepRunId: string;
  name: string;
  size: number;
  sizeKnown?: boolean;
  mediaType: string;
  storageType: string;
  createdAt: string;
  expiresAt?: string;
  status: ArtifactStatus;
  downloadAvailable: boolean;
  unavailableReason?: string;
}

export interface ArtifactQuery {
  page?: number;
  pageSize?: number;
  name?: string;
  runId?: string;
  status?: ArtifactStatus;
}

export interface ArtifactPage {
  list: ProjectArtifact[];
  total: number;
  page: number;
  pageSize: number;
}

const projectPath = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/artifacts`;

export async function listProjectArtifacts(
  projectId: string,
  params: ArtifactQuery = {},
  signal?: AbortSignal,
): Promise<ArtifactPage> {
  const result = await get<
    Omit<ArtifactPage, "list"> & { list: ProjectArtifact[] | null }
  >(projectPath(projectId), {
    params: { page: 1, pageSize: 20, ...params },
    signal,
    silence: true,
  });
  return { ...result, list: result.list ?? [] };
}

/** Only a safe basename is passed to the browser, never a server path. */
export function safeDownloadName(value: string): string {
  const basename = value.replace(/\\/g, "/").split("/").pop() ?? "";
  const clean = Array.from(basename)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return (
        code >= 32 &&
        code !== 127 &&
        !(code >= 0x202a && code <= 0x202e) &&
        !(code >= 0x2066 && code <= 0x2069)
      );
    })
    .join("")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .replace(/^\.+|[. ]+$/g, "");
  return clean.slice(0, 240) || "artifact";
}

function downloadName(header: string, fallback: string): string {
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return safeDownloadName(decodeURIComponent(encoded.trim()));
    } catch {
      // Fall back to the plain filename for malformed RFC 5987 encodings.
    }
  }
  const plain = header.match(/filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;]+))/i);
  return safeDownloadName(
    plain?.[1]?.replace(/\\(.)/g, "$1") ?? plain?.[2]?.trim() ?? fallback,
  );
}

export async function downloadProjectArtifact(
  projectId: string,
  artifactId: string,
  name: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const response = await getBlob(
    `${projectPath(projectId)}/${encodeURIComponent(artifactId)}/download`,
    { signal, silence: true },
  );
  const disposition = String(response.headers["content-disposition"] ?? "");
  // Do not save an HTML login page, a JSON error envelope or an opaque URL as
  // an artifact. A successful endpoint explicitly identifies its attachment.
  if (
    !(response.data instanceof Blob) ||
    !/^attachment(?:\s*;|\s*$)/i.test(disposition)
  ) {
    throw new Error(
      "The server did not return an artifact attachment. Refresh and try again.",
    );
  }
  return { blob: response.data, filename: downloadName(disposition, name) };
}

/** Save only response bytes, never an untrusted server-provided URL. */
export function saveArtifactDownload({
  blob,
  filename,
}: {
  blob: Blob;
  filename: string;
}) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = safeDownloadName(filename);
  link.rel = "noopener";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Let the browser start consuming the object URL before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
