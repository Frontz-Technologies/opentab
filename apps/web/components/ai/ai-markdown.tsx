"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AiMarkdownProps = {
  content: string;
};

export function AiMarkdown({ content }: AiMarkdownProps) {
  return (
    <div className="prose prose-invert prose-p:my-0 prose-pre:my-3 prose-code:text-[0.85em] max-w-none text-sm text-on-surface">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
