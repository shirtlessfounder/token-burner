import { describe, expect, it } from "vitest";

import { parseTokenTarget } from "../../packages/agent-cli/src/commands/burn";
import { CliArgsError } from "../../packages/agent-cli/src/args";

describe("parseTokenTarget", () => {
  it("parses plain integers", () => {
    expect(parseTokenTarget("5000")).toBe(5_000);
    expect(parseTokenTarget("250000")).toBe(250_000);
    expect(parseTokenTarget("1")).toBe(1);
  });

  it("parses k/m/b suffix shorthand", () => {
    expect(parseTokenTarget("5k")).toBe(5_000);
    expect(parseTokenTarget("250k")).toBe(250_000);
    expect(parseTokenTarget("2.5m")).toBe(2_500_000);
    expect(parseTokenTarget("1m")).toBe(1_000_000);
    expect(parseTokenTarget("1b")).toBe(1_000_000_000);
  });

  it("is case-insensitive and tolerates underscores or commas", () => {
    expect(parseTokenTarget("5K")).toBe(5_000);
    expect(parseTokenTarget("2.5M")).toBe(2_500_000);
    expect(parseTokenTarget("250_000")).toBe(250_000);
    expect(parseTokenTarget("1,000,000")).toBe(1_000_000);
  });

  it("rejects zero, negatives, fractions of plain integers, and garbage", () => {
    expect(() => parseTokenTarget("0")).toThrow(CliArgsError);
    expect(() => parseTokenTarget("-5")).toThrow(CliArgsError);
    expect(() => parseTokenTarget("5.5")).toThrow(CliArgsError);
    expect(() => parseTokenTarget("nope")).toThrow(CliArgsError);
    expect(() => parseTokenTarget("0k")).toThrow(CliArgsError);
    expect(() => parseTokenTarget("5x")).toThrow(CliArgsError);
  });
});
