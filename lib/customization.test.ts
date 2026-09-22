import { describe, expect, it } from "vitest";
import { ACCESSORIES, DECORATION_PRESETS, HOMES, OUTFITS, SPECIES, applyDecorationPreset, normalizedPerson, presetScene } from "./customization";
import { DEMO_PEOPLE } from "./demo";
import { houseCells, LAND_SIGN_CELL, placements } from "./scene-layout";
import {outfitFit} from "../components/PlaneModels";

describe("world-backed customization",()=>{
  it("keeps every offered Character and house choice explicit",()=>{
    expect(SPECIES).toEqual(["fox","rabbit","bear","cat","penguin","turtle","dog"]);
    expect(ACCESSORIES).toEqual(["none","glasses","headphones","cap","tote","scarf"]);
    expect(OUTFITS).toEqual(["none","tee"]);
    expect(HOMES).toEqual(["cottage","studio","cabin"]);
  });

  it.each(DECORATION_PRESETS)("maps the %s preset to a grid-safe scene",preset=>{
    const person=applyDecorationPreset(normalizedPerson(DEMO_PEOPLE[0]),preset);
    expect(person.scene).toBe(presetScene[preset]);
    const house=houseCells[person.scene];
    const occupied=new Set<string>();
    for(let x=house.tileX;x<house.tileX+2;x++)for(let y=house.tileY;y<house.tileY+2;y++)occupied.add(`${x},${y}`);
    occupied.add(`${LAND_SIGN_CELL.tileX},${LAND_SIGN_CELL.tileY}`);
    for(const item of placements[person.scene]) {
      expect(item.tileX).toBeGreaterThanOrEqual(0);expect(item.tileX).toBeLessThan(5);
      expect(item.tileY).toBeGreaterThanOrEqual(0);expect(item.tileY).toBeLessThan(5);
      if(item.kind!=="path")expect(occupied.has(`${item.tileX},${item.tileY}`)).toBe(false);
    }
  });

  it.each(SPECIES)("renders the tee in front of the %s body",species=>{
    const fit=outfitFit(species);
    expect(fit.position[2]).toBeGreaterThan(.15);
    expect(fit.scale.every(value=>value>0)).toBe(true);
  });
});
