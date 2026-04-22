import { describe, expect, it } from "vitest";

import {
  burnPresets,
  getBurnPreset,
  presetIdSchema,
  presetIdValues,
} from "@token-burner/shared";

describe("burn presets", () => {
  it("exposes one entry per preset id with a strictly increasing target", () => {
    expect(burnPresets.map((preset) => preset.id)).toEqual([...presetIdValues]);

    const targets = burnPresets.map((preset) => preset.targetTokens);
    for (let index = 1; index < targets.length; index += 1) {
      expect(targets[index]).toBeGreaterThan(targets[index - 1]);
    }
  });

  it("getBurnPreset returns the expected preset", () => {
    for (const id of presetIdValues) {
      const preset = getBurnPreset(id);
      expect(preset.id).toBe(id);
      expect(preset.targetTokens).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it("preset ids pass the shared zod schema", () => {
    for (const id of presetIdValues) {
      expect(() => presetIdSchema.parse(id)).not.toThrow();
    }
    expect(() => presetIdSchema.parse("tier-7")).toThrow();
  });
});
