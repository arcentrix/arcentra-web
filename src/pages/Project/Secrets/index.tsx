import { Panel, PanelHeader } from "@/components/blueprint";

export default function Secrets() {
  return (
    <Panel>
      <PanelHeader title="Project secrets" />
      <div className="space-y-2 px-5 py-8 text-[13px] text-fg-muted">
        <p className="font-medium text-foreground">
          Project secret management is not connected.
        </p>
        <p>
          No secret inventory has been loaded for this project. This view cannot
          show whether the project has any secrets, their scope, or when they
          were rotated.
        </p>
      </div>
    </Panel>
  );
}
