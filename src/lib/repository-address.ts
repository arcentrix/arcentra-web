/** Display only a repository address, never an actionable or credentialed URL. */
export function repositoryAddress(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Not provided";
  const address = value.trim();
  // Git also accepts SCP-style addresses such as git@host:owner/repo.git.
  const scp = /^[^\s@/:]+@([\w.-]+):([^\s?#]+)(?:[?#].*)?$/.exec(address);
  if (scp) return `${scp[1]}:${scp[2]}`;
  try {
    const url = new URL(address);
    if (!["https:", "http:", "ssh:", "git:"].includes(url.protocol))
      return "Unsupported repository address";
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "Unsupported repository address";
  }
}
