import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { RichNode } from "../lib/types";
import { safeURL } from "../lib/validation";
import styles from "./Admin.module.css";
export function RichEditor({
  value,
  onChange,
  label,
}: {
  value?: RichNode;
  onChange: (value: RichNode) => void;
  label: string;
}) {
  const [url, setURL] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: false,
          protocols: ["http", "https", "mailto", "tel"],
          isAllowedUri: (uri) => safeURL(uri),
        },
      }),
    ],
    content: value || { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichNode),
    editorProps: {
      attributes: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
        class: styles.richInput,
      },
    },
  });
  useEffect(() => {
    if (
      editor &&
      value &&
      JSON.stringify(editor.getJSON()) !== JSON.stringify(value)
    )
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  if (!editor) return null;
  return (
    <div className={styles.richEditor}>
      <span className={styles.label}>{label}</span>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label={`Форматирование: ${label}`}
      >
        <button
          type="button"
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Жирный
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Курсив
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          Текст
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          Заголовок 2
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          Заголовок 3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          Список
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
        >
          Отменить ввод
        </button>
      </div>
      <EditorContent editor={editor} />
      <div className={styles.inline}>
        <label>
          Ссылка
          <input
            type="url"
            value={url}
            onChange={(e) => setURL(e.target.value)}
            placeholder="https://"
          />
        </label>
        <button
          type="button"
          disabled={!safeURL(url)}
          onClick={() => {
            if (safeURL(url)) {
              editor.chain().focus().setLink({ href: url }).run();
              setURL("");
            }
          }}
        >
          Добавить к выделению
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          Убрать ссылку
        </button>
      </div>
    </div>
  );
}
