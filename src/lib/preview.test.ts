import { describe, expect, it } from "vitest";
import { injectBase, isPathSafe, mimeFor } from "./preview";

describe("mimeFor", () => {
  it("maps known extensions", () => {
    expect(mimeFor("index.html")).toContain("text/html");
    expect(mimeFor("styles/main.css")).toContain("text/css");
    expect(mimeFor("app.js")).toContain("text/javascript");
    expect(mimeFor("logo.png")).toBe("image/png");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(mimeFor("data.unknownext")).toBe("application/octet-stream");
  });

  it("falls back to octet-stream when there is no extension", () => {
    expect(mimeFor("Makefile")).toBe("application/octet-stream");
  });
});

describe("injectBase", () => {
  it("inserts the base tag right after <head>", () => {
    const html = "<html><head><title>t</title></head><body></body></html>";
    const result = injectBase(html, "/api/preview/abc/");
    expect(result).toBe(
      '<html><head><base href="/api/preview/abc/"><title>t</title></head><body></body></html>'
    );
  });

  it("creates a head when <html> exists but <head> does not", () => {
    const html = "<html><body>hi</body></html>";
    const result = injectBase(html, "/api/preview/abc/");
    expect(result).toBe('<html><head><base href="/api/preview/abc/"></head><body>hi</body></html>');
  });

  it("prepends the base tag when there is no html/head at all", () => {
    const html = "<p>just a fragment</p>";
    const result = injectBase(html, "/api/preview/abc/");
    expect(result).toBe('<base href="/api/preview/abc/"><p>just a fragment</p>');
  });
});

describe("isPathSafe", () => {
  it("allows normal relative paths", () => {
    expect(isPathSafe("styles/main.css")).toBe(true);
    expect(isPathSafe("index.html")).toBe(true);
  });

  it("rejects path traversal attempts", () => {
    expect(isPathSafe("../secrets.txt")).toBe(false);
    expect(isPathSafe("assets/../../etc/passwd")).toBe(false);
  });
});
