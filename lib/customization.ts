import type { Accessory, DecorationPreset, Ground, HouseColor, Outfit, Person, Species } from "./types";
import { landObjectsForPerson, signCellForPerson } from "./land-objects";

export const SPECIES: Species[] = ["fox", "rabbit", "bear", "cat", "penguin", "turtle", "dog", "deer", "koala"];
export const BODY_COLORS = ["#e8794d", "#d9a16f", "#f1d0b5", "#8aae87", "#6d86a9", "#ba7a92", "#65534d", "#f4e7d3", "#343d43", "#c7a45f"];
export const OUTFITS: Outfit[] = ["none", "tee", "striped", "sunny"];
export const ACCESSORIES: Exclude<Accessory,"none">[] = ["glasses", "headphones", "cap", "tote", "scarf", "bow", "flower"];
export const HEADWEAR: Exclude<Accessory,"none">[] = ["headphones", "cap", "bow", "flower"];
export const OTHER_ACCESSORIES: Exclude<Accessory,"none">[] = ["glasses", "scarf", "tote"];
export const ACCESSORY_COLORS = ["#dc745e", "#5f789c", "#e9bc5b", "#78a962", "#ba7a92", "#4e493f"];
export const GROUNDS: Ground[] = ["grass", "sand", "stone", "earth", "meadow", "clay"];
export const HOMES: Person["home"][] = ["cottage", "studio", "cabin", "tent", "kiosk"];
export const HOUSE_COLORS: HouseColor[] = ["coral", "sage", "blue", "honey", "rose", "mint"];
export const DECORATION_PRESETS: DecorationPreset[] = ["garden", "calm", "social", "bare"];

export const presetScene: Record<DecorationPreset, Person["scene"]> = {
  garden: "ren",
  calm: "sarah",
  social: "maya",
  bare: "new",
  custom: "new",
};

export function selectedAccessories(person: Pick<Person,"accessory"|"accessories">) {
  const selected=person.accessories??(person.accessory!=="none"?[person.accessory]:[]);
  const headwear=selected.find(item=>HEADWEAR.includes(item));
  return selected.filter((item,index)=>selected.indexOf(item)===index&&(!HEADWEAR.includes(item)||item===headwear));
}

export function accessoryColorFor(person: Pick<Person,"accessoryColor"|"accessoryColors">, item: Exclude<Accessory,"none">) {
  return person.accessoryColors?.[item]??person.accessoryColor??(item==="glasses"?"#4e493f":"#dc745e");
}

export function normalizedPerson(person: Person): Person {
  return {
    ...person,
    outfit: person.outfit ?? "none",
    accessories: selectedAccessories(person),
    accessoryColor: person.accessoryColor ?? "#dc745e",
    accessoryColors: person.accessoryColors ?? {},
    houseColor: person.houseColor ?? (person.home === "cabin" ? "sage" : "coral"),
    decorationPreset: person.decorationPreset ?? "garden",
  };
}

export function applyDecorationPreset(person: Person, preset: DecorationPreset): Person {
  if (preset === "custom") {
    const saved = person.savedCustomLand;
    const objects = saved?.objects ?? landObjectsForPerson(person);
    return {
      ...person,
      decorationPreset: "custom",
      scene: saved?.scene ?? person.scene,
      landObjects: objects.map(object => object.modelId.startsWith("house.") ? { ...object, modelId: `house.${person.home}` as typeof object.modelId } : { ...object }),
      signPosition: saved?.signPosition ?? signCellForPerson(person),
      signPositionVersion: 2,
    };
  }
  const savedCustomLand = person.decorationPreset === "custom"
    ? { objects: landObjectsForPerson(person), signPosition: signCellForPerson(person), scene: person.scene }
    : person.savedCustomLand;
  return { ...person, savedCustomLand, decorationPreset: preset, scene: presetScene[preset], landObjects: preset === "bare" ? [] : undefined, signPosition: undefined };
}
