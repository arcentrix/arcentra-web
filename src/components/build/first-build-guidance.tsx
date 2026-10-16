import { ChevronDown, RefreshCw } from "lucide-react";
import { Panel } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { FirstBuildResource } from "@/hooks/use-first-build";

export function FirstBuildGuidance({
  readiness,
}: {
  readiness: FirstBuildResource;
}) {
  if (!readiness.signedIn) return null;
  const { data, loading, error, refresh } = readiness;
  const stale = !!data && (loading || !!error);
  return (
    <Panel>
      <Collapsible defaultOpen>
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="group h-auto gap-2 px-0">
              <ChevronDown className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
              First build setup
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="outline"
            size="sm"
            aria-label="Refresh first-build status"
            onClick={refresh}
          >
            <RefreshCw
              className={loading ? "size-3.5 animate-spin" : "size-3.5"}
            />
            Refresh
          </Button>
        </div>
        <CollapsibleContent className="space-y-3 border-t p-4 text-sm">
          {loading && (
            <p role="status" className="text-muted-foreground">
              {data
                ? "Refreshing first-build status…"
                : "Loading first-build status…"}
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              First-build status unavailable. Refresh to try again. No current
              setup or scope information could be verified.
            </p>
          )}
          {stale && (
            <p role="status" className="text-muted-foreground">
              Previous snapshot shown below. It may be outdated; scope choices
              are unavailable until a successful refresh.
            </p>
          )}
          {data && (
            <ul
              className="space-y-2"
              aria-label={stale ? "Previous setup snapshot" : "Setup snapshot"}
            >
              <li>
                <span className="font-medium">Organization scope: </span>
                {data.scopeOptions.length > 0
                  ? `${data.scopeOptions.length} authorized scope${data.scopeOptions.length === 1 ? "" : "s"} available in New project${data.scopeOptionsTruncated ? " (scope lookup reached its limit)" : ""}.`
                  : "No authorized organization scopes were returned."}{" "}
                {data.canEnterScope
                  ? "Your platform permission allows you to enter an existing administrator-approved scope ID."
                  : "Ask your administrator for an approved scope and project-creation access."}
              </li>
              {data.configuration.access === "restricted" ? (
                <li>
                  <span className="font-medium">Configuration: </span>
                  Restricted. Ask an administrator to check storage and Agent
                  signing configuration.
                </li>
              ) : (
                <>
                  <li>
                    <span className="font-medium">
                      Default artifact storage:{" "}
                    </span>
                    {data.configuration.defaultStorageConfigured
                      ? "Configured (persisted record)."
                      : "Not configured. An administrator must configure enabled default storage through the setup API/CLI."}
                  </li>
                  <li>
                    <span className="font-medium">Agent signing: </span>
                    {data.configuration.agentSigningConfigured
                      ? "Configured (persisted values)."
                      : "Not configured. An administrator must configure Agent signing through the setup API/CLI."}
                  </li>
                </>
              )}
              <li>
                <span className="font-medium">Agent heartbeat: </span>
                {data.agent.access === "restricted"
                  ? "Restricted. Ask an administrator to check Agent availability."
                  : data.agent.enabledRecentlySeen
                    ? "An enabled Agent was seen recently. This does not guarantee job capacity or build success."
                    : "No enabled Agent was seen recently. Ask an administrator to start and check a trusted Agent."}
              </li>
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Configured means saved, not connectivity tested. Control and Agents
            may need restarting after configuration changes to load their
            runtime snapshots. Refresh this view after setup or permission
            changes.
          </p>
          <p className="text-xs text-muted-foreground">
            Start with the trusted bare-metal sample, then create a project and
            pipeline, review the pinned definition, run it, and verify logs and
            downloaded artifact bytes. Bare-metal commands run on the Agent
            host; review the source and use an isolated trusted machine with Go
            1.25.6, Git, Python 3 and a shell. Project-creation permission does
            not grant pipeline creation or run permission.
          </p>
          <a
            className="text-xs underline underline-offset-4"
            href="https://github.com/arcentrix/arcentra/blob/main/scripts/acceptance/FIRST_BUILD.md"
            target="_blank"
            rel="noreferrer"
          >
            First-build setup API/CLI guide
          </a>
          <a
            className="ml-4 text-xs underline underline-offset-4"
            href="https://github.com/arcentrix/arcentra/tree/main/scripts/acceptance/fixtures/stdlib-build"
            target="_blank"
            rel="noreferrer"
          >
            Trusted bare-metal sample
          </a>
        </CollapsibleContent>
      </Collapsible>
    </Panel>
  );
}
