import { type FC } from "react";
import { Hammer, GitBranch, History, Package, Play } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlaceholderPanel } from "@/components/placeholder-panel";

const Build: FC = () => {
  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Hammer className="h-8 w-8 text-amber-500" />
            Build
          </h2>
          <p className="mt-1 text-muted-foreground">
            Pipelines, runs and build artifacts across all projects
          </p>
        </div>
        <Button className="gap-1.5">
          <Play className="h-4 w-4" />
          Trigger Pipeline
        </Button>
      </div>

      <Tabs defaultValue="pipelines" className="w-full">
        <TabsList>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="pipelines">
          <PlaceholderPanel
            icon={GitBranch}
            title="Cross-project pipelines"
            description="A unified list of every pipeline across your workspace lives here. Open a project for now to view its pipelines."
          />
        </TabsContent>
        <TabsContent value="runs">
          <PlaceholderPanel
            icon={History}
            title="Recent pipeline runs"
            description="Aggregated run history across projects is coming soon."
          />
        </TabsContent>
        <TabsContent value="artifacts">
          <PlaceholderPanel
            icon={Package}
            title="Build artifacts"
            description="Container images, binaries and packages from all builds will surface here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Build;
