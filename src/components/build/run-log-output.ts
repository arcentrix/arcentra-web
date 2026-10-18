import type { JobRun, RunLogs } from "@/api/pipeline/types";

// The API's default page is 1,000 Write chunks, not 1,000 text lines. Keep
// malformed/oversized responses bounded, without silently presenting a whole log.
export const MAX_LOG_CHUNKS = 1000;
export const MAX_LOG_TEXT = 1_000_000;
const MAX_POSITION = 2_147_483_647; // Backend positions are positive int32 values.
const position = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= MAX_POSITION;
const identity = (value: unknown): string | undefined =>
  typeof value === "string" && value.length <= 256 && value.trim()
    ? value
    : undefined;
// Metadata is distinct from raw output; quote control characters in labels.
const label = (value: string) => JSON.stringify(value.slice(0, 256));
const metadata = (value: unknown) =>
  typeof value === "string" && value
    ? label(value)
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "unknown";

interface Chunk {
  row: number;
  jobId?: string;
  stepId?: string;
  stream?: string;
  lineNumber?: number;
  message: string;
  validMessage: boolean;
  timestamp: unknown;
  level: unknown;
}

/** Reconstruct only evidenced byte order. No HTML, trimming, or invented newlines. */
export function formatRunLogOutput(
  logs: RunLogs | undefined,
  jobs: JobRun[] | undefined,
  { fromLine = 0, stepId = "" }: { fromLine?: number; stepId?: string } = {},
) {
  if (!logs) return { text: "", nextLine: undefined };
  const warnings: string[] = [];
  const blocks: string[] = [];
  const groups = new Map<string, Chunk[]>();
  const legacy: Chunk[] = [];
  const entries = Array.isArray(logs?.entries) ? logs.entries : [];
  if (!Array.isArray(logs.entries))
    warnings.push(
      "[Log entries are missing or invalid. Output completeness is unknown.]",
    );
  let remaining = MAX_LOG_TEXT;
  let bounded = entries.length > MAX_LOG_CHUNKS;
  let maxLine = 0;
  let canPage = entries.length > 0;
  const pagePositions = new Set<number>();
  let duplicateCount = 0;
  let conflictCount = 0;

  for (
    let index = 0;
    index < Math.min(entries.length, MAX_LOG_CHUNKS);
    index++
  ) {
    const value = entries[index];
    const entry = value && typeof value === "object" ? value : undefined;
    const validMessage = typeof entry?.message === "string";
    const message = validMessage ? entry!.message : "";
    const complete = message.length <= remaining;
    // Do not split a UTF-16 surrogate pair at the display limit.
    let length = Math.min(message.length, remaining);
    if (!complete && /[\uD800-\uDBFF]/.test(message.charAt(length - 1)))
      length--;
    const chunk: Chunk = {
      row: index + 1,
      jobId: identity(entry?.jobId),
      stepId: identity(entry?.stepId),
      stream: identity(entry?.stream),
      lineNumber: position(entry?.lineNumber) ? entry.lineNumber : undefined,
      message: message.slice(0, length),
      validMessage: validMessage && complete,
      timestamp: entry?.timestamp,
      level: entry?.level,
    };
    remaining -= length;
    if (
      chunk.lineNumber === undefined ||
      (stepId && chunk.stepId && chunk.stepId !== stepId)
    ) {
      canPage = false;
    } else {
      // Even a legacy row with missing identity can make a step-page cursor
      // ambiguous. Do not silently advance past repeated boundary positions.
      if (stepId && pagePositions.has(chunk.lineNumber)) canPage = false;
      pagePositions.add(chunk.lineNumber);
      maxLine = Math.max(maxLine, chunk.lineNumber);
    }
    if (chunk.jobId && chunk.stepId && chunk.lineNumber !== undefined) {
      const key = JSON.stringify([chunk.jobId, chunk.stepId]);
      const group = groups.get(key) ?? [];
      group.push(chunk);
      groups.set(key, group);
    } else {
      legacy.push(chunk);
    }
    if (!complete) {
      bounded = true;
      break;
    }
  }

  const standalone = (chunk: Chunk, reason: string) =>
    `[${reason}; response chunk ${chunk.row}; job ${chunk.jobId ? label(chunk.jobId) : "unknown"}; step ${chunk.stepId ? label(chunk.stepId) : "unknown"}; stream ${chunk.stream ? label(chunk.stream) : "unknown"}; position ${chunk.lineNumber ?? "unknown"}; timestamp ${metadata(chunk.timestamp)}; level ${metadata(chunk.level)}]\n${chunk.message}${chunk.validMessage ? "" : "\n[Chunk text is missing, invalid, or cut at the display limit.]"}`;

  for (const chunks of groups.values()) {
    const { jobId, stepId: groupStepId } = chunks[0];
    const job = jobs
      ?.slice(0, MAX_LOG_CHUNKS)
      .find((item) => item.jobRunId === jobId);
    const step = job?.steps
      .slice(0, MAX_LOG_CHUNKS)
      .find((item) => item.stepRunId === groupStepId);
    blocks.push(
      `[Job ${job ? label(job.jobName) : "unknown"} (${label(jobId!)}); step ${step ? label(step.name) : "unknown"} (${label(groupStepId!)})]`,
    );
    if (!job || !step)
      blocks.push(
        "[Job/step inventory is unavailable or does not match these recorded IDs. Chunks are unverified and shown separately.]",
      );
    if (stepId && groupStepId !== stepId) {
      blocks.push(
        "[Unexpected step in this response; it is shown under its recorded identity. Paging is unavailable.]",
      );
    }
    // lineNumber is step-global, including stdout and stderr. The all-steps
    // endpoint sorts by timestamp, which is not sufficient to order fragments.
    const positions = new Map<number, Chunk[]>();
    for (const chunk of chunks) {
      const variants = positions.get(chunk.lineNumber!) ?? [];
      variants.push(chunk);
      positions.set(chunk.lineNumber!, variants);
    }
    let segment: Chunk[] = [];
    const flush = () => {
      if (!segment.length) return;
      const streams = new Map<string, Chunk[]>();
      for (const chunk of segment) {
        const text = streams.get(chunk.stream!) ?? [];
        text.push(chunk);
        streams.set(chunk.stream!, text);
      }
      for (const [stream, text] of streams) {
        blocks.push(
          `[Stream ${label(stream)}; contiguous reported step range ${segment[0].lineNumber}–${segment[segment.length - 1].lineNumber}; ${text.length} chunk(s); first timestamp ${metadata(text[0].timestamp)}; last timestamp ${metadata(text[text.length - 1].timestamp)}; levels ${[...new Set(text.map((chunk) => metadata(chunk.level)))].join(", ")}]\n${text.map((chunk) => chunk.message).join("")}`,
        );
      }
      segment = [];
    };
    let expected = Math.max(1, fromLine);
    for (const [line, variants] of [...positions].sort(([a], [b]) => a - b)) {
      if (line !== expected) {
        flush();
        blocks.push(
          line > expected
            ? `[Gap: chunks ${expected}–${line - 1} are absent from this page. Output is not joined across this gap.]`
            : "[Response includes positions before the requested page.]",
        );
      }
      expected = line + 1;
      const first = variants[0];
      const identical = variants.every(
        (chunk) =>
          chunk.stream === first.stream &&
          chunk.message === first.message &&
          chunk.validMessage === first.validMessage &&
          chunk.timestamp === first.timestamp &&
          chunk.level === first.level,
      );
      if (variants.length > 1) {
        flush();
        canPage = false;
        if (identical) duplicateCount += variants.length - 1;
        else conflictCount++;
        // The view has no event ID. Even identical payloads at a repeated
        // position cannot prove replay identity, so keep every record.
        for (const chunk of variants)
          blocks.push(
            standalone(
              chunk,
              `${identical ? "Duplicate" : "Conflicting"} position ${line}; not joined`,
            ),
          );
      } else {
        if (
          !job ||
          !step ||
          !["stdout", "stderr"].includes(first.stream ?? "") ||
          !first.validMessage
        ) {
          flush();
          blocks.push(
            standalone(
              first,
              "Unverified legacy, unknown inventory/stream, or invalid chunk; not joined",
            ),
          );
        } else {
          segment.push(first);
        }
      }
    }
    flush();
  }
  for (const chunk of legacy)
    blocks.push(
      standalone(
        chunk,
        "Unverified legacy chunk; missing identity or position; not joined",
      ),
    );
  const nextLine =
    canPage && !bounded && maxLine < MAX_POSITION && maxLine >= fromLine
      ? maxLine + 1
      : undefined;
  if (blocks.length)
    warnings.push(
      "[Output grouped by job, step and stream. Positions count Write chunks within each step. Separate stream blocks do not imply cross-stream timing.]",
    );
  if (fromLine > 0)
    warnings.push(
      `[Partial page starting at chunk ${fromLine}. The first visible text may start mid-line. Earlier output is not included; no fragments are joined across pages.]`,
    );
  if (logs?.truncated)
    warnings.push(
      stepId
        ? nextLine !== undefined
          ? "[Partial page. More output is available. Use Next output to continue.]"
          : "[Partial page. More output exists beyond this response.]"
        : "[Partial page: showing at most the first 1,000 log chunks. Select a step to browse additional output.]",
    );
  if (duplicateCount)
    warnings.push(
      `[${duplicateCount} repeated identical chunk(s); replay identity is unverified. Every record is shown separately and not joined.]`,
    );
  if (conflictCount)
    warnings.push(
      `[${conflictCount} conflicting position(s); variants are displayed separately and are not joined to adjacent output.]`,
    );
  if (bounded)
    warnings.push(
      "[Display limit reached. Output is incomplete; additional chunks or text are omitted.]",
    );
  if (logs?.truncated && stepId && nextLine === undefined)
    warnings.push(
      bounded
        ? "[Next output is unavailable: this page exceeds the display limit. Later output cannot be browsed safely from this page.]"
        : "[Next output is unavailable: this page has missing, invalid, repeated positions or an unexpected step. A safe continuation position is unknown.]",
    );
  return { text: [...warnings, ...blocks].join("\n\n"), nextLine };
}
