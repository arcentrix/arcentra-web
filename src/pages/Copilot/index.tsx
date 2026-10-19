import { Link, useLocation } from "react-router-dom";
import { CopilotConsole } from "@/components/copilot-console";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function Copilot() {
  const location = useLocation();
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="copilot / read-only analysis"
        title="Copilot"
        sub="Investigate a run using only the context you choose."
      />
      <nav aria-label="Available platform tools" className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/build">Open Build</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/agents">View Agents</Link>
        </Button>
      </nav>
      <CopilotConsole key={location.key} />
    </section>
  );
}
