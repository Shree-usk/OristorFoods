import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Shared markdown renderer for Food Academy (and future content types).
 * react-markdown renders to React elements, not raw HTML strings, so raw
 * HTML embedded in the source (e.g. a pasted <script> tag) is emitted as
 * inert text, never executed — do not add rehype-raw, which would defeat
 * this.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="text-h3 font-heading text-charcoal mt-8 mb-3">{children}</h2>,
          h2: ({ children }) => <h2 className="text-h4 font-heading text-charcoal mt-6 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-h5 font-heading text-charcoal mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="text-body text-charcoal mb-4">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 text-body text-charcoal">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 text-body text-charcoal">{children}</ol>,
          a: ({ href, children }) => (
            <a href={href} className="text-chilli underline-offset-2 hover:underline">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
