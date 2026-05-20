/**
 * Lightweight error type used across the data layer.
 *
 * The HTTP client surfaces this whenever a backend response either reports a
 * business error (`code !== 200`) or fails at the transport layer. Carrying
 * the request id lets UI layers display actionable diagnostics — particularly
 * useful for support / on-call workflows where the user needs to copy the
 * trace id and forward it to the backend team.
 */

export interface ApiErrorOptions {
  message: string;
  code?: number;
  status?: number;
  requestId?: string | null;
  path?: string;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly code?: number;
  readonly status?: number;
  readonly requestId: string | null;
  readonly path?: string;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId ?? null;
    this.path = options.path;
    if (options.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = options.cause;
    }
  }
}

const REQUEST_ID_HEADER_CANDIDATES = [
  "x-request-id",
  "x-trace-id",
  "x-correlation-id",
  "request-id",
  "trace-id",
];

type HeaderRecord =
  | Record<string, unknown>
  | { get?: (name: string) => string | null | undefined }
  | null
  | undefined;

function readHeader(headers: HeaderRecord, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as { get?: unknown }).get === "function") {
    const value = (headers as { get: (n: string) => string | null | undefined }).get(name);
    if (typeof value === "string" && value) return value;
  }
  const dict = headers as Record<string, unknown>;
  const direct = dict[name] ?? dict[name.toUpperCase()];
  if (Array.isArray(direct)) {
    const first = direct.find((v) => typeof v === "string" && v);
    return typeof first === "string" ? first : null;
  }
  if (typeof direct === "string" && direct) return direct;
  return null;
}

export function extractRequestId(headers: HeaderRecord): string | null {
  for (const candidate of REQUEST_ID_HEADER_CANDIDATES) {
    const value = readHeader(headers, candidate);
    if (value) return value;
  }
  return null;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
