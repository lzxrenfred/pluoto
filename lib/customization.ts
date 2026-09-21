import type { Accessory, DecorationPreset, Ground, HouseColor, Outfit, Person, Species } from "./types";

export const SPECIES: Species[] = ["fox", "rabbit", "bear", "cat", "penguin", "turtle", "dog"];
export const BODY_COLORS = ["#e8794d", "#d9a16f", "#f1d0b5", "#8aae87", "#6d86a9", "#ba7a92", "#65534d"];
export const OUTFITS: Outfit[] = ["none", "tee"];
export const ACCESSORIES: Accessory[] = ["none", "glasses", "headphones", "cap", "tote", "scarf"];
export const GROUNDS: Ground[] = ["grass", "sand", "stone", "earth"];
export const HOMES: Person["home"][] = ["cottage", "studio", "cabin"];
export const HOUSE_COLORS: HouseColor[] = ["coral", "sage", "blue", "honey"];
export const DECORATION_PRESETS: DecorationPreset[] = ["garden", "calm", "social"];

export const presetScene: Record<DecorationPreset, Person["scene"]> = {
  garden: "ren",
  calm: "sarah",
  social: "maya",
};

export function normalizedPerson(person: Person): Person {
  return {
    ...person,
    outfit: person.outfit ?? "none",
    houseColor: person.houseColor ?? (person.home === "cabin" ? "sage" : "coral"),
    decorationPreset: person.decorationPreset ?? "garden",
  };
}

export function applyDecorationPreset(person: Person, preset: DecorationPreset): Person {
  return { ...person, decorationPreset: preset, scene: presetScene[preset] };
}
