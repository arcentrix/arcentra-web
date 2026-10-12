import { StatusBadge, type BadgeTone } from "@/components/blueprint";
import type { RunStatus } from "@/api/pipeline/types";
const tones: Record<RunStatus, BadgeTone> = {
  unknown: "muted",
  pending: "warn",
  queued: "warn",
  running: "running",
  success: "ok",
  failed: "fail",
  cancelled: "muted",
  paused: "warn",
  timeout: "fail",
  skipped: "muted",
};
export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <StatusBadge tone={tones[status]}>
      {status === "pending"
        ? "Pending"
        : status.charAt(0).toUpperCase() + status.slice(1)}
    </StatusBadge>
  );
}
export function formatDuration(milliseconds: number) {
  if (!milliseconds) return "—";
  const seconds = Math.floor(milliseconds / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
export function formatRunTime(timestamp: number) {
  if (!timestamp) return "Not started";
  return new Date(
    timestamp < 1e12 ? timestamp * 1000 : timestamp,
  ).toLocaleString();
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed. Please try again.";

export function formatLogTime(timestamp: string | number) {
  if (!timestamp) return "";
  const numeric = Number(timestamp);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? String(timestamp) : date.toISOString();
}
