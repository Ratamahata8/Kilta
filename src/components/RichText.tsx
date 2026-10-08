import type { ReactNode } from "react";
import type { RichNode } from "../lib/types";
import { safeURL } from "../lib/validation";
export function RichText({ value }: { value?: RichNode | string | null }) {
  if (typeof value === "string")
    return <p style={{ whiteSpace: "pre-line" }}>{value}</p>;
  if (!value) return null;
  const render = (
    node: RichNode,
    key: number | string,
    depth = 0,
  ): ReactNode => {
    if (depth > 30) return null;
    const children = node.content?.map((n, i) =>
      render(n, `${key}-${i}`, depth + 1),
    );
    if (node.type === "text") {
      let text: ReactNode = node.text || "";
      for (const mark of node.marks || []) {
        if (mark.type === "bold") text = <strong>{text}</strong>;
        else if (mark.type === "italic") text = <em>{text}</em>;
        else if (mark.type === "underline") text = <u>{text}</u>;
        else if (mark.type === "strike") text = <s>{text}</s>;
        else if (mark.type === "code") text = <code>{text}</code>;
        else if (mark.type === "link" && safeURL(mark.attrs?.href))
          text = (
            <a href={String(mark.attrs?.href)} rel="noopener noreferrer">
              {text}
            </a>
          );
      }
      return <span key={key}>{text}</span>;
    }
    switch (node.type) {
      case "doc":
        return <div key={key}>{children}</div>;
      case "paragraph":
        return <p key={key}>{children}</p>;
      case "heading":
        return Number(node.attrs?.level) === 3 ? (
          <h3 key={key} id={`section-${key}`}>
            {children}
          </h3>
        ) : (
          <h2 key={key} id={`section-${key}`}>
            {children}
          </h2>
        );
      case "bulletList":
        return <ul key={key}>{children}</ul>;
      case "orderedList":
        return <ol key={key}>{children}</ol>;
      case "listItem":
        return <li key={key}>{children}</li>;
      case "blockquote":
        return <blockquote key={key}>{children}</blockquote>;
      case "hardBreak":
        return <br key={key} />;
      case "horizontalRule":
        return <hr key={key} />;
      default:
        return null;
    }
  };
  return render(value, "root");
}
export function headings(value?: RichNode) {
  const found: { id: string; text: string }[] = [];
  const visit = (node: RichNode, key: string) => {
    if (node.type === "heading")
      found.push({
        id: `section-${key}`,
        text: node.content?.map((c) => c.text || "").join("") || "",
      });
    node.content?.forEach((n, i) => visit(n, `${key}-${i}`));
  };
  if (value) visit(value, "root");
  return found;
}
