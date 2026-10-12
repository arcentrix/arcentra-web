import { describe, expect, it } from "vitest";
import { sourcePathError } from "./source-selection";

describe("explicit repository source paths", () => {
  it.each([
    "src/main.go",
    "web/App.tsx",
    "Dockerfile",
    "build/Makefile",
    "docs/説明.md",
    "a/b/c/d/e/f/g/main.py",
  ])("accepts bounded source path %s", (path) => {
    expect(sourcePathError(path)).toBeNull();
  });
  it.each([
    "",
    " src/main.go",
    "src/main.go ",
    "/src/main.go",
    "../main.go",
    "src/../main.go",
    "src/./main.go",
    "src//main.go",
    "src/main.go/",
    "src\\main.go",
    "src/%2e%2e/main.go",
    "https://github.com/org/repo/main.go",
    "src/main.go?ref=main",
    "src/main.go#L1",
    "C:/src/main.go",
    "src/\nmain.go",
    "src/\tmain.go",
    "src/\u0000main.go",
    "src/\u007fmain.go",
    ".env",
    ".github/build.yml",
    "config/secrets.yaml",
    "src/api_key.go",
    "credentials.json",
    "config/id_rsa",
    "config/id_ed25519",
    "config/kubeconfig.yaml",
    "a/b/c/d/e/f/g/h/main.go",
    "image.png",
    "binary.exe",
    "README",
    `src/${"x".repeat(510)}.go`,
    `src/${"é".repeat(255)}.go`,
    "src/\ud800.go",
    "src/\u0085main.go",
    "src/\u009fmain.go",
  ])("rejects unsafe or unsupported path %j", (path) => {
    expect(sourcePathError(path)).toEqual(expect.any(String));
  });
});
