"use client";

import { useState } from "react";

import { parseClaimCodeResponse } from "@token-burner/shared";

type Mode = "new" | "returning";

type ClaimState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; code: string; expiresAt: string };

const buildSignupPrompt = (appUrl: string, code: string): string =>
  `read ${appUrl}/skill.md then register me on token-burner with claim code ${code}. ask me what public handle and single-emoji avatar i want — do not pick for me. store the reusable owner token locally.`;

const buildReturningPrompt = (appUrl: string): string =>
  `read ${appUrl}/skill.md then link this installation to my existing token-burner identity. use the owner token saved at ~/.config/token-burner/config.json if present; if it is missing, ask me to paste it.`;

export function OnboardPanel({ appUrl }: { appUrl: string }): React.JSX.Element {
  const [mode, setMode] = useState<Mode>("new");
  const [claim, setClaim] = useState<ClaimState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const requestCode = async () => {
    setClaim({ status: "loading" });
    try {
      const response = await fetch("/api/claim-codes", { method: "POST" });
      if (!response.ok) {
        setClaim({
          status: "error",
          message: `claim-code mint failed (${response.status})`,
        });
        return;
      }
      const parsed = parseClaimCodeResponse(await response.json());
      setClaim({
        status: "ready",
        code: parsed.code,
        expiresAt: parsed.expiresAt,
      });
    } catch (error) {
      setClaim({
        status: "error",
        message:
          error instanceof Error ? error.message : "unknown error minting code",
      });
    }
  };

  const prompt =
    mode === "returning"
      ? buildReturningPrompt(appUrl)
      : claim.status === "ready"
        ? buildSignupPrompt(appUrl, claim.code)
        : null;

  const handleCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const toggleLabel = mode === "new" ? "returning?" : "new burner?";
  const toggleMode = () =>
    setMode((current) => (current === "new" ? "returning" : "new"));

  return (
    <section className="border-2 border-ivory">
      <div className="flex items-end justify-between gap-4 border-b-2 border-ivory bg-ember px-6 py-3 text-ink">
        <h2 className="display text-2xl font-black uppercase tracking-tight sm:text-3xl">
          onboard a burner
        </h2>
        <button
          type="button"
          onClick={toggleMode}
          className="mono text-[0.65rem] uppercase tracking-[0.3em] hover:underline"
        >
          {toggleLabel}
        </button>
      </div>
      <div className="flex flex-col gap-4 p-6">
        {mode === "new" && claim.status !== "ready" ? (
          <div className="flex flex-col gap-3">
            <p className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone">
              step · mint a one-time code, then copy the prompt into your cli agent
            </p>
            <button
              type="button"
              onClick={requestCode}
              disabled={claim.status === "loading"}
              className="display self-start border-2 border-ember bg-ember px-6 py-3 text-sm font-black uppercase tracking-[0.25em] text-ink hover:bg-molten hover:border-molten disabled:opacity-50"
            >
              {claim.status === "loading" ? "minting…" : "mint claim code"}
            </button>
            {claim.status === "error" ? (
              <p className="mono text-xs text-molten">{claim.message}</p>
            ) : null}
          </div>
        ) : null}

        {mode === "new" && claim.status === "ready" ? (
          <div className="border-2 border-ember bg-char px-5 py-4">
            <p className="mono text-[0.6rem] uppercase tracking-[0.3em] text-bone">
              one-time code · expires{" "}
              {new Date(claim.expiresAt).toLocaleTimeString()}
            </p>
            <p className="display mt-1 text-4xl font-black tracking-[0.2em] text-ember sm:text-5xl">
              {claim.code}
            </p>
          </div>
        ) : null}

        {prompt ? (
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
        ) : null}

        {mode === "new" && claim.status === "ready" ? (
          <button
            type="button"
            className="mono self-start text-[0.65rem] uppercase tracking-[0.3em] text-bone hover:text-ivory"
            onClick={requestCode}
          >
            ↻ mint another
          </button>
        ) : null}

        <p className="mono text-[0.6rem] uppercase tracking-[0.25em] text-bone">
          {mode === "new"
            ? "agent fetches the bootstrap doc, hits /api/agent/register, saves the reusable owner token to your machine. provider keys stay local."
            : "agent reads the saved owner token and calls /api/agent/link to attach this installation. same identity, new machine."}
        </p>
      </div>
    </section>
  );
}
