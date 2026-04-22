"use client";

import { useState } from "react";

import { parseClaimCodeResponse } from "@token-burner/shared";

type ClaimCodeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; code: string; expiresAt: string };

export function ClaimCodePanel(): React.JSX.Element {
  const [state, setState] = useState<ClaimCodeState>({ status: "idle" });

  const requestCode = async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/claim-codes", { method: "POST" });
      if (!response.ok) {
        setState({
          status: "error",
          message: `claim-code mint failed (${response.status})`,
        });
        return;
      }
      const parsed = parseClaimCodeResponse(await response.json());
      setState({
        status: "ready",
        code: parsed.code,
        expiresAt: parsed.expiresAt,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "unknown error minting code",
      });
    }
  };

  if (state.status === "ready") {
    const expires = new Date(state.expiresAt);
    return (
      <div className="flex flex-col gap-3">
        <div className="border-2 border-ember bg-char px-5 py-4">
          <p className="mono text-[0.6rem] uppercase tracking-[0.3em] text-bone">
            one-time code · expires {expires.toLocaleTimeString()}
          </p>
          <p className="display mt-1 text-4xl font-black tracking-[0.2em] text-ember sm:text-5xl">
            {state.code}
          </p>
        </div>
        <button
          type="button"
          className="self-start text-[0.65rem] uppercase tracking-[0.3em] text-bone hover:text-ivory"
          onClick={requestCode}
        >
          ↻ mint another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={requestCode}
        disabled={state.status === "loading"}
        className="display self-start border-2 border-ember bg-ember px-6 py-3 text-sm font-black uppercase tracking-[0.25em] text-ink hover:bg-molten hover:border-molten disabled:opacity-50"
      >
        {state.status === "loading" ? "minting…" : "mint claim code"}
      </button>
      {state.status === "error" ? (
        <p className="mono text-xs text-molten">{state.message}</p>
      ) : null}
    </div>
  );
}
