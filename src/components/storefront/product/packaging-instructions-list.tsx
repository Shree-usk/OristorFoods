import { cn } from "@/lib/utils";

/**
 * Admin-authored `customerInstructions`/`packagingInstructions` free text
 * (a `<Textarea>` in the admin form) is one newline-separated condition per
 * line. Rendered as a numbered list when there's more than one line — a
 * single line stays plain text, since numbering "1." in front of one
 * sentence reads oddly. Shared by every place this text appears: the PDP
 * packaging selector, checkout review, order confirmation, the account
 * order-detail page, and the admin order-detail view.
 */
export function PackagingInstructionsList({ text, className }: { text: string; className?: string }) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  if (lines.length === 1) return <p className={className}>{lines[0]}</p>;

  return (
    <ol className={cn("list-decimal space-y-0.5 pl-4", className)}>
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ol>
  );
}
