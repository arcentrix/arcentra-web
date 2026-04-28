/**
 * Agent 编辑对话框组件
 */

import { useState, useEffect } from "react";
import { Save, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import type { Agent, UpdateAgentRequest, AgentStatus } from "@/api/agent/types";

interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onSubmit: (data: UpdateAgentRequest) => Promise<void>;
}

export function AgentDialog({
  open,
  onOpenChange,
  agent,
  onSubmit,
}: AgentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    agentName: "",
    address: "",
    port: "",
    os: "Linux",
    arch: "amd64",
    version: "",
    status: 1 as AgentStatus,
    labels: {} as Record<string, string>,
    metrics: "/metrics",
    isEnabled: true,
  });
  const [labelPairs, setLabelPairs] = useState<
    Array<{ key: string; value: string }>
  >([]);

  useEffect(() => {
    if (agent && open) {
      setFormData({
        agentName: agent.agentName,
        address: agent.address,
        port: agent.port,
        os: agent.os,
        arch: agent.arch,
        version: agent.version,
        status: agent.status,
        labels: agent.labels || {},
        metrics: agent.metrics,
        isEnabled: agent.isEnabled === 1,
      });
      // 将 labels 对象转换为数组形式
      const labels = agent.labels || {};
      setLabelPairs(
        Object.keys(labels).length > 0
          ? Object.entries(labels).map(([key, value]) => ({ key, value }))
          : [{ key: "", value: "" }],
      );
    } else if (open && !agent) {
      setFormData({
        agentName: "",
        address: "",
        port: "",
        os: "Linux",
        arch: "amd64",
        version: "",
        status: 1,
        labels: {},
        metrics: "/metrics",
        isEnabled: true,
      });
      setLabelPairs([{ key: "", value: "" }]);
    }
  }, [agent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agent) {
      toast.error("No agent selected");
      return;
    }

    setLoading(true);

    try {
      // 将 labelPairs 转换为 labels 对象
      const labels: Record<string, string> = {};
      labelPairs.forEach((pair) => {
        if (pair.key.trim()) {
          labels[pair.key.trim()] = pair.value.trim();
        }
      });

      const updateData: UpdateAgentRequest = {
        agentName: formData.agentName,
        labels,
      };
      await onSubmit(updateData);
      toast.success("Agent updated successfully");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update agent");
      console.error("Submit failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
          <DialogDescription>
            Update agent information and configuration
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name *</Label>
            <Input
              id="agentName"
              value={formData.agentName}
              onChange={(e) =>
                setFormData({ ...formData, agentName: e.target.value })
              }
              placeholder="e.g.: agent-001"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Labels</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLabelPairs([...labelPairs, { key: "", value: "" }])
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Label
              </Button>
            </div>
            <div className="space-y-2">
              {labelPairs.map((pair, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Key"
                      value={pair.key}
                      onChange={(e) => {
                        const newPairs = [...labelPairs];
                        newPairs[index].key = e.target.value;
                        setLabelPairs(newPairs);
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Value"
                      value={pair.value}
                      onChange={(e) => {
                        const newPairs = [...labelPairs];
                        newPairs[index].value = e.target.value;
                        setLabelPairs(newPairs);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newPairs = labelPairs.filter((_, i) => i !== index);
                      if (newPairs.length === 0) {
                        newPairs.push({ key: "", value: "" });
                      }
                      setLabelPairs(newPairs);
                    }}
                    className="mt-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Add key-value pairs for labels. Empty keys will be ignored.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-1" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
