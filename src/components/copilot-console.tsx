import { useEffect, useRef, useState } from "react";
import {
  analyzeCopilot,
  previewCopilot,
  cancelCopilot,
  getCopilotSources,
  getCopilotStatus,
} from "@/api/copilot";
import type {
  CopilotResult,
  CopilotPreview,
  CopilotSources,
  CopilotStatus,
} from "@/api/copilot";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/blueprint";

const inputStyle = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed. Try again.";
type ActiveRequest = {
  controller: AbortController;
  projectId: string;
  requestId?: string;
};

export function CopilotConsole() {
  const [projectId, setProjectId] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState<CopilotStatus | null>(null);
  const [sources, setSources] = useState<CopilotSources | null>(null);
  const [modelIndex, setModelIndex] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [fromLine, setFromLine] = useState(0);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"loading" | "preview" | "analysis" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [preview, setPreview] = useState<CopilotPreview | null>(null);
  const active = useRef<ActiveRequest | null>(null);
  const version = useRef(0);

  useEffect(
    () => () => {
      version.current++;
      const pending = active.current;
      active.current = null;
      pending?.controller.abort();
      if (pending?.requestId)
        void cancelCopilot(pending.projectId, pending.requestId).catch(
          () => undefined,
        );
    },
    [],
  );

  function resetScope(nextProject: string, nextRun: string) {
    version.current++;
    const pending = active.current;
    active.current = null;
    pending?.controller.abort();
    if (pending?.requestId)
      void cancelCopilot(pending.projectId, pending.requestId).catch(
        () => undefined,
      );
    setProjectId(nextProject);
    setRunId(nextRun);
    setStatus(null);
    setSources(null);
    setSteps([]);
    setArtifacts([]);
    setConsent(false);
    setPreview(null);
    setResult(null);
    setError("");
    setNotice("");
    setBusy(null);
  }

  async function loadContext() {
    if (active.current || !projectId.trim() || !runId.trim()) return;
    const generation = ++version.current;
    const controller = new AbortController();
    active.current = { controller, projectId: projectId.trim() };
    setBusy("loading");
    setError("");
    setNotice("");
    setResult(null);
    setStatus(null);
    setSources(null);
    setSteps([]);
    setArtifacts([]);
    setConsent(false);
    setPreview(null);
    try {
      const configured = await getCopilotStatus(
        projectId.trim(),
        controller.signal,
      );
      if (generation !== version.current) return;
      setStatus(configured);
      setModelIndex(0);
      if (configured.configured) {
        const context = await getCopilotSources(
          projectId.trim(),
          runId.trim(),
          controller.signal,
        );
        if (generation !== version.current) return;
        setSources(context);
      }
    } catch (err) {
      if (generation === version.current) setError(errorMessage(err));
    } finally {
      if (generation === version.current) {
        active.current = null;
        setBusy(null);
      }
    }
  }

  async function previewContext() {
    const model = status?.models[modelIndex];
    if (
      active.current ||
      !model ||
      (!steps.length && !artifacts.length) ||
      !question.trim()
    )
      return;
    if (
      new TextEncoder().encode(question).length >
      (status?.maxQuestionBytes ?? 4096)
    ) {
      setError("The question is too long. Use at most 4096 UTF-8 bytes.");
      return;
    }
    const generation = ++version.current;
    const controller = new AbortController();
    active.current = { controller, projectId: projectId.trim() };
    setBusy("preview");
    setError("");
    setNotice("");
    setPreview(null);
    setResult(null);
    setConsent(false);
    try {
      const value = await previewCopilot(
        projectId.trim(),
        {
          requestId: crypto.randomUUID(),
          runId: runId.trim(),
          providerId: model.providerId,
          model: model.model,
          question: question.trim(),
          context: {
            stepRunIds: [...steps],
            artifactIds: [...artifacts],
            fromLine,
          },
          shareSelectedContext: false,
        },
        controller.signal,
      );
      if (generation === version.current) setPreview(value);
    } catch (err) {
      if (generation === version.current) setError(errorMessage(err));
    } finally {
      if (generation === version.current) {
        active.current = null;
        setBusy(null);
      }
    }
  }

  async function analyze() {
    const model = status?.models[modelIndex];
    if (
      active.current ||
      !model ||
      !consent ||
      !preview ||
      (!steps.length && !artifacts.length) ||
      !question.trim()
    )
      return;
    if (
      new TextEncoder().encode(question).length >
      (status?.maxQuestionBytes ?? 4096)
    ) {
      setError("The question is too long. Use at most 4096 UTF-8 bytes.");
      return;
    }
    const generation = ++version.current;
    const controller = new AbortController();
    const requestId = crypto.randomUUID();
    const scope = projectId.trim();
    active.current = { controller, projectId: scope, requestId };
    setBusy("analysis");
    setError("");
    setNotice("");
    setResult(null);
    setConsent(false);
    setPreview(null);
    try {
      const answer = await analyzeCopilot(
        scope,
        {
          requestId,
          runId: runId.trim(),
          providerId: model.providerId,
          model: model.model,
          question: question.trim(),
          context: {
            stepRunIds: [...steps],
            artifactIds: [...artifacts],
            fromLine,
          },
          shareSelectedContext: true,
          contextDigest: preview.digest,
        },
        controller.signal,
      );
      if (generation !== version.current) return;
      if (answer.requestId !== requestId)
        throw new Error("The response did not match this request.");
      setResult(answer);
    } catch (err) {
      if (generation === version.current) setError(errorMessage(err));
    } finally {
      if (generation === version.current) {
        active.current = null;
        setBusy(null);
      }
    }
  }

  async function cancel() {
    const pending = active.current;
    if (!pending) return;
    const generation = ++version.current;
    active.current = null;
    pending.controller.abort();
    setBusy(null);
    setConsent(false);
    setPreview(null);
    setResult(null);
    setNotice("Stopped waiting for this request.");
    if (pending.requestId) {
      try {
        await cancelCopilot(pending.projectId, pending.requestId);
        if (generation === version.current)
          setNotice(
            "Cancellation requested. Data already sent cannot be recalled; the provider may still charge for work started.",
          );
      } catch {
        if (generation === version.current)
          setNotice(
            "Stopped waiting. Server cancellation could not be confirmed; the request has a 45-second server time limit.",
          );
      }
    }
  }
  const toggle = (
    id: string,
    selected: string[],
    update: (ids: string[]) => void,
  ) => {
    update(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
    setConsent(false);
    setPreview(null);
    setResult(null);
  };
  const model = status?.models[modelIndex];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="muted">Read-only analysis</StatusBadge>
        {status && (
          <StatusBadge tone="muted">
            {status.configured ? "Provider configured" : "Not configured"}
          </StatusBadge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Ask about explicitly selected run logs and registered text-code
        artifacts. Direct repository browsing and conversation history are
        unavailable. Suggestions never execute retries or deployments.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Project ID
          <input
            className={inputStyle}
            value={projectId}
            maxLength={128}
            onChange={(event) => resetScope(event.target.value, runId)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Run ID
          <input
            className={inputStyle}
            value={runId}
            maxLength={128}
            onChange={(event) => resetScope(projectId, event.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!!busy || !projectId.trim() || !runId.trim()}
          onClick={() => void loadContext()}
        >
          {busy === "loading" ? "Loading context…" : "Load context choices"}
        </Button>
        {busy && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void cancel()}
          >
            Cancel request
          </Button>
        )}
      </div>
      {status && !status.configured && (
        <p role="status" className="rounded-md border p-3 text-sm">
          No approved provider is configured for this project. An administrator
          must configure an OpenAI-compatible or Anthropic endpoint, server-side
          credentials, allowed models, and this project's data-sharing scope. No
          prompt or context was sent.
        </p>
      )}
      {sources && status?.configured && (
        <>
          <label className="block space-y-1 text-sm">
            Configured model
            <select
              className={inputStyle}
              value={modelIndex}
              disabled={!!busy}
              onChange={(event) => {
                setModelIndex(Number(event.target.value));
                setConsent(false);
                setPreview(null);
                setResult(null);
              }}
            >
              {status.models.map((value, index) => (
                <option
                  key={`${value.providerId}/${value.model}`}
                  value={index}
                >
                  {value.providerId} · {value.model} ({value.kind})
                </option>
              ))}
            </select>
          </label>
          <fieldset
            className="space-y-2 rounded-md border p-3"
            disabled={!!busy}
          >
            <legend className="px-1 text-sm font-medium">
              Step logs (choose up to 4)
            </legend>
            {sources.steps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No steps are available for this run.
              </p>
            )}
            {sources.steps.map((step) => (
              <label
                key={step.stepRunId}
                className="flex items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={steps.includes(step.stepRunId)}
                  disabled={
                    !steps.includes(step.stepRunId) && steps.length >= 4
                  }
                  onChange={() => toggle(step.stepRunId, steps, setSteps)}
                />
                <span>
                  {step.name || step.stepRunId}
                  <span className="block text-xs text-muted-foreground">
                    {step.stepRunId}
                  </span>
                </span>
              </label>
            ))}
            <label className="block space-y-1 text-sm">
              Starting log line
              <input
                type="number"
                min={0}
                max={2147483647}
                className={inputStyle}
                value={fromLine}
                onChange={(event) => {
                  setFromLine(
                    Math.min(
                      2147483647,
                      Math.max(0, Math.floor(Number(event.target.value)) || 0),
                    ),
                  );
                  setConsent(false);
                  setPreview(null);
                }}
              />
            </label>
          </fieldset>
          <fieldset
            className="space-y-2 rounded-md border p-3"
            disabled={!!busy}
          >
            <legend className="px-1 text-sm font-medium">
              Text-code artifacts (choose up to 3)
            </legend>
            <p className="text-xs text-muted-foreground">
              Only registered UTF-8 text artifacts from this run, up to 8 KiB
              each. These are artifact snapshots, not a complete repository
              checkout.
            </p>
            {sources.artifacts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No eligible code artifacts are available. Publish a source text
                file as a run artifact to analyze it.
              </p>
            )}
            {sources.artifacts.map((artifact) => (
              <label
                key={artifact.artifactId}
                className="flex items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={artifacts.includes(artifact.artifactId)}
                  disabled={
                    !artifacts.includes(artifact.artifactId) &&
                    artifacts.length >= 3
                  }
                  onChange={() =>
                    toggle(artifact.artifactId, artifacts, setArtifacts)
                  }
                />
                <span>
                  {artifact.name} ({artifact.size} bytes)
                </span>
              </label>
            ))}
          </fieldset>
          {sources.warnings.map((warning, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {warning}
            </p>
          ))}
          <label className="block space-y-1 text-sm">
            Question
            <textarea
              className={`${inputStyle} min-h-24`}
              value={question}
              maxLength={4096}
              disabled={!!busy}
              onChange={(event) => {
                setQuestion(event.target.value);
                setConsent(false);
                setPreview(null);
              }}
              placeholder="What likely caused this failure, and what should I check next?"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={
              !!busy || !question.trim() || (!steps.length && !artifacts.length)
            }
            onClick={() => void previewContext()}
          >
            {busy === "preview"
              ? "Preparing preview…"
              : "Preview redacted context"}
          </Button>
          {preview && (
            <section
              aria-label="Redacted context preview"
              className="space-y-2 rounded-md border p-3"
            >
              <h3 className="text-sm font-medium">Review before sending</h3>
              <p className="text-xs text-muted-foreground">
                This preview has not been sent to a model. Review it for private
                information. If the underlying logs change, a new preview is
                required.
              </p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
                {preview.text}
              </pre>
              {preview.warnings.map((warning, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {warning}
                </p>
              ))}
            </section>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              disabled={!!busy || !preview}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              Send this question and selected context to{" "}
              {model?.providerId ?? "the configured provider"} for this
              analysis. Known secrets are redacted, but review your data policy
              before sharing. Context is capped at{" "}
              {Math.floor(status.maxContextBytes / 1024)} KiB.
            </span>
          </label>
          <Button
            type="button"
            disabled={
              !!busy ||
              !consent ||
              !preview ||
              !question.trim() ||
              (!steps.length && !artifacts.length)
            }
            onClick={() => void analyze()}
          >
            {busy === "analysis" ? "Analyzing…" : "Analyze selected context"}
          </Button>
        </>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {result && (
        <section
          aria-label="Analysis result"
          className="space-y-3 rounded-md border p-4"
        >
          <h3 className="font-medium">Analysis</h3>
          <p className="whitespace-pre-wrap break-words text-sm">
            {result.text}
          </p>
          {result.warnings.map((warning, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {warning}
            </p>
          ))}
          <h4 className="text-sm font-medium">Context sent</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {result.evidence.map((item) => (
              <li key={`${item.kind}/${item.id}`}>
                {item.kind}: {item.name || item.id} · {item.bytes} bytes
                {item.truncated ? " · truncated" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
