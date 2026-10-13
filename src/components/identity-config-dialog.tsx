import { useState, useEffect } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import type {
  IdentityProvider,
  ProviderType,
  IdentityProviderConfig,
} from "@/api/identity/types";

const isCredentialKey = (key: string) =>
  /secret|password|token|private.?key/i.test(key);

interface IdentityConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: IdentityProvider | null;
  onSubmit: (data: {
    name: string;
    provider_type: ProviderType;
    config: IdentityProviderConfig;
    description?: string;
    priority: number;
    is_enabled: boolean;
  }) => Promise<void>;
}

export function IdentityConfigDialog({
  open,
  onOpenChange,
  provider,
  onSubmit,
}: IdentityConfigDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    provider_type: "oauth" as ProviderType,
    description: "",
    priority: 0,
    is_enabled: true,
  });

  const [configItems, setConfigItems] = useState<
    Array<{ key: string; value: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name,
        provider_type: provider.providerType,
        description: provider.description || "",
        priority: provider.priority,
        is_enabled: provider.isEnabled === 1,
      });

      // 将 config 对象转换为键值对数组
      if (provider.config && typeof provider.config === "object") {
        const items = Array.from(
          new Set([
            ...Object.keys(provider.config),
            ...(provider.configuredFields ?? []).filter(
              (key) => !key.includes("."),
            ),
          ]),
        ).map((key) => {
          const value = provider.config[key];
          return {
            key,
            value: provider.configuredFields?.includes(key)
              ? ""
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value ?? ""),
          };
        });
        setConfigItems(items.length > 0 ? items : [{ key: "", value: "" }]);
      } else {
        setConfigItems([{ key: "", value: "" }]);
      }
    } else {
      setFormData({
        name: "",
        provider_type: "oauth",
        description: "",
        priority: 0,
        is_enabled: true,
      });
      setConfigItems([{ key: "", value: "" }]);
    }
  }, [provider, open]);

  const handleAddConfigItem = () => {
    setConfigItems([...configItems, { key: "", value: "" }]);
  };

  const handleRemoveConfigItem = (index: number) => {
    setConfigItems(configItems.filter((_, i) => i !== index));
  };

  const handleConfigItemChange = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    const newItems = [...configItems];
    newItems[index][field] = value;
    setConfigItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 将键值对数组转换为 config 对象
      const config: IdentityProviderConfig = {};
      configItems.forEach((item) => {
        if (item.key) {
          if (
            provider?.configuredFields?.some((path) =>
              path.startsWith(`${item.key}.`),
            )
          )
            return;
          if (
            provider?.configuredFields?.includes(item.key) &&
            item.value === ""
          )
            return;
          if (
            provider?.configuredFields?.includes(item.key) ||
            isCredentialKey(item.key)
          ) {
            config[item.key] = item.value;
            return;
          }
          // 尝试解析 JSON，如果失败则作为字符串
          try {
            config[item.key] = JSON.parse(item.value);
          } catch {
            config[item.key] = item.value;
          }
        }
      });

      await onSubmit({
        ...formData,
        config,
      });

      toast.success(
        provider
          ? "Provider updated successfully"
          : "Provider created successfully",
      );
      onOpenChange(false);
    } catch {
      toast.error(
        provider ? "Failed to update provider" : "Failed to create provider",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {provider ? "Edit Identity Provider" : "Create Identity Provider"}
          </DialogTitle>
          <DialogDescription>
            Configure Identity provider with support for OAuth, LDAP, OIDC, and
            SAML protocols
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Provider Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g.: GitLab OAuth"
              required
              disabled={!!provider}
            />
            {provider && (
              <p className="text-xs text-muted-foreground">
                Provider name cannot be changed after creation
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider_type">Provider Type *</Label>
              <Select
                value={formData.provider_type}
                onValueChange={(value: ProviderType) =>
                  setFormData({ ...formData, provider_type: value })
                }
                disabled={!!provider}
              >
                <SelectTrigger id="provider_type">
                  <SelectValue placeholder="Select provider type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oauth">OAuth 2.0</SelectItem>
                  <SelectItem value="ldap">LDAP</SelectItem>
                  <SelectItem value="oidc">OpenID Connect</SelectItem>
                  <SelectItem value="saml">SAML 2.0</SelectItem>
                </SelectContent>
              </Select>
              {provider && (
                <p className="text-xs text-muted-foreground">
                  Provider type cannot be changed
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority.toString()}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="Lower number = higher priority"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of this provider"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Configuration</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddConfigItem}
                disabled={!!provider}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-2 border rounded-md p-4">
              {provider?.configuredFields
                ?.filter((key) => key.includes("."))
                .map((key) => (
                  <p key={key} className="text-xs text-muted-foreground">
                    {key}: Configured (write-only)
                  </p>
                ))}
              {configItems.map((item, index) => {
                const configured = !!provider?.configuredFields?.includes(
                  item.key,
                );
                const nestedConfigured = !!provider?.configuredFields?.some(
                  (path) => path.startsWith(`${item.key}.`),
                );
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Configuration key ${index + 1}`}
                        placeholder="Key (e.g.: clientId)"
                        value={item.key}
                        onChange={(e) =>
                          handleConfigItemChange(index, "key", e.target.value)
                        }
                        className="flex-1"
                        disabled={!!provider && !!item.key}
                      />
                      <Input
                        aria-label={`Configuration ${item.key || index + 1}`}
                        type={
                          configured || isCredentialKey(item.key)
                            ? "password"
                            : "text"
                        }
                        readOnly={nestedConfigured}
                        autoComplete={
                          configured || isCredentialKey(item.key)
                            ? "new-password"
                            : "off"
                        }
                        placeholder="Value (e.g.: YOUR_CLIENT_ID)"
                        value={item.value}
                        onChange={(e) =>
                          handleConfigItemChange(index, "value", e.target.value)
                        }
                        className="flex-[2]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveConfigItem(index)}
                        disabled={
                          configItems.length === 1 || (!!provider && !!item.key)
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {configured && (
                      <p className="text-xs text-muted-foreground">
                        Configured; leave blank to keep the existing value.
                      </p>
                    )}
                    {nestedConfigured && (
                      <p className="text-xs text-muted-foreground">
                        This nested object contains write-only values and is
                        read-only here.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              Tip: Values support JSON format. For arrays use ["value1",
              "value2"] format
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_enabled"
              checked={formData.is_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_enabled: checked })
              }
              disabled={!!provider}
            />
            <Label
              htmlFor="is_enabled"
              className={
                !!provider ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }
            >
              Enable this provider
            </Label>
            {provider && (
              <p className="text-xs text-muted-foreground ml-2">
                (Use the toggle button on the list page to enable/disable)
              </p>
            )}
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
