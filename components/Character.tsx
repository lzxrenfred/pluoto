"use client";

import type { Accessory, Species } from "@/lib/types";

type Props = { species: Species; color: string; accent: string; accessory?: Accessory; size?: number; className?: string };

export function Character({ species, color, accent, accessory = "none", size = 72, className = "" }: Props) {
  const rabbit = species === "rabbit";
  const cat = species === "cat";
  const bear = species === "bear";
  const fox = species === "fox";
  const penguin = species === "penguin";
  const turtle = species === "turtle";
  const dog = species === "dog";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 110" aria-label={`${species} character`} role="img">
      <g stroke="#17273b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {rabbit && <><path fill={color} d="M31 33C18 15 22 2 30 4c9 2 12 19 12 28"/><path fill={color} d="M58 32C57 12 64 2 72 6c8 5 2 22-4 32"/></>}
        {(cat || fox || dog) && <><path fill={color} d={fox ? "M22 41 25 10 47 31" : "M22 39 25 13 45 31"}/><path fill={color} d={fox ? "m57 31 22-21 1 34" : "m58 31 18-18 3 29"}/></>}
        {bear && <><circle fill={color} cx="27" cy="32" r="13"/><circle fill={color} cx="72" cy="32" r="13"/></>}
        {turtle && <ellipse fill="#537b59" cx="50" cy="76" rx="35" ry="27"/>}
        <path fill={penguin ? "#f8f2df" : color} d="M18 55c0-23 14-34 32-34s32 11 32 34v24c0 18-13 28-32 28S18 97 18 79Z"/>
        {penguin && <path fill={color} d="M18 57c0-24 14-36 32-36s32 12 32 36v19c-7-17-16-23-32-23S25 60 18 77Z"/>}
        {turtle && <path fill={color} d="M23 52c0-18 11-27 27-27s27 9 27 27v18c0 15-11 23-27 23S23 85 23 70Z"/>}
        {!penguin && !turtle && <ellipse fill={accent} stroke="none" cx="50" cy="72" rx="23" ry="24"/>}
        {fox && <path fill={accent} stroke="none" d="M25 45c13 0 20 7 25 16 5-9 12-16 25-16-3 28-10 39-25 39S28 73 25 45Z"/>}
        <path d="M38 56h1M61 56h1" strokeWidth="6"/>
        <path d={dog ? "M44 68q6 6 12 0" : "M45 68q5 4 10 0"} fill="none"/>
        {cat && <><path d="M26 66 8 61M27 72 8 75M74 66l18-5M73 72l19 3"/></>}
        {fox && <path fill={color} d="M78 80c19 1 18 25 1 23-8-1-12-5-13-10 11 4 17-2 12-13Z"/>}
        <path d="M31 101v6M69 101v6"/>
        {accessory === "glasses" && <><circle fill="none" cx="38" cy="57" r="9"/><circle fill="none" cx="62" cy="57" r="9"/><path d="M47 57h6"/></>}
        {accessory === "headphones" && <><path fill="none" d="M25 57c0-34 50-34 50 0"/><path fill="#f3b953" d="M18 55h11v22H18zM71 55h11v22H71z"/></>}
        {accessory === "cap" && <><path fill="#6f8fc9" d="M24 35c5-21 44-22 51 2-19-5-34-5-51-2Z"/><path fill="#6f8fc9" d="M51 36c18-5 31 1 35 6-14 2-25 1-35-6Z"/></>}
        {accessory === "scarf" && <><path fill="#e75f4d" d="M27 79c15 7 31 7 46 0l-4 16c-13 5-25 5-38 0Z"/><path fill="#e75f4d" d="m61 91 12 10-9 7-8-15Z"/></>}
        {accessory === "tote" && <><path fill="#f4d48a" d="M67 77h22v26H67z"/><path fill="none" d="M72 79c0-13 12-13 12 0"/></>}
      </g>
    </svg>
  );
}
