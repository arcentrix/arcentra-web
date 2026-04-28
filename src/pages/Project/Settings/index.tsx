/**
 * Project Settings 页面
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { Settings2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const ProjectSettings: FC = () => {
  const { projectId: _projectId } = useParams<{ projectId: string }>();

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings2 className="h-8 w-8 text-gray-500" />
            Project Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure your project settings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Basic project configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input id="project-name" defaultValue="Project" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              placeholder="Enter project description"
            />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectSettings;
