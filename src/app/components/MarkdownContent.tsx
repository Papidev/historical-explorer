import ReactMarkdown from "react-markdown";

type Props = {
  content: string;
  className?: string;
};

export const MarkdownContent = ({ content, className = "" }: Props) => (
  <div className={`poi-dialog-content ${className}`}>
    <ReactMarkdown>{content}</ReactMarkdown>
  </div>
);
