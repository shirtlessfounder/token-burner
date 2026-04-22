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
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-3xl tracking-widest text-zinc-900 dark:text-zinc-100">
            {state.code}
          </span>
          <span className="text-xs text-zinc-500">
            expires {expires.toLocaleTimeString()}
          </span>
        </div>
        <button
          type="button"
          className="self-start text-xs uppercase tracking-widest text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-200"
          onClick={requestCode}
        >
          mint another
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
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {state.status === "loading" ? "minting…" : "mint claim code"}
      </button>
      {state.status === "error" ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
