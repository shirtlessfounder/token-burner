import type { PresetId } from "./domain.js";

export type BurnPreset = {
  id: PresetId;
  label: string;
  targetTokens: number;
  blurb: string;
};

export const burnPresets: readonly BurnPreset[] = [
  {
    id: "tier-1",
    label: "Amuse-Bouche",
    targetTokens: 25_000,
    blurb: "a modest gesture. just enough to show up on the board.",
  },
  {
    id: "tier-2",
    label: "Statement Piece",
    targetTokens: 250_000,
    blurb: "midweek indulgence. burning casually, in public.",
  },
  {
    id: "tier-3",
    label: "Couture Run",
    targetTokens: 2_500_000,
    blurb: "committed waste. the kind other burners will talk about.",
  },
] as const;

const presetsById: Record<PresetId, BurnPreset> = burnPresets.reduce(
  (map, preset) => {
    map[preset.id] = preset;
    return map;
  },
  {} as Record<PresetId, BurnPreset>,
);

export const getBurnPreset = (id: PresetId): BurnPreset => presetsById[id];
