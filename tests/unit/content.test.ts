import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  safeURL,
  validateRich,
  validateContent,
  mediaIDs,
} from "../../src/lib/validation";
import { validatePublicConfig } from "../../src/lib/config";
import { RichText, headings } from "../../src/components/RichText";
import { defaultData, type RichNode } from "../../src/lib/types";
describe("browser content and configuration boundaries", () => {
  it("refuses secret/service role keys, partial config, and insecure external URLs", () => {
    expect(validatePublicConfig("", "").configured).toBe(false);
    expect(
      validatePublicConfig("https://example.supabase.co", "sb_publishable_test")
        .configured,
    ).toBe(true);
    expect(
      validatePublicConfig("https://example.supabase.co", "sb_secret_test")
        .configured,
    ).toBe(false);
    const jwt = `test.${btoa(JSON.stringify({ role: "service_role" }))}.test`;
    expect(
      validatePublicConfig("https://example.supabase.co", jwt).configured,
    ).toBe(false);
    expect(
      validatePublicConfig("http://example.com", "sb_publishable_test")
        .configured,
    ).toBe(false);
    expect(
      validatePublicConfig("https://example.supabase.co", "").configured,
    ).toBe(false);
  });
  it("permits only controlled hyperlink schemes without control characters", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,script",
      "//example.com",
      "https://ok.com\nscript",
    ])
      expect(safeURL(value)).toBe(false);
    expect(safeURL("https://example.com/path")).toBe(true);
    expect(safeURL("mailto:owner@example.test")).toBe(true);
  });
  it("renders escaped text and refuses unknown/raw-HTML nodes and dangerous links", () => {
    const value: RichNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "<img src=x onerror=alert(1)>",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        { type: "html", text: "<script>alert(1)</script>" },
      ],
    };
    const html = renderToStaticMarkup(createElement(RichText, { value }));
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<script");
    expect(validateRich(value)).toBe(false);
  });
  it("rejects invalid prices and dates before any API call", () => {
    expect(() =>
      validateContent("product", "test", {
        ...defaultData("product"),
        priceMode: "exact",
        price: -10,
      }),
    ).toThrow("цену");
    expect(() =>
      validateContent("document", "test", { title: "Policy", editionDate: "" }),
    ).toThrow("дату");
    expect(() =>
      validateContent("category", "Bad Address", { title: "Test" }),
    ).toThrow("Адрес");
  });
  it("deduplicates all referenced media and never treats product flags as relationships", () => {
    expect(
      mediaIDs({
        title: "Test",
        image: "one",
        gallery: ["one", "two"],
        pdf: "three",
        logo: "four",
        favicon: null,
      }),
    ).toEqual(["one", "three", "four", "two"]);
    expect(defaultData("product").priceMode).toBe("request");
  });
  it("heading anchors remain aligned with safe rich text rendering", () => {
    const value: RichNode = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Section" }],
        },
      ],
    };
    const html = renderToStaticMarkup(createElement(RichText, { value }));
    expect(headings(value)[0].id).toBe("section-root-0");
    expect(html).toContain('id="section-root-0"');
  });
});
