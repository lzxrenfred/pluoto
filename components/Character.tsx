"use client";

import type { Accessory, Species } from "@/lib/types";
import { accessoryColorFor, selectedAccessories } from "@/lib/customization";

type Props = { species: Species; color: string; accent: string; accessory?: Accessory; accessories?: Exclude<Accessory,"none">[]; accessoryColor?:string; accessoryColors?:Partial<Record<Exclude<Accessory,"none">,string>>; size?: number; className?: string };

export function Character({ species, color, accent, accessory = "none", accessories, accessoryColor, accessoryColors, size = 72, className = "" }: Props) {
  const appearance={accessory,accessories,accessoryColor,accessoryColors};
  const selected=selectedAccessories(appearance);
  const rabbit = species === "rabbit";
  const cat = species === "cat";
  const bear = species === "bear";
  const fox = species === "fox";
  const penguin = species === "penguin";
  const turtle = species === "turtle";
  const dog = species === "dog";
  const deer = species === "deer";
  const koala = species === "koala";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 110" aria-label={`${species} character`} role="img">
      <g stroke="#17273b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {rabbit && <><path fill={color} d="M31 33C18 15 22 2 30 4c9 2 12 19 12 28"/><path fill={color} d="M58 32C57 12 64 2 72 6c8 5 2 22-4 32"/></>}
        {(cat || fox || dog) && <><path fill={color} d={fox ? "M22 41 25 10 47 31" : "M22 39 25 13 45 31"}/><path fill={color} d={fox ? "m57 31 22-21 1 34" : "m58 31 18-18 3 29"}/></>}
        {(bear||koala) && <><circle fill={color} cx="27" cy="32" r={koala?17:13}/><circle fill={color} cx="72" cy="32" r={koala?17:13}/></>}
        {deer && <><path fill="none" stroke="#9a775c" d="M32 34 24 4m8 19-14-9m50 20 8-30m-8 19 14-9"/><ellipse fill={color} cx="26" cy="37" rx="13" ry="8"/><ellipse fill={color} cx="74" cy="37" rx="13" ry="8"/></>}
        {turtle && <ellipse fill="#537b59" cx="50" cy="76" rx="35" ry="27"/>}
        <path fill={penguin ? "#f8f2df" : color} d="M18 55c0-23 14-34 32-34s32 11 32 34v24c0 18-13 28-32 28S18 97 18 79Z"/>
        {penguin && <path fill={color} d="M18 57c0-24 14-36 32-36s32 12 32 36v19c-7-17-16-23-32-23S25 60 18 77Z"/>}
        {turtle && <path fill={color} d="M23 52c0-18 11-27 27-27s27 9 27 27v18c0 15-11 23-27 23S23 85 23 70Z"/>}
        {!penguin && !turtle && <ellipse fill={accent} stroke="none" cx="50" cy="72" rx="23" ry="24"/>}
        {fox && <path fill={accent} stroke="none" d="M25 45c13 0 20 7 25 16 5-9 12-16 25-16-3 28-10 39-25 39S28 73 25 45Z"/>}
        <path d="M38 56h1M61 56h1" strokeWidth="6"/>
        {koala&&<ellipse cx="50" cy="66" rx="7" ry="10" fill="#4e493f"/>}
        <path d={dog ? "M44 68q6 6 12 0" : "M45 68q5 4 10 0"} fill="none"/>
        {cat && <><path d="M26 66 8 61M27 72 8 75M74 66l18-5M73 72l19 3"/></>}
        {fox && <path fill={color} d="M78 80c19 1 18 25 1 23-8-1-12-5-13-10 11 4 17-2 12-13Z"/>}
        <path d="M31 101v6M69 101v6"/>
        {selected.includes("glasses") && <g stroke={accessoryColorFor(appearance,"glasses")}><circle fill="none" cx="38" cy="57" r="9"/><circle fill="none" cx="62" cy="57" r="9"/><path d="M47 57h6"/></g>}
        {selected.includes("headphones") && <><path fill="none" d="M25 57c0-34 50-34 50 0"/><path fill={accessoryColorFor(appearance,"headphones")} d="M18 55h11v22H18zM71 55h11v22H71z"/></>}
        {selected.includes("cap") && <><path fill={accessoryColorFor(appearance,"cap")} d="M24 35c5-21 44-22 51 2-19-5-34-5-51-2Z"/><path fill={accessoryColorFor(appearance,"cap")} d="M51 36c18-5 31 1 35 6-14 2-25 1-35-6Z"/></>}
        {selected.includes("scarf") && <><path fill={accessoryColorFor(appearance,"scarf")} d="M27 79c15 7 31 7 46 0l-4 16c-13 5-25 5-38 0Z"/><path fill={accessoryColorFor(appearance,"scarf")} d="m61 91 12 10-9 7-8-15Z"/></>}
        {selected.includes("tote") && <><path fill={accessoryColorFor(appearance,"tote")} d="M67 77h22v26H67z"/><path fill="none" d="M72 79c0-13 12-13 12 0"/></>}
        {selected.includes("bow")&&<><ellipse fill={accessoryColorFor(appearance,"bow")} cx="64" cy="24" rx="11" ry="6"/><ellipse fill={accessoryColorFor(appearance,"bow")} cx="81" cy="24" rx="11" ry="6"/><circle fill="#e9bc5b" cx="72" cy="24" r="4"/></>}
        {selected.includes("flower")&&<><circle fill={accessoryColorFor(appearance,"flower")} cx="73" cy="22" r="10"/><circle fill="#e9bc5b" cx="73" cy="22" r="4"/></>}
      </g>
    </svg>
  );
}
