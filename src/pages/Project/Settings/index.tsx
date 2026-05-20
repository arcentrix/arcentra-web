/**
 * Project Settings 标签面板 — Engineering Blueprint 重做
 * Panel + FormRow 行模式 + Danger zone。保留 useParams。
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel, SectionEyebrow } from "@/components/blueprint";

interface FormRowProps {
  label: string;
  value: string;
  mono?: boolean;
  id: string;
}

/** 标签/控件成对行：左侧 label，右侧 input */
function FormRow({ label, value, mono = false, id }: FormRowProps) {
  return (
    <div className="grid items-center gap-6 border-b py-3 last:border-0"
      style={{ gridTemplateColumns: "200px 1fr" }}>
      <label
        htmlFor={id}
        className="text-[13px] font-medium"
      >
        {label}
      </label>
      <Input
        id={id}
        defaultValue={value}
        className={`h-8 max-w-[360px] text-[13px] ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

const ProjectSettings: FC = () => {
  const { projectId: _projectId } = useParams<{ projectId: string }>();

  return (
    <div className="flex flex-col gap-4">
      {/* General settings panel */}
      <Panel className="p-6">
        <SectionEyebrow className="mb-2">project / settings</SectionEyebrow>
        <h3 className="display mb-5 text-[18px] font-semibold leading-tight tracking-[-0.02em]">
          General
        </h3>

        <FormRow id="project-name"       label="Project name"       value="Project"                    mono />
        <FormRow id="project-description"label="Description"         value="Project description"         />
        <FormRow id="project-repo"       label="Linked repository"  value="github.com/arcentrix/project" mono />
        <FormRow id="project-branch"     label="Default branch"     value="main"                        mono />
        <FormRow id="project-visibility" label="Visibility"         value="internal"                    />

        <div className="mt-5">
          <Button size="sm">Save changes</Button>
        </div>
      </Panel>

      {/* Danger zone */}
      <Panel className="p-6">
        <div className="mb-1 flex items-baseline gap-3">
          <SectionEyebrow>danger zone</SectionEyebrow>
        </div>
        <h3
          className="display text-[16px] font-semibold leading-tight tracking-[-0.01em]"
          style={{ color: "var(--accent-danger)" }}
        >
          Danger zone
        </h3>
        <p className="mt-1.5 max-w-[520px] text-[13px] text-fg-muted">
          Archive or delete this project. Both actions can be undone within 7 days.
        </p>
        <div className="mt-4 flex gap-2.5">
          <Button variant="outline" size="sm">
            Archive project
          </Button>
          <Button
            variant="outline"
            size="sm"
            style={{
              color: "var(--accent-danger)",
              borderColor: "color-mix(in oklab, var(--accent-danger) 40%, var(--border))",
            }}
          >
            Delete project
          </Button>
        </div>
      </Panel>
    </div>
  );
};

export default ProjectSettings;
