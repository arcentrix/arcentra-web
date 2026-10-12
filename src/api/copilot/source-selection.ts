const allowedExtensions = new Set([
  "go",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "cs",
  "rb",
  "sh",
  "sql",
  "yaml",
  "yml",
  "json",
  "toml",
  "xml",
  "md",
  "txt",
  "css",
  "html",
]);
const sensitiveName =
  /(secret|token|password|passwd|credential|private.?key|api.?key|access.?key|authorization|cookie)/i;

// Convenience feedback only. The authenticated server revalidates every path,
// job association, source permission, file type, size and immutable identity.
export function sourcePathError(path: string): string | null {
  if (!path || path !== path.trim())
    return "Enter an exact repository-relative file path without surrounding spaces.";
  const bytes = new TextEncoder().encode(path);
  if (new TextDecoder().decode(bytes) !== path)
    return "Use a valid UTF-8 file path.";
  if (bytes.length > 512) return "Use a path of at most 512 UTF-8 bytes.";
  if (
    path.startsWith("/") ||
    /[\\%?#:]/.test(path) ||
    [...path].some(
      (value) =>
        value.charCodeAt(0) < 32 ||
        (value.charCodeAt(0) >= 127 && value.charCodeAt(0) <= 159),
    )
  )
    return "Use a relative file path without URLs, escapes, query strings or control characters.";
  const parts = path.split("/");
  if (parts.length > 8) return "Use a path with at most 8 components.";
  if (parts.some((part) => !part || part.startsWith(".")))
    return "Empty, hidden and traversal path components are not allowed.";
  if (
    parts.some(
      (part) =>
        sensitiveName.test(part) ||
        /^(id_rsa|id_ed25519)$|^kubeconfig/i.test(part),
    )
  )
    return "Files with credential or secret-related names cannot be selected.";
  const name = parts[parts.length - 1].toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop()! : "";
  if (
    name !== "dockerfile" &&
    name !== "makefile" &&
    !allowedExtensions.has(extension)
  )
    return "Choose a supported source or text file, such as .go, .ts, .yaml, .md, Dockerfile or Makefile.";
  return null;
}
