"use client";

import { useState } from "react";

export function CliPromptPanel({ prompt }: { prompt: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative">
      <pre className="mono whitespace-pre-wrap break-words border-2 border-smoke bg-char p-4 pr-20 text-xs leading-relaxed text-ivory">
        {prompt}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "copied" : "copy prompt"}
        className="mono absolute top-2 right-2 border-2 border-smoke bg-char px-2 py-1 text-[0.55rem] uppercase tracking-[0.25em] text-bone hover:border-ember hover:text-ember"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
