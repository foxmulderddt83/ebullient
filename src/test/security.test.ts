import { describe, it, expect } from "vitest";
import { sanitizeHtml, hasSqlInjection } from "../lib/security";

describe("Security Utilities", () => {
  describe("sanitizeHtml", () => {
    it("should strip script tags", () => {
      const input = '<div>Hello <script>alert("xss")</script> world</div>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain("<script>");
      expect(output).not.toContain("alert");
      expect(output).toBe("<div>Hello  world</div>");
    });

    it("should strip event handlers", () => {
      const input = '<img src="x" onerror="alert(1)">';
      const output = sanitizeHtml(input);
      expect(output).not.toContain("onerror");
      expect(output).toBe('<img src="x">');
    });

    it("should strip dangerous tags like iframe", () => {
      const input = '<iframe src="malicious.com"></iframe>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain("<iframe");
      expect(output).toBe("");
    });

    it("should preserve safe tags", () => {
      const input = "<b>Bold</b> <i>Italic</i> <p>Paragraph</p>";
      const output = sanitizeHtml(input);
      expect(output).toBe(input);
    });
  });

  describe("hasSqlInjection", () => {
    it("should detect common SQL injection patterns", () => {
      expect(hasSqlInjection("' OR 1=1 --")).toBe(true);
      expect(hasSqlInjection('admin" --')).toBe(true);
      expect(hasSqlInjection("normal@email.com")).toBe(false);
    });
  });
});
