import ReactMarkdown from "react-markdown";

type Props = {
  content: string;
  className?: string;
};

export const MarkdownContent = ({ content, className = "" }: Props) => (
  <div className={`poi-dialog-content text-base leading-[1.7] text-zinc-800 ${className}`}>
    <ReactMarkdown>{content}</ReactMarkdown>
  </div>
);
