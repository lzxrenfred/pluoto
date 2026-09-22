"use client";
import { RoundedBox } from '@react-three/drei';
import { ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three';
import type { Person } from '@/lib/types';

const makeMaterial = (color:string, flatShading = false) => new MeshStandardMaterial({color,roughness:.9,metalness:0,flatShading});
const materials = {
  wall:makeMaterial('#f5ead8'), wallShade:makeMaterial('#e8d8c1'), roof:makeMaterial('#df7963'), roofShade:makeMaterial('#c86355'),
  wood:makeMaterial('#b9855c'), darkWood:makeMaterial('#8f6249'), bark:makeMaterial('#987151'), glass:makeMaterial('#a8d2d2'),
  stone:makeMaterial('#ddd5c7'), stoneWarm:makeMaterial('#eadbc4'), dark:makeMaterial('#4e493f'), white:makeMaterial('#fff8e9'),
  leafDark:makeMaterial('#5f945c',true), leaf:makeMaterial('#78a962',true), leafLight:makeMaterial('#99bd72',true),
  grass:makeMaterial('#75a45f',true), flower:makeMaterial('#fff7dc'), flowerGold:makeMaterial('#e9bc5b'), coral:makeMaterial('#dc745e'),
};
const houseColors = {coral:'#df7963',sage:'#73946d',blue:'#7394ae',honey:'#d9a760'} as const;
type MaterialName = keyof typeof materials;
type BlockProps = {position?:[number,number,number];size:[number,number,number];material:MaterialName;rotation?:[number,number,number];radius?:number};
function Block({position,size,material,rotation,radius}:BlockProps) {
  const safeRadius = radius ?? Math.min(.045,Math.min(...size)/3);
  return <RoundedBox position={position} args={size} radius={safeRadius} smoothness={2} rotation={rotation} material={materials[material]} castShadow receiveShadow/>;
}
function Pebble({position,scale,material,color}:{position:[number,number,number];scale:[number,number,number];material?:MaterialName;color?:string}) {
  return <mesh position={position} scale={scale} castShadow receiveShadow><sphereGeometry args={[1,16,12]}/>{material?<primitive object={materials[material]} attach="material"/>:<meshStandardMaterial color={color} roughness={.9}/>}</mesh>;
}

const gableShape = new Shape();
gableShape.moveTo(-.81,0); gableShape.lineTo(.81,0); gableShape.lineTo(0,.5); gableShape.closePath();
const gableGeometry = new ExtrudeGeometry(gableShape,{depth:1.48,steps:1,curveSegments:1,bevelEnabled:false});
gableGeometry.computeVertexNormals();

function StudioModel({houseColor}:{houseColor:keyof typeof houseColors}) {
  return <group>
    <Block position={[0,.07,0]} size={[1.78,.14,1.64]} material="stone" radius={.055}/><Block position={[-.22,.52,0]} size={[1.25,.9,1.45]} material="wall" radius={.045}/><RoundedBox position={[-.22,1,0]} args={[1.38,.12,1.58]} radius={.025} smoothness={2} castShadow receiveShadow><meshStandardMaterial color={houseColors[houseColor]} roughness={.9}/></RoundedBox>
    <Block position={[.58,.52,-.48]} size={[.22,1.02,.22]} material="wallShade" radius={.035}/><Block position={[.58,.96,.12]} size={[.22,.14,1.28]} material="wallShade" radius={.025}/><Block position={[.58,.49,.69]} size={[.48,.74,.06]} material="glass" radius={.025}/>
    <Block position={[-.28,.51,.735]} size={[.55,.42,.045]} material="glass" radius={.025}/><Block position={[-.28,.51,.768]} size={[.045,.42,.018]} material="wall" radius={.01}/><Block position={[.36,.4,.735]} size={[.3,.64,.06]} material="darkWood" radius={.035}/><Block position={[.36,.06,.91]} size={[.48,.12,.3]} material="stone" radius={.04}/>
  </group>;
}
function KioskModel() {
  return <group>
    <Block position={[0,.07,0]} size={[1.7,.14,1.5]} material="stoneWarm" radius={.055}/><Block position={[0,.48,-.05]} size={[1.35,.82,1.08]} material="dark" radius={.045}/><Block position={[0,.94,-.05]} size={[1.55,.14,1.28]} material="wall" radius={.035}/>
    <Block position={[0,.58,.515]} size={[1.12,.4,.055]} material="wallShade" radius={.02}/><Block position={[0,.43,.59]} size={[1.22,.18,.38]} material="wood" radius={.035}/><Block position={[-.45,.2,.45]} size={[.1,.42,.1]} material="darkWood" radius={.025}/><Block position={[.45,.2,.45]} size={[.1,.42,.1]} material="darkWood" radius={.025}/>
    <Pebble position={[.28,.58,.71]} scale={[.12,.05,.12]} material="white"/><Block position={[.28,.69,.71]} size={[.1,.2,.1]} material="white" radius={.025}/>
  </group>;
}
function TentModel() {
  return <group><Block position={[0,.05,0]} size={[1.7,.1,1.5]} material="stoneWarm" radius={.05}/><mesh position={[0,.61,0]} rotation={[0,Math.PI/4,0]} material={materials.coral} castShadow receiveShadow><coneGeometry args={[.88,1.2,4]}/></mesh><mesh position={[0,.46,.48]} rotation={[Math.PI/2,0,0]} material={materials.darkWood} castShadow><coneGeometry args={[.25,.5,3]}/></mesh></group>;
}
export function HouseModel({home,houseColor='coral'}: {home:Person['home'];houseColor?:NonNullable<Person['houseColor']>}) {
  if(home==='studio') return <StudioModel houseColor={houseColor}/>;
  if(home==='kiosk') return <KioskModel/>;
  if(home==='tent') return <TentModel/>;
  const roofMaterial:MaterialName = home==='cabin'?'leafDark':'roof';
  const customRoof=houseColors[houseColor];
  const roofAngle=Math.atan(.5/.81);
  return <group>
    <Block position={[0,.07,0]} size={[1.78,.14,1.64]} material="stone" radius={.055}/>
    <Block position={[0,.53,0]} size={[1.62,.92,1.48]} material={home==='cabin'?'wood':'wall'} radius={.055}/>
    <mesh geometry={gableGeometry} position={[0,.94,-.74]} material={materials[home==='cabin'?'wood':'wall']} castShadow receiveShadow/>
    <RoundedBox position={[-.405,1.23,0]} args={[1.02,.11,1.76]} radius={.025} smoothness={2} rotation={[0,0,roofAngle]} castShadow receiveShadow><meshStandardMaterial color={customRoof} roughness={.9}/></RoundedBox>
    <RoundedBox position={[.405,1.23,0]} args={[1.02,.11,1.76]} radius={.025} smoothness={2} rotation={[0,0,-roofAngle]} castShadow receiveShadow><meshStandardMaterial color={customRoof} roughness={.9}/></RoundedBox>
    <Block position={[0,1.49,0]} size={[.13,.13,1.8]} material={home==='cabin'?'leafDark':'roofShade'} radius={.04}/>
    <Block position={[.48,1.47,-.29]} size={[.22,.48,.22]} material="wallShade" radius={.025}/>
    <Block position={[.48,1.72,-.29]} size={[.28,.08,.28]} material="roofShade" radius={.025}/>
    <Block position={[.28,.43,.765]} size={[.36,.7,.07]} material="darkWood" radius={.045}/>
    <Pebble position={[.39,.43,.814]} scale={[.025,.025,.018]} material="flowerGold"/>
    <Block position={[-.38,.61,.77]} size={[.46,.38,.06]} material="wallShade" radius={.035}/>
    <Block position={[-.38,.61,.807]} size={[.34,.27,.025]} material="glass" radius={.018}/>
    <Block position={[-.38,.61,.826]} size={[.035,.27,.018]} material="wall" radius={.01}/>
    <Block position={[-.38,.61,.828]} size={[.34,.035,.018]} material="wall" radius={.01}/>
    <Block position={[.815,.61,-.14]} size={[.055,.38,.45]} material="wallShade" radius={.025}/>
    <Block position={[.847,.61,-.14]} size={[.025,.27,.33]} material="glass" radius={.012}/>
    <Block position={[.28,.06,.94]} size={[.57,.12,.34]} material="stoneWarm" radius={.045}/>
  </group>;
}
function Canopy({position,scale,material}:{position:[number,number,number];scale:[number,number,number];material:MaterialName}) {
  return <mesh position={position} scale={scale} material={materials[material]} castShadow receiveShadow><dodecahedronGeometry args={[1,1]}/></mesh>;
}
export function TreeModel({variant}:{variant?:'blossom'|'tall'}) {
  const tall=variant==='tall';
  const crown:MaterialName=variant==='blossom'?'coral':'leaf';
  return <group scale={tall?[1.02,1.08,1.02]:[.9,.9,.9]}>
    <mesh position={[0,.37,0]} castShadow receiveShadow material={materials.bark}><cylinderGeometry args={[.1,.15,.72,7]}/></mesh>
    <Block position={[-.12,.13,.02]} size={[.31,.1,.12]} material="bark" rotation={[0,.38,-.08]} radius={.035}/>
    <Canopy position={[-.2,.88,.02]} scale={[.43,.45,.4]} material="leafDark"/>
    <Canopy position={[.2,.92,-.05]} scale={[.46,.48,.43]} material={crown}/>
    <Canopy position={[0,1.23,.02]} scale={[.47,.49,.45]} material={variant==='blossom'?'flower':'leafLight'}/>
  </group>;
}
export function ShrubModel() {
  return <group>
    <Canopy position={[-.2,.22,.02]} scale={[.32,.28,.31]} material="leafDark"/>
    <Canopy position={[.16,.25,-.05]} scale={[.35,.32,.34]} material="leaf"/>
    <Canopy position={[0,.42,.05]} scale={[.28,.28,.27]} material="leafLight"/>
  </group>;
}

function GrassTuft({position=[0,0,0],scale=1}:{position?:[number,number,number];scale?:number}) {
  return <group position={position} scale={scale}>{[-.11,0,.11].map((x,index)=><mesh key={x} position={[x,.11,index===1?.02:0]} rotation={[0,0,(index-1)*-.38]} material={materials.grass} castShadow><coneGeometry args={[.06,.25,4]}/></mesh>)}</group>;
}
function Flower({position,color}:{position:[number,number,number];color:'white'|'coral'}) {
  return <group position={position}>
    <mesh position={[0,.13,0]} material={materials.grass}><cylinderGeometry args={[.012,.016,.26,5]}/></mesh>
    {[0,1,2,3,4].map(index=>{const angle=index*Math.PI*2/5;return <Pebble key={index} position={[Math.cos(angle)*.055,.27,Math.sin(angle)*.055]} scale={[.045,.025,.045]} material={color}/>;})}
    <Pebble position={[0,.275,0]} scale={[.03,.026,.03]} material="flowerGold"/>
  </group>;
}
export function FlowerPatchModel() {
  return <group><GrassTuft position={[-.18,0,.03]} scale={.8}/><Flower position={[-.06,0,-.08]} color="white"/><Flower position={[.13,0,.06]} color="coral"/><Flower position={[.25,0,-.12]} color="white"/></group>;
}
export function PathModel({variant=0}:{variant?:number}) {
  const nudge=variant%2?.05:-.04;
  return <group>
    <Block position={[-.08+nudge,.028,-.27]} size={[.52,.055,.34]} material="stoneWarm" rotation={[0,.04,0]} radius={.11}/>
    <Block position={[.08-nudge,.03,.18]} size={[.58,.06,.38]} material="stone" rotation={[0,-.06,0]} radius={.12}/>
  </group>;
}
export function BenchModel() {
  return <group rotation={[0,-.08,0]}>
    <Block position={[0,.32,.02]} size={[.76,.13,.26]} material="wood" radius={.045}/><Block position={[0,.55,-.11]} size={[.76,.13,.12]} material="wood" radius={.04}/>
    <Block position={[-.27,.16,.02]} size={[.09,.34,.09]} material="darkWood" radius={.025}/><Block position={[.27,.16,.02]} size={[.09,.34,.09]} material="darkWood" radius={.025}/>
  </group>;
}
export function LampModel() {
  return <group>
    <mesh position={[0,.38,0]} material={materials.dark} castShadow><cylinderGeometry args={[.035,.055,.76,8]}/></mesh>
    <Block position={[.12,.75,0]} size={[.28,.055,.055]} material="dark" radius={.018}/>
    <Pebble position={[.24,.68,0]} scale={[.12,.14,.12]} material="flowerGold"/>
    <mesh position={[.24,.7,0]} material={materials.wallShade} castShadow><sphereGeometry args={[.15,12,8,0,Math.PI*2,0,Math.PI/2]}/></mesh>
  </group>;
}
export function TableModel() {
  return <group>
    <Block position={[0,.42,0]} size={[.72,.13,.55]} material="wood" radius={.05}/>
    {[-.25,.25].flatMap(x=>[-.17,.17].map(z=><Block key={`${x}-${z}`} position={[x,.2,z]} size={[.08,.4,.08]} material="darkWood" radius={.02}/>))}
    <Pebble position={[.15,.52,.02]} scale={[.1,.055,.1]} material="white"/><Block position={[.15,.6,.02]} size={[.08,.15,.08]} material="white" radius={.025}/>
  </group>;
}
export function MailboxModel() {
  return <group scale={.82}>
    <Block position={[0,.3,0]} size={[.1,.6,.1]} material="darkWood" radius={.025}/>
    <RoundedBox position={[0,.67,0]} args={[.4,.28,.5]} radius={.12} smoothness={3} material={materials.coral} castShadow receiveShadow/>
    <Block position={[0,.67,.255]} size={[.3,.19,.035]} material="roofShade" radius={.012}/><Block position={[.24,.79,.03]} size={[.045,.36,.045]} material="darkWood" radius={.014}/><Block position={[.31,.94,.03]} size={[.17,.12,.035]} material="coral" radius={.012}/>
  </group>;
}
export function RockClusterModel() {
  return <group>
    <Pebble position={[-.34,.18,.02]} scale={[.34,.2,.28]} material="stone"/>
    <Pebble position={[.08,.24,-.08]} scale={[.3,.27,.25]} material="stoneWarm"/>
    <Pebble position={[.38,.13,.1]} scale={[.23,.15,.2]} material="stone"/>
  </group>;
}
/** Non-colliding surface detail, authored in Ren-local grid units. */
export function GroundDetailsModel() {
  const patches:[number,number,number,number][]=[[2.72,.36,.34,.17],[3.68,.62,.27,.13],[.55,2.55,.26,.12],[4.45,1.78,.3,.14],[2.7,3.52,.24,.12],[.55,4.42,.29,.13]];
  const tufts:[number,number,number][]=[[2.7,.45,.75],[3.7,.72,.7],[4.4,1.72,.8],[2.72,3.48,.7],[.5,4.35,.65]];
  return <group>
    {patches.map(([x,z,sx,sz],index)=><mesh key={`patch-${index}`} position={[x,.008,z]} scale={[sx,1,sz]} material={materials.leafLight} receiveShadow><cylinderGeometry args={[1,1,.012,12]}/></mesh>)}
    {tufts.map(([x,z,size],index)=><GrassTuft key={`tuft-${index}`} position={[x,.01,z]} scale={size}/>)}
  </group>;
}

function Face({accent}:{accent:string}) {
  return <>
    <Pebble position={[-.11,.66,.277]} scale={[.025,.034,.018]} material="dark"/><Pebble position={[.11,.66,.277]} scale={[.025,.034,.018]} material="dark"/>
    <Pebble position={[-.115,.57,.253]} scale={[.14,.11,.075]} color={accent}/><Pebble position={[.115,.57,.253]} scale={[.14,.11,.075]} color={accent}/><Pebble position={[0,.565,.304]} scale={[.038,.03,.025]} material="dark"/>
  </>;
}
function TurtleCharacter({person}:{person:Person}) {
  return <group scale={.82}>
    <Pebble position={[0,.31,-.02]} scale={[.34,.25,.3]} color={person.color}/><Pebble position={[0,.34,-.12]} scale={[.28,.2,.27]} color={person.accent}/><Pebble position={[0,.33,.31]} scale={[.18,.17,.18]} color={person.color}/>
    {[-1,1].map(side=><group key={side}><Pebble position={[side*.25,.12,.13]} scale={[.12,.075,.14]} color={person.color}/><Pebble position={[side*.24,.14,-.2]} scale={[.11,.07,.13]} color={person.color}/></group>)}
    <Pebble position={[-.065,.37,.47]} scale={[.02,.028,.015]} material="dark"/><Pebble position={[.065,.37,.47]} scale={[.02,.028,.015]} material="dark"/>
  </group>;
}
function TurtleAccessory({accessory}:{accessory:Person['accessory']}) {
  if(accessory==='glasses')return <group position={[0,.3,.405]} scale={.52}>{[-.12,.12].map(x=><mesh key={x} position={[x,0,0]}><torusGeometry args={[.09,.018,7,18]}/><primitive object={materials.dark} attach="material"/></mesh>)}<Block position={[0,0,0]} size={[.08,.018,.018]} material="dark" radius={.006}/></group>;
  if(accessory==='headphones')return <group position={[0,.35,.29]} scale={.58}><mesh><torusGeometry args={[.31,.035,8,22,Math.PI]}/><primitive object={materials.dark} attach="material"/></mesh>{[-.31,.31].map(x=><Pebble key={x} position={[x,-.03,.02]} scale={[.065,.12,.09]} material="coral"/>)}</group>;
  if(accessory==='cap')return <group position={[0,.43,.28]} scale={.58}><mesh scale={[.31,.11,.27]}><sphereGeometry args={[1,14,8,0,Math.PI*2,0,Math.PI/2]}/><primitive object={materials.coral} attach="material"/></mesh><Block position={[0,.01,.27]} size={[.32,.035,.18]} material="coral" radius={.045}/></group>;
  if(accessory==='scarf')return <group position={[0,.22,.3]} scale={.64}><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.2,.035,8,20]}/><primitive object={materials.coral} attach="material"/></mesh><Block position={[.13,-.12,.18]} size={[.09,.28,.045]} material="coral" radius={.025}/></group>;
  return <group position={[.27,.17,.18]} scale={.64}><RoundedBox args={[.22,.27,.1]} radius={.05} smoothness={2} material={materials.coral} castShadow/><mesh position={[0,.2,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.12,.018,7,18,Math.PI]}/><primitive object={materials.darkWood} attach="material"/></mesh></group>;
}
function CharacterAccessory({person}:{person:Person}) {
  const accessory=person.accessory;
  if(accessory==='none')return null;
  if(person.species==='turtle')return <TurtleAccessory accessory={accessory}/>;
  if(accessory==='glasses')return <group position={[0,.67,.285]}>{[-.12,.12].map(x=><mesh key={x} position={[x,0,0]}><torusGeometry args={[.09,.018,7,18]}/><primitive object={materials.dark} attach="material"/></mesh>)}<Block position={[0,0,0]} size={[.08,.018,.018]} material="dark" radius={.006}/></group>;
  if(accessory==='headphones')return <group position={[0,.73,.02]}><mesh><torusGeometry args={[.31,.035,8,22,Math.PI]}/><primitive object={materials.dark} attach="material"/></mesh>{[-.31,.31].map(x=><Pebble key={x} position={[x,-.03,.02]} scale={[.065,.12,.09]} material="coral"/>)}</group>;
  if(accessory==='cap')return <group position={[0,.91,.04]}><mesh scale={[.31,.11,.27]}><sphereGeometry args={[1,14,8,0,Math.PI*2,0,Math.PI/2]}/><primitive object={materials.coral} attach="material"/></mesh><Block position={[0,.01,.27]} size={[.32,.035,.18]} material="coral" radius={.045}/></group>;
  if(accessory==='scarf')return <group position={[0,.47,.02]}><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.2,.035,8,20]}/><primitive object={materials.coral} attach="material"/></mesh><Block position={[.13,-.12,.18]} size={[.09,.28,.045]} material="coral" radius={.025}/></group>;
  return <group position={[.28,.35,.02]}><RoundedBox args={[.22,.27,.1]} radius={.05} smoothness={2} material={materials.coral} castShadow/><mesh position={[0,.2,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.12,.018,7,18,Math.PI]}/><primitive object={materials.darkWood} attach="material"/></mesh></group>;
}

