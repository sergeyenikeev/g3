import type { RunUpgradeDef } from "../../data/types";
import type { Locale } from "../../i18n/localization";
import { getUpgradeTagLabel } from "../../i18n/localization";

export type UpgradeBadgeSpec = {
  key: string;
  label: string;
  fill: number;
  stroke: number;
  textColor: string;
};

type BadgeTheme = Omit<UpgradeBadgeSpec, "key" | "label">;

const BADGE_THEMES: Record<string, BadgeTheme> = {
  core: { fill: 0x143345, stroke: 0x5cc8ff, textColor: "#d9f2ff" },
  collection: { fill: 0x3b2d10, stroke: 0xffd166, textColor: "#fff1c2" },
  utility: { fill: 0x1f2b3a, stroke: 0x7fdfff, textColor: "#d9f2ff" },
  economy: { fill: 0x173123, stroke: 0x6cff9b, textColor: "#dfffe8" },
  flip: { fill: 0x132736, stroke: 0x4ddcff, textColor: "#d9f2ff" },
  combat: { fill: 0x39161d, stroke: 0xff7f87, textColor: "#ffe4e7" },
  tail: { fill: 0x362818, stroke: 0xffb86b, textColor: "#fff0d7" },
  survival: { fill: 0x1c3227, stroke: 0x57c27d, textColor: "#e5fff0" },
  mobility: { fill: 0x18283b, stroke: 0x7aa7ff, textColor: "#e8f0ff" },
  risk_reward: { fill: 0x3b2411, stroke: 0xffa14d, textColor: "#fff0dd" },
  dash: { fill: 0x153033, stroke: 0x5cf0d6, textColor: "#dbfffa" },
  ram: { fill: 0x3f1717, stroke: 0xff6f61, textColor: "#ffe8e5" },
  wake: { fill: 0x3b3014, stroke: 0xffd166, textColor: "#fff4d8" },
  ion: { fill: 0x2f1b4a, stroke: 0xd66dff, textColor: "#f7e5ff" },
  siphon: { fill: 0x1f3b19, stroke: 0xa6f05d, textColor: "#efffdc" },
  frame: { fill: 0x24303b, stroke: 0x9ec6d8, textColor: "#eef7ff" },
  recycler: { fill: 0x183321, stroke: 0x8cf07a, textColor: "#eeffe8" },
};

const BRANCH_BADGES_BY_UPGRADE_ID: Record<string, string[]> = {
  dash_module: ["dash"],
  ram_plating: ["ram"],
  magnet_wake: ["wake"],
  ion_ram: ["ion"],
  salvage_siphon: ["siphon"],
};

const META_BADGES_BY_NODE_ID: Record<string, string[]> = {
  meta_core_1: ["core", "collection"],
  meta_core_2: ["core", "collection"],
  meta_coil_1: ["flip", "combat"],
  meta_coil_2: ["flip", "combat"],
  meta_frame_1: ["frame", "survival"],
  meta_frame_2: ["frame", "survival"],
  meta_tail_1: ["tail", "mobility"],
  meta_tail_2: ["tail", "mobility"],
  meta_dash_unlock: ["dash", "mobility"],
  meta_dash_caps: ["dash", "mobility"],
  meta_salvage_routes: ["economy", "collection"],
  meta_flux_rig: ["flip", "combat"],
  meta_recycler_overdrive: ["recycler", "economy"],
  meta_recycler_lattice: ["recycler", "economy"],
};

type DashPerks = Partial<Record<"dash_module" | "dash_ram" | "dash_wake" | "dash_arc" | "dash_siphon", unknown>>;

export function getUpgradeBadgeSpecs(locale: Locale, upgrade: Pick<RunUpgradeDef, "id" | "tags">, limit = 3): UpgradeBadgeSpec[] {
  const keys = uniqueTagKeys([...(BRANCH_BADGES_BY_UPGRADE_ID[upgrade.id] ?? []), ...(upgrade.tags ?? [])]).slice(0, limit);
  return keys.map((key) => makeBadge(locale, key));
}

export function getDashHudBadgeSpecs(locale: Locale, perks: DashPerks | null | undefined, limit = 2): UpgradeBadgeSpec[] {
  const keys: string[] = [];
  if (perks?.dash_arc) keys.push("ion");
  else if (perks?.dash_ram) keys.push("ram");

  if (perks?.dash_siphon) keys.push("siphon");
  else if (perks?.dash_wake) keys.push("wake");

  if (keys.length === 0 && perks?.dash_module) keys.push("dash");
  return uniqueTagKeys(keys).slice(0, limit).map((key) => makeBadge(locale, key));
}

export function getMetaNodeBadgeSpecs(locale: Locale, nodeId: string, limit = 2): UpgradeBadgeSpec[] {
  return uniqueTagKeys(META_BADGES_BY_NODE_ID[nodeId] ?? []).slice(0, limit).map((key) => makeBadge(locale, key));
}

function makeBadge(locale: Locale, key: string): UpgradeBadgeSpec {
  const theme: BadgeTheme = BADGE_THEMES[key] ?? BADGE_THEMES.utility!;
  return {
    key,
    label: getUpgradeTagLabel(locale, key),
    fill: theme.fill,
    stroke: theme.stroke,
    textColor: theme.textColor,
  };
}

function uniqueTagKeys(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of keys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered;
}
