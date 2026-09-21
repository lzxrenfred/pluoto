import type { PlotPosition } from "./world";

export type Species = "fox" | "rabbit" | "bear" | "cat" | "penguin" | "turtle" | "dog";
export type Ground = "grass" | "sand" | "stone" | "earth";
export type Accessory = "none" | "glasses" | "headphones" | "cap" | "scarf" | "tote";
export type Outfit = "none" | "tee";
export type HouseColor = "coral" | "sage" | "blue" | "honey";
export type DecorationPreset = "garden" | "calm" | "social";

export type Person = PlotPosition & {
  id: string;
  nickname: string;
  species: Species;
  color: string;
  accent: string;
  accessory: Accessory;
  outfit?: Outfit;
  ground: Ground;
  home: "cottage" | "studio" | "cabin" | "tent" | "kiosk";
  houseColor?: HouseColor;
  decorationPreset?: DecorationPreset;
  pills: string[];
  bubble?: string;
  bubbleCreatedAt?: number;
  owner?: boolean;
  scene: "ren" | "sarah" | "maya" | "wei" | "james" | "kai" | "new";
};

export type BubbleEntry = { id: string; text: string; createdAt: number; expiredAt?: number };
export type GuestIdentity = { id: string; nickname: string; species: Species; color: string; joinedAt: number };

export type AppState = {
  people: Person[];
  guests: GuestIdentity[];
  bubbleLog: BubbleEntry[];
  blocked: string[];
  completedOnboarding: boolean;
  requiresOnboarding?: boolean;
  accountRequired?: boolean;
};
