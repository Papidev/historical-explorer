import ReactMarkdown from "react-markdown";

export const Markdown = ({ text }: { text: string }) => (
  <div className="prose prose-zinc prose-headings:font-serif prose-headings:tracking-tight prose-a:cursor-pointer prose-a:text-sky-800 prose-a:decoration-sky-300 prose-a:underline-offset-4 prose-a:hover:text-sky-950 prose-strong:font-semibold prose-strong:text-amber-900 prose-blockquote:border-amber-300 max-w-none text-base/7 text-zinc-800">
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