export function outfitFit(species:Person['species']) {
  if(species==='turtle') return {position:[0,.31,.205] as [number,number,number],scale:[.48,.29,.12] as [number,number,number]};
  if(species==='rabbit') return {position:[0,.31,.205] as [number,number,number],scale:[.45,.32,.11] as [number,number,number]};
  return {position:[0,.31,.205] as [number,number,number],scale:[.47,.33,.11] as [number,number,number]};
}
function Outfit({person}:{person:Person}) {
  if((person.outfit??'none')==='none')return null;
  const fit=outfitFit(person.species);
  return <group>
    <RoundedBox position={fit.position} args={fit.scale} radius={.08} smoothness={3} castShadow receiveShadow><meshStandardMaterial color="#5f789c" roughness={.92}/></RoundedBox>
    {[-1,1].map(side=><Pebble key={side} position={[side*.25,.34,.12]} scale={[.085,.11,.09]} color="#5f789c"/>)}
    <mesh position={[0,.455,.265]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.09,.018,8,18,Math.PI]}/><meshStandardMaterial color="#d8e0eb" roughness={.9}/></mesh>
  </group>;
}

/** Shared toy proportions with visible species, outfit and accessory variants. */
export function CharacterModel({person}: {person:Person}) {
  const rabbit=person.species==='rabbit';
  const cat=person.species==='cat';
  const bear=person.species==='bear';
  const penguin=person.species==='penguin';
  const dog=person.species==='dog';
  if(person.species==='turtle') return <group rotation={[0,.28,0]}><TurtleCharacter person={person}/><Outfit person={person}/><CharacterAccessory person={person}/></group>;
  return <group rotation={[0,.28,0]} scale={rabbit?.78:.82}>
    <Pebble position={[0,.3,0]} scale={[.25,.29,.2]} color={penguin?'#263545':person.color}/><Pebble position={[0,.31,.17]} scale={[.17,.2,.08]} color={person.accent}/><Pebble position={[0,.66,.035]} scale={[.32,.29,.25]} color={penguin?'#263545':person.color}/>
    <Outfit person={person}/>
    {[-1,1].map(side=><group key={side}>
      {rabbit?<><Pebble position={[side*.17,1.01,.02]} scale={[.105,.32,.085]} color={person.color}/><Pebble position={[side*.17,1.03,.09]} scale={[.052,.23,.04]} material="coral"/></>:bear?<><Pebble position={[side*.22,.89,.02]} scale={[.12,.12,.09]} color={person.color}/><Pebble position={[side*.22,.89,.08]} scale={[.055,.055,.03]} material="coral"/></>:dog?<Pebble position={[side*.28,.74,.015]} scale={[.12,.24,.075]} color={person.color}/>:penguin?<Pebble position={[side*.2,.85,.02]} scale={[.08,.09,.07]} color="#263545"/>:<><mesh position={[side*.19,.94,.015]} rotation={[0,0,side*-.12]} castShadow><coneGeometry args={[cat?.11:.135,cat?.24:.3,5]}/><meshStandardMaterial color={person.color} roughness={.9}/></mesh><mesh position={[side*.19,.935,.055]} rotation={[0,0,side*-.12]} castShadow><coneGeometry args={[cat?.055:.072,cat?.13:.17,5]}/><primitive object={materials.coral} attach="material"/></mesh></>}
      <Pebble position={[side*.13,.095,.1]} scale={[.115,.085,.15]} color={person.accent}/><Pebble position={[side*.2,.31,.08]} scale={[.075,.15,.09]} color={person.color}/>
    </group>)}
    <Face accent={person.accent}/>
    {penguin&&<mesh position={[0,.58,.292]} rotation={[Math.PI/2,0,0]} castShadow><coneGeometry args={[.055,.14,4]}/><meshStandardMaterial color="#e5aa4d" roughness={.9}/></mesh>}
    {rabbit?<Pebble position={[.2,.28,-.18]} scale={[.11,.11,.11]} color={person.accent}/>:<><Pebble position={[.23,.25,-.13]} scale={[cat?.1:.16,cat?.29:.25,.11]} color={person.color}/><Pebble position={[.32,.42,-.18]} scale={[cat?.08:.14,cat?.19:.2,.1]} color={person.accent}/></>}
    <CharacterAccessory person={person}/>
  </group>;
}
