import { Button } from "@/components/ui/button";
import { InlineErrorState } from "@/components/inline-error-state";
import { isApiError } from "@/lib/api-error";

export function SnapshotError({
  error,
  subject,
  permission,
  retry,
  loading,
}: {
  error: Error;
  subject: string;
  permission: string;
  retry: () => void;
  loading: boolean;
}) {
  const denied =
    isApiError(error) &&
    (error.status === 403 || error.code === 4030 || error.code === 4031);
  return (
    <InlineErrorState
      title={`${subject} ${denied ? "access restricted" : "unavailable"}`}
      description={
        denied
          ? `This data requires ${permission}. ${error.message}`
          : error.message
      }
      requestId={isApiError(error) ? error.requestId : undefined}
      onRetry={retry}
      retrying={loading}
      retryLabel={denied ? "Check access again" : "Retry"}
      minHeight={180}
    />
  );
}

export function SnapshotPages({
  name,
  page,
  total,
  loading,
  onPage,
}: {
  name: string;
  page: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 20));
  if (pages === 1 && page === 1) return null;
  return (
    <nav
      aria-label={`${name} pages`}
      className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-fg-muted"
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={page <= 1 || loading}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page}
        {page <= pages ? ` of ${pages}` : " · no longer available"}
      </span>
      {page > pages ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => onPage(1)}
        >
          Back to first page
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= pages || loading}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      )}
    </nav>
  );
}
