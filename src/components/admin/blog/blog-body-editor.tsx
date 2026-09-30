"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { MarkdownContent } from "@/components/shared/markdown-content";

interface BlogBodyEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * STORY-044. A markdown textarea + formatting toolbar, not a WYSIWYG
 * editor — `BlogPost.bodyContent` is plain markdown with `[[recipe:slug]]`
 * / `[[video:url]]` block embeds (src/lib/blog-body-blocks.ts), the exact
 * format STORY-021's storefront already renders. The toolbar writes that
 * same markdown rather than a new structured format, so nothing here can
 * ever drift from what `/blog/[slug]` shows. The preview toggle below
 * renders through the real `MarkdownContent` component for the markdown
 * portion; the recipe/video embed tokens themselves only fully resolve on
 * the dedicated Preview page (which reuses the real storefront rendering
 * against saved, any-status data), since resolving an arbitrary embed
 * slug live on every keystroke here would mean a network call per
 * keystroke.
 */
export function BlogBodyEditor({ id, value, onChange }: BlogBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  function applyAtSelection(build: (selected: string) => { text: string; cursorOffset: number }) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const { text: inserted, cursorOffset } = build(selected);
    const nextValue = value.slice(0, start) + inserted + value.slice(end);
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + cursorOffset;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function wrap(before: string, after: string, placeholder: string) {
    applyAtSelection((selected) => {
      const text = selected || placeholder;
      return { text: `${before}${text}${after}`, cursorOffset: before.length + text.length };
    });
  }

  function insertBlock(token: string) {
    applyAtSelection(() => ({ text: `\n\n${token}\n\n`, cursorOffset: 2 + token.length }));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-input bg-cream/50 p-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => wrap("**", "**", "bold text")}>
          Bold
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => wrap("*", "*", "italic text")}>
          Italic
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => insertBlock("## Heading")}>
          Heading
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => wrap("[", "](https://)", "link text")}>
          Link
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => insertBlock("- List item")}>
          List
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => insertBlock("> Quote")}>
          Quote
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setImagePickerOpen(true)}>
          Image
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => insertBlock("[[recipe:recipe-slug]]")}>
          Recipe embed
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => insertBlock("[[video:https://]]")}>
          Video embed
        </Button>
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setShowPreview((current) => !current)}>
          {showPreview ? "Edit" : "Preview"}
        </Button>
      </div>

      {showPreview ? (
        <div className="rounded-b-lg border border-input p-4">
          <MarkdownContent content={value || "*Nothing written yet.*"} />
          <p className="mt-4 text-caption text-charcoal/60">
            Recipe and video embeds render on the full Preview page, not here — resolving them needs a database lookup.
          </p>
        </div>
      ) : (
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={16}
          className="rounded-t-none font-mono text-small"
        />
      )}

      <AssetPickerDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        onSelect={(asset) => {
          applyAtSelection(() => ({ text: `![${asset.altText ?? ""}](${asset.url})`, cursorOffset: `![${asset.altText ?? ""}](${asset.url})`.length }));
          setImagePickerOpen(false);
        }}
      />
    </div>
  );
}
