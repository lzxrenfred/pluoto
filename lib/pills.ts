import { PILL_GROUPS } from "./demo";

export type PillCategory = keyof typeof PILL_GROUPS;
export function pillCategory(pill: string): PillCategory | "Other" {
  return (Object.entries(PILL_GROUPS).find(([, items]) => (items as readonly string[]).includes(pill))?.[0] as PillCategory | undefined) ?? "Other";
}
export function pillCategoryClass(pill: string) {
  return `pill-${pillCategory(pill).toLowerCase().replaceAll(" ", "-")}`;
}
