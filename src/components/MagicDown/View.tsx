import dynamic from "next/dynamic";
import { useMemo, memo } from "react";
import ReactMarkdown, { type Options, type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { clsx } from "clsx";
import { omit } from "radash";

import "katex/dist/katex.min.css";
import "./style.css";

const Code = dynamic(() => import("./Code"));
const Mermaid = dynamic(() => import("./Mermaid"));

// Strip XML-like tags that LLMs sometimes echo back from prompt templates.
// These are not valid HTML elements and cause React DOM warnings when passed
// through rehype-raw.
// Tag names are sourced from src/constants/prompts.ts and
// src/utils/deep-research/prompts.ts — update both when adding new tags.
const PROMPT_XML_TAG_RE =
  /<\/?(query|plan|context|research_goal|learnings|learning|sources|images|requirement|suggestion|outputguidelines|guidelines)(\s[^>]*)?\s*>/gi;

function stripPromptXmlTags(content: string): string {
  return content.replace(PROMPT_XML_TAG_RE, "");
}

export type MarkdownProps = {
  id?: string;
  className?: string;
  children: string;
  components?: Partial<Components>;
};

function MarkdownBlock({ children: content, ...rest }: Options) {
  const remarkPlugins = useMemo(
    () => rest.remarkPlugins ?? [],
    [rest.remarkPlugins]
  );
  const rehypePlugins = useMemo(
    () => rest.rehypePlugins ?? [],
    [rest.rehypePlugins]
  );
  const components = useMemo(() => rest.components ?? {}, [rest.components]);
  const sanitizedContent = useMemo(
    () => (typeof content === "string" ? stripPromptXmlTags(content) : content),
    [content]
  );

  return (
    <ReactMarkdown
      {...rest}
      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks, ...remarkPlugins]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeHighlight, { detect: true, ignoreMissing: true }],
        rehypeKatex,
        ...rehypePlugins,
      ]}
      disallowedElements={["script", "form"]}
      components={{
        pre: (props) => {
          const { children, className, ...rest } = props;
          return (
            <pre
              {...omit(rest, ["node"])}
              className={clsx("my-4 not-prose", className)}
            >
              {children}
            </pre>
          );
        },
        code: (props) => {
          const { children, className, ...rest } = props;
          const isInline =
            !props.node?.position?.start.line ||
            props.node?.position?.start.line === props.node?.position?.end.line;

          if (isInline) {
            return (
              <span
                className={clsx(
                  "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
                  className
                )}
                {...props}
              >
                {children}
              </span>
            );
          }

          if (className?.includes("hljs")) {
            const lang = /language-(\w+)/.exec(className || "");
            if (lang && lang[1] === "mermaid") {
              return <Mermaid>{children}</Mermaid>;
            }
            return (
              <Code lang={lang ? lang[1] : "plaintext"}>
                <code
                  {...omit(rest, ["node"])}
                  className={clsx("break-all", className)}
                >
                  {children}
                </code>
              </Code>
            );
          } else {
            return (
              <code
                {...omit(rest, ["node"])}
                className={clsx("break-all", className)}
              >
                {children}
              </code>
            );
          }
        },
        a: (props) => {
          const { children, className, href = "", target, ...rest } = props;
          if (/\.(aac|mp3|opus|wav)$/.test(href)) {
            return (
              <figure>
                <audio controls src={href}></audio>
              </figure>
            );
          }
          if (/\.(3gp|3g2|webm|ogv|mpeg|mp4|avi)$/.test(href)) {
            return (
              <video controls width="99.9%">
                <source src={href} />
              </video>
            );
          }
          const isInternal = /^\/#/i.test(href);
          const isReferenceLink = /^[0-9]*$/.test(children?.toString() || "");
          return (
            <a
              {...omit(rest, ["node"])}
              className={clsx("break-all", className, {
                reference: isReferenceLink,
              })}
              href={href}
              target={isInternal ? "_self" : target ?? "_blank"}
            >
              {children}
            </a>
          );
        },
        img: (props) => {
          const { className, src, alt, ...rest } = props;
          return (
            <picture
              className={clsx(
                "my-2 flex justify-center items-center w-4/5 max-sm:w-full h-[50vw] max-sm:h-80 m-auto",
                className
              )}
            >
              <img
                className="size-full object-cover rounded transition-all duration-200 ease-out"
                {...omit(rest, ["node"])}
                src={src}
                alt={alt}
                title={alt}
                referrerPolicy="no-referrer"
              />
            </picture>
          );
        },
        ...components,
      }}
    >
      {sanitizedContent}
    </ReactMarkdown>
  );
}

export default memo(MarkdownBlock);
