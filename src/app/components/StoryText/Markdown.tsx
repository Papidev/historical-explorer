import ReactMarkdown from "react-markdown";

export const Markdown = ({ text }: { text: string }) => (
  <div className="space-y-4">
    <ReactMarkdown
      allowedElements={[
        "p",
        "strong",
        "em",
        "a",
        "ul",
        "ol",
        "li",
        "blockquote",
        "br",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ]}
      unwrapDisallowed
      components={{
        strong: ({ children }) => (
          <strong className="font-semibold text-amber-900">{children}</strong>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="cursor-pointer text-sky-800 underline decoration-sky-300 underline-offset-4 hover:text-sky-950"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>,
        li: ({ children }) => <li className="space-y-2 pl-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="space-y-4 border-l-2 border-amber-300 pl-4 italic">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => <h4 className="text-lg font-semibold text-zinc-950">{children}</h4>,
        h2: ({ children }) => <h4 className="text-lg font-semibold text-zinc-950">{children}</h4>,
        h3: ({ children }) => <h4 className="font-semibold text-zinc-950">{children}</h4>,
        h4: ({ children }) => <h4 className="font-semibold text-zinc-950">{children}</h4>,
        h5: ({ children }) => <h5 className="font-semibold text-zinc-950">{children}</h5>,
        h6: ({ children }) => <h6 className="font-semibold text-zinc-950">{children}</h6>,
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
);
