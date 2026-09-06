import { describe, expect, it } from "vitest";
import { parseRepoUrl } from "./github";

describe("parseRepoUrl", () => {
  it("parses a plain repo URL", () => {
    expect(parseRepoUrl("https://github.com/mdn/beginner-html-site")).toEqual({
      owner: "mdn",
      name: "beginner-html-site",
    });
  });

  it("strips a .git suffix", () => {
    expect(parseRepoUrl("https://github.com/mdn/beginner-html-site.git")).toEqual({
      owner: "mdn",
      name: "beginner-html-site",
    });
  });

  it("ignores extra path segments (branches, tabs, etc.)", () => {
    expect(parseRepoUrl("https://github.com/mdn/beginner-html-site/tree/main")).toEqual({
      owner: "mdn",
      name: "beginner-html-site",
    });
  });

  it("accepts a trailing slash", () => {
    expect(parseRepoUrl("https://github.com/mdn/beginner-html-site/")).toEqual({
      owner: "mdn",
      name: "beginner-html-site",
    });
  });

  it("accepts www.github.com", () => {
    expect(parseRepoUrl("https://www.github.com/mdn/beginner-html-site")).toEqual({
      owner: "mdn",
      name: "beginner-html-site",
    });
  });

  it("rejects non-GitHub hosts", () => {
    expect(parseRepoUrl("https://gitlab.com/mdn/beginner-html-site")).toBeNull();
  });

  it("rejects a URL with no repo path", () => {
    expect(parseRepoUrl("https://github.com/mdn")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseRepoUrl("not a url")).toBeNull();
    expect(parseRepoUrl("")).toBeNull();
  });
});
