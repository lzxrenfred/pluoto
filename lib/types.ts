import type { PlotPosition } from "./world";

export type Species = "fox" | "rabbit" | "bear" | "cat" | "penguin" | "turtle" | "dog";
export type Ground = "grass" | "sand" | "stone" | "earth";
export type Accessory = "none" | "glasses" | "headphones" | "cap" | "scarf" | "tote";

export type Person = PlotPosition & {
  id: string;
  nickname: string;
  species: Species;
  color: string;
  accent: string;
  accessory: Accessory;
  ground: Ground;
  home: "cottage" | "studio" | "cabin" | "tent" | "kiosk";
  pills: string[];
  bubble?: string;
  bubbleCreatedAt?: number;
  owner?: boolean;
  scene: "ren" | "sarah" | "maya" | "wei" | "james" | "kai" | "new";
};

export type BubbleEntry = { id: string; text: string; createdAt: number; expiredAt?: number };

export type AppState = {
  people: Person[];
  bubbleLog: BubbleEntry[];
  blocked: string[];
  completedOnboarding: boolean;
};
