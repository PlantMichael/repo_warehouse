export interface RepoDirEntry {
  name: string;
  path: string;
  type: string;
}

/**
 * Filters a repo's root directory listing (GitHub Contents API response
 * shape) down to root-level .png files, in the order GitHub returned them.
 * See research.md §6.
 */
export function filterPngPaths(entries: RepoDirEntry[]): string[] {
  return entries
    .filter((entry) => entry.type === "file" && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => entry.path);
}

/**
 * Validates that a requested screenshot path exactly matches one of a
 * project's cached screenshot paths (data-model.md `Project.screenshotPaths`,
 * a JSON-encoded array). Rejects anything not in that list, including
 * path-traversal attempts and paths that merely look like a valid PNG.
 */
export function isValidScreenshotPath(requestedPath: string, cachedPaths: string[]): boolean {
  return cachedPaths.includes(requestedPath);
}

/**
 * Parses the `Project.screenshotPaths` column: `null` means "not yet
 * computed", `"[]"` means "computed, found none", anything else is a
 * JSON-encoded array of paths.
 */
export function parseScreenshotPaths(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}
