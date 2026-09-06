import { describe, expect, it } from "vitest";
import { filterPngPaths, isValidScreenshotPath, parseScreenshotPaths } from "./screenshots";

describe("filterPngPaths", () => {
  it("keeps only root-level .png files", () => {
    const entries = [
      { name: "openedproject.png", path: "openedproject.png", type: "file" },
      { name: "projects.png", path: "projects.png", type: "file" },
      { name: "README.md", path: "README.md", type: "file" },
      { name: "screenshots", path: "screenshots", type: "dir" },
    ];
    expect(filterPngPaths(entries)).toEqual(["openedproject.png", "projects.png"]);
  });

  it("matches .png case-insensitively", () => {
    const entries = [{ name: "Logo.PNG", path: "Logo.PNG", type: "file" }];
    expect(filterPngPaths(entries)).toEqual(["Logo.PNG"]);
  });

  it("returns an empty array when there are no PNGs", () => {
    const entries = [{ name: "index.html", path: "index.html", type: "file" }];
    expect(filterPngPaths(entries)).toEqual([]);
  });

  it("ignores directories even if named like a png", () => {
    const entries = [{ name: "icons.png", path: "icons.png", type: "dir" }];
    expect(filterPngPaths(entries)).toEqual([]);
  });
});

describe("isValidScreenshotPath", () => {
  const cached = ["openedproject.png", "projects.png"];

  it("accepts a path in the cached list", () => {
    expect(isValidScreenshotPath("projects.png", cached)).toBe(true);
  });

  it("rejects a syntactically valid PNG path not in the cached list", () => {
    expect(isValidScreenshotPath("other.png", cached)).toBe(false);
  });

  it("rejects a path-traversal attempt", () => {
    expect(isValidScreenshotPath("../../etc/passwd.png", cached)).toBe(false);
  });
});

describe("parseScreenshotPaths", () => {
  it("returns null for not-yet-computed", () => {
    expect(parseScreenshotPaths(null)).toBeNull();
  });

  it("returns an empty array for computed-but-none", () => {
    expect(parseScreenshotPaths("[]")).toEqual([]);
  });

  it("parses a JSON-encoded array of paths", () => {
    expect(parseScreenshotPaths('["a.png","b.png"]')).toEqual(["a.png", "b.png"]);
  });

  it("falls back to an empty array for malformed JSON", () => {
    expect(parseScreenshotPaths("not json")).toEqual([]);
  });
});
