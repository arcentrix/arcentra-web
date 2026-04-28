/**
 * 组织设置对话框
 * TODO: 实现完整的组织设置功能
 */

import * as React from "react";
import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Apis } from "@/api";

interface OrgSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
  mode: "create" | "edit";
}

export function OrgSettingsDialog({
  open,
  onOpenChange,
  organizationId: _organizationId,
  mode,
}: OrgSettingsDialogProps) {
  const isEditMode = mode === "edit";
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, _setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TODO: 从 API 获取组织数据（编辑模式）
  // TODO: 实现表单状态管理
  // TODO: 实现表单验证
  // TODO: 实现创建/更新组织 API 调用

  // 处理 Logo 上传
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error(
        "Invalid file type",
        "Please upload an image file (JPEG, PNG, GIF, or WebP)",
      );
      return;
    }

    // 验证文件大小 (最大 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large", "Please upload an image smaller than 5MB");
      return;
    }

    try {
      setIsUploading(true);

      // 创建预览
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // 上传到服务器
      const response = await Apis.user.uploadAvatar(file);

      // 更新 logo URL
      setLogoUrl(response.url);

      toast.success(
        "Logo uploaded",
        "Organization logo has been uploaded successfully",
      );
    } catch (error) {
      toast.error("Upload failed", (error as Error).message);
      setLogoPreview("");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "组织设置" : "创建组织"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "管理您的组织信息和设置" : "创建一个新的组织来协作"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">基本信息</TabsTrigger>
            <TabsTrigger value="members" disabled={!isEditMode}>
              成员
            </TabsTrigger>
            <TabsTrigger value="settings" disabled={!isEditMode}>
              设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">组织名称</Label>
              <Input
                id="org-name"
                placeholder="输入组织名称"
                // TODO: 绑定表单状态
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-description">描述</Label>
              <Input
                id="org-description"
                placeholder="简短描述您的组织"
                // TODO: 绑定表单状态
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-logo">Logo</Label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-border">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSaving}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isUploading ? "Uploading..." : "Upload"}
                  </Button>
                  <Input
                    id="org-logo"
                    placeholder="Or enter logo URL"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    disabled={isSaving}
                    className="flex-1"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, GIF or WebP (Max 5MB)
              </p>
            </div>

            {isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="org-plan">计划</Label>
                <Input
                  id="org-plan"
                  disabled
                  placeholder="Enterprise"
                  // TODO: 显示当前计划
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            {/* TODO: 实现成员管理功能 */}
            <div className="text-center py-8 text-muted-foreground">
              成员管理功能开发中...
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {/* TODO: 实现组织设置功能 */}
            <div className="text-center py-8 text-muted-foreground">
              组织设置功能开发中...
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              // TODO: 实现提交逻辑
              console.log("TODO: 实现提交逻辑");
              console.log("Logo URL:", logoUrl);
            }}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEditMode ? "保存" : "创建"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
