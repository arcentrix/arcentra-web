import { useEffect, useMemo, useState, type FC } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SettingItem, SettingValue } from "@/api/general-settings/types";
import { cn } from "@/lib/utils";

const SENSITIVE_KEYWORDS = ["secret", "key", "salt", "password", "token"];

function isSensitiveField(fieldName: string) {
  const lower = fieldName.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

type FieldType = "string" | "number" | "boolean" | "json";

function detectType(value: unknown): FieldType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "json";
}

interface GeneralSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setting: SettingItem | null;
  onSubmit: (value: SettingValue) => Promise<void> | void;
}

export const GeneralSettingsSheet: FC<GeneralSettingsSheetProps> = ({
  open,
  onOpenChange,
  setting,
  onSubmit,
}) => {
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !setting) return;
    setDraft({ ...setting.value });
    setErrors({});
    setRevealed({});
  }, [open, setting]);

  const fields = useMemo(() => {
    if (!setting) return [] as Array<{ key: string; type: FieldType }>;
    return Object.entries(setting.value).map(([key, value]) => ({
      key,
      type: detectType(value),
    }));
  }, [setting]);

  const handleChange = (key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const { [key]: _omit, ...rest } = prev;
        return rest;
      });
    }
  };

  const validateAndBuild = (): SettingValue | null => {
    const result: SettingValue = {};
    const nextErrors: Record<string, string> = {};

    for (const { key, type } of fields) {
      const raw = draft[key];
      if (type === "number") {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (
          raw === "" ||
          raw === null ||
          raw === undefined ||
          Number.isNaN(n)
        ) {
          nextErrors[key] = "Must be a number";
          continue;
        }
        result[key] = n;
      } else if (type === "boolean") {
        result[key] = Boolean(raw);
      } else if (type === "json") {
        if (typeof raw === "string") {
          try {
            result[key] = JSON.parse(raw);
          } catch {
            nextErrors[key] = "Invalid JSON";
            continue;
          }
        } else {
          result[key] = raw;
        }
      } else {
        result[key] = typeof raw === "string" ? raw : String(raw ?? "");
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0 ? result : null;
  };

  const handleSave = async () => {
    if (!setting) return;
    const next = validateAndBuild();
    if (!next) return;

    setLoading(true);
    try {
      await onSubmit(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[460px] max-w-[calc(100vw-64px)] flex-col gap-0 p-0 sm:max-w-[460px]"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b px-6 py-5 text-left">
          <SheetTitle className="font-mono text-base">
            {setting?.name ?? "Setting"}
          </SheetTitle>
          <SheetDescription className="text-[13px]">
            Edit the value of this configuration item. Field types are inferred
            from the current data.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <ScrollArea className="h-full">
            <div className="space-y-5 px-6 py-6">
              {fields.length === 0 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  This setting has no editable fields.
                </div>
              )}

              {fields.map(({ key, type }) => {
                const value = draft[key];
                const error = errors[key];
                const sensitive = isSensitiveField(key) && type === "string";

                return (
                  <div key={key} className="space-y-1.5">
                    <Label
                      htmlFor={`field-${key}`}
                      className="flex items-center justify-between gap-2 text-[13px]"
                    >
                      <span className="font-mono">{key}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {type}
                      </span>
                    </Label>

                    {type === "boolean" && (
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                        <Switch
                          id={`field-${key}`}
                          checked={Boolean(value)}
                          onCheckedChange={(checked) =>
                            handleChange(key, checked)
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {value ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    )}

                    {type === "number" && (
                      <Input
                        id={`field-${key}`}
                        type="number"
                        value={
                          value === undefined || value === null
                            ? ""
                            : String(value)
                        }
                        onChange={(e) =>
                          handleChange(
                            key,
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                      />
                    )}

                    {type === "string" && (
                      <div className="relative">
                        <Input
                          id={`field-${key}`}
                          type={
                            sensitive && !revealed[key] ? "password" : "text"
                          }
                          value={
                            typeof value === "string"
                              ? value
                              : String(value ?? "")
                          }
                          onChange={(e) => handleChange(key, e.target.value)}
                          className={cn(sensitive && "pr-9")}
                        />
                        {sensitive && (
                          <button
                            type="button"
                            onClick={() =>
                              setRevealed((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                            aria-label={
                              revealed[key] ? "Hide value" : "Show value"
                            }
                          >
                            {revealed[key] ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {type === "json" && (
                      <Textarea
                        id={`field-${key}`}
                        rows={6}
                        className="font-mono text-xs"
                        value={
                          typeof value === "string"
                            ? value
                            : JSON.stringify(value ?? null, null, 2)
                        }
                        onChange={(e) => handleChange(key, e.target.value)}
                      />
                    )}

                    {error && (
                      <p className="text-xs text-destructive">{error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <Separator />
        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || !setting}
            onClick={handleSave}
          >
            {loading ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
