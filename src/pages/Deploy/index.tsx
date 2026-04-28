import { type FC } from "react";
import { Rocket, Layers, Tag, Server } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaceholderPanel } from "@/components/placeholder-panel";

const Deploy: FC = () => {
  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div>
        <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <Rocket className="h-8 w-8 text-violet-500" />
          Deploy
        </h2>
        <p className="mt-1 text-muted-foreground">
          Deployments, environments and releases for every workload
        </p>
      </div>

      <Tabs defaultValue="deployments" className="w-full">
        <TabsList>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments">
          <PlaceholderPanel
            icon={Server}
            title="Active deployments"
            description="Live and recent deployments across all projects will appear here."
          />
        </TabsContent>
        <TabsContent value="environments">
          <PlaceholderPanel
            icon={Layers}
            title="Environments"
            description="Manage staging, production and preview environments."
          />
        </TabsContent>
        <TabsContent value="releases">
          <PlaceholderPanel
            icon={Tag}
            title="Releases"
            description="Versioned releases with promotion controls are on the way."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Deploy;
