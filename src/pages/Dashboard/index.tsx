import { useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { AgentHealth } from "@/components/observe/agent-health";
import { positivePage } from "@/components/observe/health";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import authStore from "@/store/auth";
import userStore from "@/store/user";

const destinations = [
  {
    to: "/build",
    title: "Open Build",
    description: "Inspect pipeline runs, logs, and run approvals.",
  },
  {
    to: "/deploy",
    title: "Open Deploy",
    description: "Choose a project to inspect its environments and releases.",
  },
  {
    to: "/observe",
    title: "Open Observe",
    description: "Inspect permitted pipeline history and recorded durations.",
  },
  {
    to: "/projects",
    title: "View projects",
    description: "Open the projects available to your account.",
  },
];

export default function Dashboard() {
  const auth = authStore.useState();
  const user = userStore.useState();
  if (!auth.initialized) {
    return (
      <p className="p-8 text-sm text-fg-muted">
        Sign in to view the control plane.
      </p>
    );
  }
  // Cookie-authenticated accounts may change without an access token change.
  return (
    <DashboardSnapshot
      key={JSON.stringify([auth.accessToken, user.userinfo?.userId])}
    />
  );
}

function DashboardSnapshot() {
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const agentPage = positivePage(params.get("agentPage"));

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="system / overview"
        title="Control Plane"
        sub="Open your build and deployment workflows. Agent health below is a server-reported snapshot; refresh to fetch current data."
        action={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw aria-hidden className="size-3.5" />
            Refresh snapshot
          </Button>
        }
      />
      <Panel>
        <PanelHeader
          title="Workspace tools"
          sub="Each workspace checks access to its own resources."
        />
        <nav
          aria-label="Workspace tools"
          className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {destinations.map(({ to, title, description }) => (
            <div key={to} className="space-y-2 rounded-md border p-4">
              <Link
                to={to}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
              >
                {title}
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
              <p className="text-sm text-fg-muted">{description}</p>
            </div>
          ))}
        </nav>
      </Panel>
      <AgentHealth
        page={agentPage}
        revision={revision}
        onPage={(page) =>
          setParams((current) => {
            const next = new URLSearchParams(current);
            if (page === 1) next.delete("agentPage");
            else next.set("agentPage", String(page));
            return next;
          })
        }
      />
    </section>
  );
}
