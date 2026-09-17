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
export function HouseModel({home}: {home:Person['home']}) {
  const roofMaterial:MaterialName = home==='cabin'?'leafDark':home==='studio'?'glass':'roof';
  const roofAngle=Math.atan(.5/.81);
  return <group>
    <Block position={[0,.07,0]} size={[1.78,.14,1.64]} material="stone" radius={.055}/>
    <Block position={[0,.53,0]} size={[1.62,.92,1.48]} material={home==='cabin'?'wood':'wall'} radius={.055}/>
    <mesh geometry={gableGeometry} position={[0,.94,-.74]} material={materials[home==='cabin'?'wood':'wall']} castShadow receiveShadow/>
    <Block position={[-.405,1.23,0]} size={[1.02,.11,1.76]} material={roofMaterial} rotation={[0,0,roofAngle]} radius={.025}/>
    <Block position={[.405,1.23,0]} size={[1.02,.11,1.76]} material={roofMaterial} rotation={[0,0,-roofAngle]} radius={.025}/>
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
export function MailboxModel() {
  return <group scale={.82}>
    <Block position={[0,.3,0]} size={[.1,.6,.1]} material="darkWood" radius={.025}/>
    <RoundedBox position={[0,.67,0]} args={[.4,.28,.5]} radius={.12} smoothness={3} material={materials.coral} castShadow receiveShadow/>
    <Block position={[0,.67,.255]} size={[.3,.19,.035]} material="roofShade" radius={.012}/><Block position={[.24,.79,.03]} size={[.045,.36,.045]} material="darkWood" radius={.014}/><Block position={[.31,.94,.03]} size={[.17,.12,.035]} material="coral" radius={.012}/>
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

/** One refined toy fox. Other species intentionally remain placeholders. */
export function CharacterModel({person}: {person:Person}) {
  return <group rotation={[0,.28,0]} scale={.82}>
    <Pebble position={[0,.3,0]} scale={[.25,.29,.2]} color={person.color}/><Pebble position={[0,.31,.17]} scale={[.17,.2,.08]} color={person.accent}/><Pebble position={[0,.66,.035]} scale={[.32,.29,.25]} color={person.color}/>
    {[-1,1].map(side=><group key={side}>
      <mesh position={[side*.19,.94,.015]} rotation={[0,0,side*-.12]} castShadow><coneGeometry args={[.135,.3,5]}/><meshStandardMaterial color={person.color} roughness={.9}/></mesh>
      <mesh position={[side*.19,.935,.055]} rotation={[0,0,side*-.12]} castShadow><coneGeometry args={[.072,.17,5]}/><primitive object={materials.coral} attach="material"/></mesh>
      <Pebble position={[side*.115,.69,.266]} scale={[.027,.04,.018]} material="dark"/><Pebble position={[side*.13,.095,.1]} scale={[.115,.085,.15]} color={person.accent}/><Pebble position={[side*.2,.31,.08]} scale={[.075,.15,.09]} color={person.color}/><Pebble position={[side*.115,.57,.253]} scale={[.14,.11,.075]} color={person.accent}/>
    </group>)}
    <Pebble position={[0,.565,.304]} scale={[.038,.03,.025]} material="dark"/><Pebble position={[-.11,.66,.277]} scale={[.025,.034,.018]} material="dark"/><Pebble position={[.11,.66,.277]} scale={[.025,.034,.018]} material="dark"/>
    <Pebble position={[.23,.25,-.13]} scale={[.16,.25,.13]} color={person.color}/><Pebble position={[.32,.42,-.18]} scale={[.14,.2,.12]} color={person.accent}/>
    {person.accessory !== 'none'&&<mesh position={[0,.46,.015]} rotation={[Math.PI/2,0,0]} castShadow><torusGeometry args={[.19,.027,8,20]}/><primitive object={materials.coral} attach="material"/></mesh>}
  </group>;
}
