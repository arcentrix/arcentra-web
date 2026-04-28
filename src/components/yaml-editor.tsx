/**
 * YAML Editor Component - 使用 Monaco Editor
 * 参考 https://github.com/GeorgeBPrice/Code-Playground-Sandbox
 */

import { useRef } from "react";
import Editor from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import type { editor } from "monaco-editor";

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  className?: string;
  readOnly?: boolean;
}

export function YamlEditor({
  value,
  onChange,
  height = "500px",
  className,
  readOnly = false,
}: YamlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // 检测系统主题
  const getTheme = () => {
    if (typeof window !== "undefined") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return isDark ? "vs-dark" : "vs";
    }
    return "vs";
  };

  const handleEditorDidMount = (
    editorInstance: editor.IStandaloneCodeEditor,
  ) => {
    editorRef.current = editorInstance;

    // 配置编辑器选项
    editorInstance.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: "on",
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      renderLineHighlight: "all",
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      wordWrap: "on",
      tabSize: 2,
      insertSpaces: true,
      automaticLayout: true,
      formatOnPaste: true,
      formatOnType: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: "on",
      quickSuggestions: true,
    });
  };

  return (
    <div
      className={cn(
        "border rounded-md overflow-hidden bg-background",
        className,
      )}
      style={{ height }}
    >
      <Editor
        height={height}
        defaultLanguage="yaml"
        value={value}
        onChange={(val: string | undefined) => onChange(val || "")}
        onMount={handleEditorDidMount}
        options={{
          // 只读模式
          readOnly,
          // 禁用小地图
          minimap: { enabled: false },
          // 不允许滚动超出最后一行
          scrollBeyondLastLine: false,
          // 字体大小
          fontSize: 14,
          // 显示行号
          lineNumbers: "on",
          // 行装饰宽度
          lineDecorationsWidth: 10,
          // 行号最小字符数
          lineNumbersMinChars: 3,
          // 渲染行高亮
          renderLineHighlight: "all",
          // 滚动条配置
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          // 自动换行
          wordWrap: "on",
          // Tab 键缩进大小（空格数）
          tabSize: 2,
          // 使用空格而不是 Tab
          insertSpaces: true,
          // 自动布局调整
          automaticLayout: true,
          // 粘贴时自动格式化
          formatOnPaste: true,
          // 输入时自动格式化
          formatOnType: true,
          // 在触发字符时显示建议
          suggestOnTriggerCharacters: true,
          // 按 Enter 键接受建议
          acceptSuggestionOnEnter: "on",
          // 快速建议
          quickSuggestions: true,
          // 编辑器内边距（顶部和底部留出空隙）
          padding: {
            top: 12,
            bottom: 12,
          },
        }}
        theme={getTheme()}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}
