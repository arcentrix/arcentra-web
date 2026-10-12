import { Link } from "react-router-dom";
import { Bot, Hammer, Sparkles } from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/blueprint";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function Copilot() {
  return (
    <section className="grid min-h-full flex-1 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6 border-b bg-background p-5 md:border-b-0 md:border-r">
        <div>
          <div className="eyebrow eyebrow-arrow">copilot</div>
          <h2 className="display mt-2 text-lg font-semibold">
            Arcentra Copilot
          </h2>
          <div className="mt-3">
            <StatusBadge tone="muted">Not integrated</StatusBadge>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium">History</h3>
          <p className="mt-2 text-[13px] text-fg-muted">
            Conversation history is unavailable until a conversation service is
            integrated.
          </p>
        </div>
        <nav
          aria-label="Available platform tools"
          className="flex flex-wrap gap-2 md:flex-col"
        >
          <Button asChild size="sm" variant="outline">
            <Link to="/build">
              <Hammer aria-hidden />
              Open Build
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/agents">
              <Bot aria-hidden />
              View Agents
            </Link>
          </Button>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col gap-6 p-4 md:p-8">
        <PageHeader
          eyebrow="copilot / integration status"
          title="Copilot"
          sub="AI-assisted workflows require an AI provider and backend integration."
        />
        <Panel>
          <PanelHeader title={<h3>AI chat is unavailable</h3>} />
          <div className="flex items-start gap-3 p-5">
            <Sparkles
              className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted"
              aria-hidden
            />
            <div className="max-w-2xl space-y-3 text-[13px] text-fg-muted">
              <p>
                AI chat is not integrated in this build. Sending messages,
                selecting models, and running AI tool actions are unavailable.
              </p>
              <p>
                This page does not send prompts or project data to an AI
                provider. Provider selection, data-sharing policy, and tool
                permissions need to be decided before chat can be enabled.
              </p>
              <p>
                Use Build to inspect pipeline runs and logs, or Agents to review
                build runners.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
