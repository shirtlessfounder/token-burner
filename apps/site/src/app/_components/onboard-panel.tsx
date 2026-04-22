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
  [
    `1. fetch ${appUrl}/skill.md and follow that spec.`,
    `2. ask me what public handle and single-emoji avatar i want — do not pick for me.`,
    `3. run: npx token-burner register --claim-code ${code} --handle <name> --avatar <emoji> --agent-label <label>`,
    `4. the cli writes ~/.config/token-burner/config.json for you. do not hand-roll http against endpoints from the bundle.`,
    `5. ask me which tier i want to burn — tier-1 (25k billed tokens), tier-2 (250k), or tier-3 (2.5m) — and which provider (openai | anthropic). then run: npx token-burner burn --provider <provider> --preset <tier>`,
  ].join("\n");

const buildReturningPrompt = (appUrl: string): string =>
  [
    `1. fetch ${appUrl}/skill.md and follow that spec.`,
    `2. run: npx token-burner link --agent-label <label>`,
    `3. if ~/.config/token-burner/config.json is missing, ask me to paste the owner token and pass it with --owner-token.`,
    `4. do not hand-roll http against endpoints from the bundle.`,
    `5. ask me which tier i want to burn — tier-1 (25k billed tokens), tier-2 (250k), or tier-3 (2.5m) — and which provider (openai | anthropic). then run: npx token-burner burn --provider <provider> --preset <tier>`,
  ].join("\n");

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

  return (
    <section className="border-2 border-ivory">
      <div className="border-b-2 border-ivory bg-ember px-6 py-3 text-ink">
        <h2 className="display text-2xl font-black uppercase tracking-tight sm:text-3xl">
          onboard a burner
        </h2>
      </div>

      <div className="flex border-b-2 border-ivory">
        <button
          type="button"
          onClick={() => setMode("new")}
          aria-pressed={mode === "new"}
          className={`mono flex-1 border-r-2 border-ivory px-4 py-3 text-[0.7rem] uppercase tracking-[0.3em] ${
            mode === "new"
              ? "bg-ember text-ink"
              : "bg-char text-bone hover:bg-smoke hover:text-ivory"
          }`}
        >
          new burner
        </button>
        <button
          type="button"
          onClick={() => setMode("returning")}
          aria-pressed={mode === "returning"}
          className={`mono flex-1 px-4 py-3 text-[0.7rem] uppercase tracking-[0.3em] ${
            mode === "returning"
              ? "bg-ember text-ink"
              : "bg-char text-bone hover:bg-smoke hover:text-ivory"
          }`}
        >
          returning
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 p-6">
        {mode === "new" && claim.status !== "ready" ? (
          <div className="flex w-full max-w-2xl flex-col items-center gap-3">
            <p className="mono text-center text-[0.65rem] uppercase tracking-[0.3em] text-bone">
              mint a one-time code, then paste the prompt into your cli agent
            </p>
            <button
              type="button"
              onClick={requestCode}
              disabled={claim.status === "loading"}
              className="display border-2 border-ember bg-ember px-6 py-3 text-sm font-black uppercase tracking-[0.25em] text-ink hover:bg-molten hover:border-molten disabled:opacity-50"
            >
              {claim.status === "loading" ? "minting…" : "mint claim code"}
            </button>
            {claim.status === "error" ? (
              <p className="mono text-xs text-molten">{claim.message}</p>
            ) : null}
          </div>
        ) : null}

        {mode === "new" && claim.status === "ready" ? (
          <div className="w-full max-w-2xl border-2 border-ember bg-char px-5 py-4 text-center">
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
          <div className="relative w-full max-w-2xl">
            <pre className="mono whitespace-pre-wrap break-words border-2 border-smoke bg-char p-4 pr-14 text-xs leading-relaxed text-ivory">
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
            className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone hover:text-ivory"
            onClick={requestCode}
          >
            ↻ mint another
          </button>
        ) : null}

        <p className="mono w-full max-w-2xl text-center text-[0.6rem] uppercase tracking-[0.25em] text-bone">
          {mode === "new"
            ? "agent reads the bootstrap skill, hits /api/agent/register, writes ~/.config/token-burner/config.json. provider keys stay local."
            : "agent reads the saved owner token, calls /api/agent/link, updates the same config file with this installation."}
        </p>
      </div>
    </section>
  );
}
