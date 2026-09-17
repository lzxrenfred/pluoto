import type { AppState, Person } from "./types";

export const DEMO_PEOPLE: Person[] = [
  {
    id: "ren", nickname: "Ren", species: "fox", color: "#e8794d", accent: "#fff2df", accessory: "scarf",
    plotX: 0, plotY: 0, ground: "grass", home: "cottage", owner: true, scene: "ren",
    pills: ["curious", "founder", "volleyball", "deep talks", "house"],
  },
  {
    id: "sarah", nickname: "Sarah", species: "rabbit", color: "#f7eee5", accent: "#f0a3a3", accessory: "tote",
    plotX: 1, plotY: 0, ground: "stone", home: "studio", scene: "sarah", bubble: "coffee later?",
    bubbleCreatedAt: Date.now(), pills: ["quiet at first", "coffee", "film", "spontaneous plans"],
  },
  {
    id: "maya", nickname: "Maya", species: "cat", color: "#d9a16f", accent: "#fff5df", accessory: "glasses",
    plotX: 0, plotY: 1, ground: "grass", home: "cottage", scene: "maya",
    pills: ["photography", "travel", "R&B", "creative"],
  },
  {
    id: "wei", nickname: "Wei", species: "turtle", color: "#79a875", accent: "#dde7b8", accessory: "headphones",
    plotX: 1, plotY: 1, ground: "earth", home: "kiosk", scene: "wei", bubble: "coding…",
    bubbleCreatedAt: Date.now(), pills: ["developer", "gaming", "introvert", "startups"],
  },
];

export const INITIAL_STATE: AppState = {
  people: DEMO_PEOPLE,
  guests: [],
  bubbleLog: [],
  blocked: [],
  completedOnboarding: false,
};

export const PILL_GROUPS = {
  Personality: ["introvert", "extrovert", "ambivert", "quiet at first", "curious", "spontaneous", "easygoing", "thoughtful", "optimistic", "independent", "warm", "playful", "observant", "adventurous", "homebody", "night owl", "old soul", "big dreamer"],
  Interests: ["coffee", "travel", "gym", "volleyball", "gaming", "film", "photography", "books", "design", "art", "cooking", "running", "hiking", "fashion", "tech", "football", "music", "board games", "dance", "architecture", "cafes", "animals"],
  Music: ["R&B", "house", "K-pop", "indie", "pop", "hip-hop", "jazz", "lo-fi", "techno", "soul", "rock", "classical", "afrobeats", "city pop", "folk", "disco"],
  Life: ["student", "founder", "developer", "designer", "creative", "freelancer", "researcher", "marketer", "traveller", "builder", "community host", "dreamer", "still figuring it out", "new in town", "remote worker", "career switcher"],
  "Talk to me about": ["startups", "deep talks", "good food", "new ideas", "relationships", "side projects", "travel stories", "music finds", "life lately", "creative work", "the future", "random thoughts", "big questions", "hidden gems", "internet culture", "personal growth"],
  "Social style": ["spontaneous plans", "late-night hangs", "one-on-one", "small groups", "slow replies", "voice notes", "always down for coffee", "plans in advance", "low-key weekends", "let's explore", "co-working", "comfortable silence", "quality time", "online often", "weekend adventures", "walk and talk"],
};
