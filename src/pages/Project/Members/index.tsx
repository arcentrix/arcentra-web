import { Link, useParams } from "react-router-dom";
import { Panel, PanelHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { MemberManager } from "@/components/organization/member-manager";
import authStore from "@/store/auth";
import userStore from "@/store/user";

export default function Members() {
  const { projectId } = useParams<{ projectId: string }>();
  const auth = authStore.useState();
  const user = userStore.useState();
  if (!auth.initialized || !projectId)
    return (
      <Panel>
        <PanelHeader title="Members" />
        <p className="p-5 text-sm text-fg-muted">
          {!auth.initialized
            ? "Sign in to view project members."
            : "Choose a project to view members."}
        </p>
      </Panel>
    );
  return (
    <div className="space-y-4">
      <MemberManager
        key={JSON.stringify([
          auth.accessToken,
          user.userinfo?.userId,
          projectId,
        ])}
        scope="project"
        scopeId={projectId}
      />
      <nav aria-label="Project navigation">
        <Button asChild size="sm" variant="outline">
          <Link to={`/projects/${encodeURIComponent(projectId)}`}>
            Back to project
          </Link>
        </Button>
      </nav>
    </div>
  );
}
