import type { SaveData } from "../../platform/save/saveManager";
import type { LanguageSetting } from "../../i18n/localization";

const VOLUME_STEPS = [0, 0.3, 0.6, 0.8, 1] as const;

export function snapVolumeStep(value: number): number {
  let best: number = VOLUME_STEPS[0];
  let bestDiff = Math.abs(value - best);
  for (const step of VOLUME_STEPS) {
    const diff = Math.abs(value - step);
    if (diff < bestDiff) {
      best = step;
      bestDiff = diff;
    }
  }
  return best;
}

export function nextVolumeStep(current: number): number {
  const idx = VOLUME_STEPS.indexOf(snapVolumeStep(current) as (typeof VOLUME_STEPS)[number]);
  return VOLUME_STEPS[(idx + 1) % VOLUME_STEPS.length] ?? VOLUME_STEPS[0];
}

export function qualityStroke(quality: SaveData["settings"]["visualQuality"]): number {
  if (quality === "low") return 0x6e7a86;
  if (quality === "medium") return 0x2d7bff;
  if (quality === "high") return 0x3af2ff;
  return 0x3aa4d4;
}

export function languageStroke(setting: LanguageSetting): number {
  if (setting === "ru") return 0x57c27d;
  if (setting === "en") return 0x5cc8ff;
  return 0xffd166;
}
