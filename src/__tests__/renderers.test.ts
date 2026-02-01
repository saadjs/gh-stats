import { describe, it, expect } from "vitest";
import { renderJson, renderSvg } from "../renderers.js";
import type { LanguageStatsResult } from "../types.js";

describe("Renderers", () => {
  const mockStats: LanguageStatsResult = {
    totalBytes: 100000,
    languages: [
      {
        language: "TypeScript",
        bytes: 50000,
        percent: 50,
      },
      {
        language: "JavaScript",
        bytes: 30000,
        percent: 30,
      },
      {
        language: "Python",
        bytes: 20000,
        percent: 20,
      },
    ],
    generatedAt: "2026-01-30T12:00:00.000Z",
    repositoryCount: 5,
    includedForks: false,
    includedArchived: true,
    includedMarkdown: false,
  };

  describe("renderJson", () => {
    it("should return valid JSON string", () => {
      const output = renderJson(mockStats);
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should include all statistics in JSON output", () => {
      const output = renderJson(mockStats);
      const parsed = JSON.parse(output);

      expect(parsed.totalBytes).toBe(100000);
      expect(parsed.repositoryCount).toBe(5);
      expect(parsed.languages).toHaveLength(3);
      expect(parsed.generatedAt).toBe("2026-01-30T12:00:00.000Z");
    });

    it("should preserve language data in JSON output", () => {
      const output = renderJson(mockStats);
      const parsed = JSON.parse(output);

      expect(parsed.languages[0]).toEqual({
        language: "TypeScript",
        bytes: 50000,
        percent: 50,
      });
    });

    it("should format JSON with proper indentation", () => {
      const output = renderJson(mockStats);
      expect(output).toContain("\n");
      expect(output).toContain("  ");
    });
  });

  describe("renderSvg", () => {
    it("should return SVG string", () => {
      const output = renderSvg(mockStats);
      expect(output).toContain("<svg");
      expect(output).toContain("</svg>");
    });

    it("should include language names in SVG", () => {
      const output = renderSvg(mockStats);
      expect(output).toContain("TypeScript");
      expect(output).toContain("JavaScript");
      expect(output).toContain("Python");
    });

    it("should include percentage values in SVG", () => {
      const output = renderSvg(mockStats);
      expect(output).toContain("50.0%");
      expect(output).toContain("30.0%");
      expect(output).toContain("20.0%");
    });

    it("should handle empty language list", () => {
      const emptyStats: LanguageStatsResult = {
        ...mockStats,
        languages: [],
        totalBytes: 0,
      };
      const output = renderSvg(emptyStats);
      expect(output).toContain("<svg");
      expect(output).toContain("</svg>");
    });

    it("should be valid XML-like structure", () => {
      const output = renderSvg(mockStats);
      // Check for properly closed tags
      const openSvg = (output.match(/<svg/g) || []).length;
      const closeSvg = (output.match(/<\/svg>/g) || []).length;
      expect(openSvg).toBe(closeSvg);
    });

    it("should include metadata about generation", () => {
      const output = renderSvg(mockStats);
      expect(output).toContain("2026-01-30T12:00:00.000Z");
      expect(output).toContain("5"); // repository count
    });
  });

  describe("Output format consistency", () => {
    it("should have different outputs for different formats", () => {
      const json = renderJson(mockStats);
      const svg = renderSvg(mockStats);

      expect(json).not.toBe(svg);
      expect(json.startsWith("{")).toBe(true);
      expect(svg.startsWith("<")).toBe(true);
    });
  });
});
