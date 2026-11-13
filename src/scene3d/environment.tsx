import { useMemo } from 'react'
import { ARCADES, BALCONY, BALCONY_DOOR, BALCONY_TABLE, BATHROOM, BATHROOM_DOOR, BEANBAGS, CARROM, COFFEE_TABLE, ENTRANCE_X, FLAG, FLOOR_HEIGHT, type Floor as FloorNumber, GAME_DOOR, GAME_ROOM, GAME_TV, GYM, HAMMOCK, LESEHAN_TABLE, LOUNGE_PARTITION_END_Z, MEETING_DOOR_X, PARTITION_X, PING_PONG, READING_CORNER, SOFA, STAIRS, STALL_ROTATION, type OfficeLayout, TV, type Vec3 } from '../office3d-layout.ts'
import { AcOutdoorUnit, AirConditioner, ArcadeCabinet, Armchair, BathroomFittings, Beanbag, Bed, Bookshelf, CarromTable, ClothesLine, CoffeeTable, DumbbellRack, ExerciseBike, FlagPole, FloorCushion, Fridge, GalonDispenser, Gerobak, GymMirror, Hammock, KopiSepeda, LongTable, LowTable, Nightstand, OfficeChair, OfficeLight, PantryCounter, PingPongTable, Plant, PunchingBag, Railing, RattanChair, RBox, SideTable, Sofa, Staircase, StreetLamp, StringLights, Television, Treadmill, Tree, Vendor, WallClock, Wardrobe, WaterTank, WeightBench, Whiteboard, YogaMat } from './props.tsx'
import { asphalt, carpet, grass, pavingStones, tileFloor, woodFloor } from './textures.ts'

// The building (floors, walls, windows, furniture) and its surroundings (yard, sidewalk,
// street food, the flag and the road). In the evening (dark theme) the lamps come on. Walls facing the camera are kept low, like a
// cut-away dollhouse, so the inside stays visible from any angle the controls allow.

const WALL = '#efe6d6'
const WALL_TOP = '#d9cdb8'
const WALL_HEIGHT = 2.6
const THICK = 0.25

function Floor({ position, size, map, color = '#ffffff', roughness = 0.8 }: { position: Vec3; size: [number, number]; map?: ReturnType<typeof woodFloor>; color?: string; roughness?: number }) {
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={size}/>
    <meshStandardMaterial map={map} color={color} roughness={roughness}/>
  </mesh>
}

function Wall({ from, to, height = WALL_HEIGHT }: { from: [number, number]; to: [number, number]; height?: number }) {
  const [x1, z1] = from
  const [x2, z2] = to
  const length = Math.hypot(x2 - x1, z2 - z1)
  const angle = Math.atan2(z2 - z1, x2 - x1)
  return <group position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]} rotation={[0, -angle, 0]}>
    <RBox position={[0, height / 2, 0]} size={[length + THICK, height, THICK]} radius={0.02} color={WALL} roughness={0.9}/>
    <RBox position={[0, height + 0.02, 0]} size={[length + THICK + 0.02, 0.05, THICK + 0.04]} radius={0.01} color={WALL_TOP}/>
  </group>
}

function Window({ position, width = 1.8, night }: { position: Vec3; width?: number; night: boolean }) {
  return <group position={position}>
    <RBox position={[0, 0, 0]} size={[width + 0.12, 1.22, 0.12]} radius={0.02} color="#5a4636"/>
    <mesh position={[0, 0, 0.065]}><planeGeometry args={[width, 1.1]}/><meshStandardMaterial color={night ? '#2d3f5c' : '#9fd3ea'} emissive={night ? '#1c2c4a' : '#6fb6d6'} emissiveIntensity={0.35} roughness={0.05} metalness={0.2}/></mesh>
    <RBox position={[0, 0, 0.08]} size={[0.05, 1.1, 0.03]} radius={0.01} color="#5a4636"/>
  </group>
}

/** A glass pane along x = const, from `bottom` up to near the top of the walls. */
function Glass({ x, fromZ, toZ, bottom }: { x: number; fromZ: number; toZ: number; bottom: number }) {
  const top = WALL_HEIGHT - 0.2
  return <RBox position={[x, (bottom + top) / 2, (fromZ + toZ) / 2]} size={[0.05, top - bottom, Math.abs(toZ - fromZ)]} radius={0.01} color="#cfe8ee" opacity={0.25} roughness={0.05} shadow={false}/>
}

/** The game room wing: ping-pong, arcade machines, a console corner and a karambol board. */
function GameRoom({ night }: { night: boolean }) {
  const { minX, maxX, minZ, maxZ } = GAME_ROOM
  const floor = useMemo(() => carpet('#3b4170', [3, 3]), [])
  return <group>
    <Floor position={[(minX + maxX) / 2, 0.006, (minZ + maxZ) / 2]} size={[maxX - minX, maxZ - minZ]} map={floor} roughness={0.9}/>
    <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
    <Wall from={[maxX, minZ]} to={[maxX, maxZ]}/>
    <Wall from={[minX, maxZ]} to={[maxX, maxZ]} height={0.55}/>
    <group rotation={[0, -Math.PI / 2, 0]} position={[maxX - 0.14, 1.55, -2.2]}><Window position={[0, 0, 0]} width={1.6} night={night}/></group>
    <PingPongTable position={PING_PONG}/>
    {ARCADES.map((position, index) => <ArcadeCabinet key={index} position={position} color={index === 0 ? '#c62828' : '#1d4ed8'}/>)}
    <RBox position={[GAME_TV[0], 0.25, GAME_TV[2] + 0.2]} size={[1.8, 0.5, 0.4]} radius={0.03} color="#1f2328"/>
    <RBox position={[GAME_TV[0] - 0.3, 0.55, GAME_TV[2] + 0.2]} size={[0.36, 0.08, 0.26]} radius={0.02} color="#f2f2f2"/>
    <Television position={[GAME_TV[0], 1.35, GAME_TV[2] + 0.02]}/>
    {BEANBAGS.map((position, index) => <Beanbag key={index} position={position} color={index === 0 ? '#e76f51' : '#2a9d8f'}/>)}
    <CarromTable position={CARROM}/>
    <Plant position={[maxX - 0.5, 0, maxZ - 0.5]} size={0.9}/>
    <AirConditioner position={[(minX + maxX) / 2 - 0.6, 2.3, minZ + 0.125]}/>
    {[[PING_PONG[0], 2.4, PING_PONG[2]], [ARCADES[0][0] + 0.5, 2.4, -3.6], [GAME_TV[0], 2.4, -3.6]].map((position) => <OfficeLight key={position.join(',')} position={position as Vec3} night={night}/>)}
  </group>
}

function Building({ night, layout }: { night: boolean; layout: OfficeLayout }) {
  const { minX, maxX, minZ, maxZ } = layout.building
  const wood = useMemo(() => woodFloor([4, 4]), [])
  const tiles = useMemo(() => tileFloor([3, 5]), [])
  const rug = useMemo(() => carpet('#5b7c8c', [2, 2]), [])
  const meetingRug = useMemo(() => carpet('#8a4b3c', [2, 2]), [])
  return <group>
    {/* Floors: parquet everywhere, tiles in the pantry, rugs in the lounge and meeting area */}
    <Floor position={[(minX + maxX) / 2, 0.005, (minZ + maxZ) / 2]} size={[maxX - minX, maxZ - minZ]} map={wood} roughness={0.55}/>
    <Floor position={[8.35, 0.01, 1.4]} size={[2.3, 5.4]} map={tiles} roughness={0.35}/>
    <Floor position={[4.6, 0.012, -2.9]} size={[4.4, 2.8]} map={rug}/>
    <Floor position={[(layout.meetingRoom.minX + layout.meetingRoom.maxX) / 2, 0.012, (layout.meetingRoom.minZ + layout.meetingRoom.maxZ) / 2]} size={[layout.meetingRoom.maxX - layout.meetingRoom.minX - 0.3, layout.meetingRoom.maxZ - layout.meetingRoom.minZ - 0.3]} map={meetingRug}/>
    {/* Full-height back and left walls, low walls towards the camera */}
    <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
    <Wall from={[minX, minZ]} to={[minX, maxZ]}/>
    {/* Right wall: the lounge side opens into the game room through a door, glass above */}
    <Wall from={[maxX, minZ]} to={[maxX, GAME_DOOR.fromZ]} height={1.1}/>
    <Wall from={[maxX, GAME_DOOR.toZ]} to={[maxX, maxZ]} height={1.1}/>
    <Glass x={maxX} fromZ={minZ} toZ={GAME_DOOR.fromZ} bottom={1.1}/>
    <Glass x={maxX} fromZ={GAME_DOOR.toZ} toZ={GAME_ROOM.maxZ} bottom={1.1}/>
    {/* Glass partition that makes the lounge its own room */}
    <Wall from={[PARTITION_X, minZ]} to={[PARTITION_X, LOUNGE_PARTITION_END_Z]} height={0.9}/>
    <Glass x={PARTITION_X} fromZ={minZ} toZ={LOUNGE_PARTITION_END_Z} bottom={0.9}/>
    <Wall from={[minX, maxZ]} to={[4.9, maxZ]} height={0.55}/>
    <Wall from={[6.7, maxZ]} to={[maxX, maxZ]} height={0.55}/>
    {/* Meeting room: glass-topped half walls with a door by the aisle, and a planter row by the lounge */}
    <MeetingRoom layout={layout} night={night}/>
    {[1.3, 2.3, 3.3].map((z) => <Plant key={z} position={[0.9, 0, z]} size={0.8}/>)}
    {/* Windows on the back and left walls */}
    {[-7, -3.6, 1.4, 6.6].map((x) => <Window key={x} position={[x, 1.55, minZ + 0.14]} night={night}/>)}
    {[-3].map((z) => <group key={z} rotation={[0, Math.PI / 2, 0]} position={[minX + 0.14, 1.55, z]}><Window position={[0, 0, 0]} width={1.6} night={night}/></group>)}
    {/* Workspace */}
    <Bookshelf position={[minX + 0.35, 0, -0.9]} rotation={Math.PI / 2}/>
    <Plant position={[minX + 0.5, 0, -4.6]}/>
    <Plant position={[-0.4, 0, -4.7]} size={0.9}/>
    <WallClock position={[-3.6, 2.35, minZ + 0.14]}/>
    {/* Lounge */}
    <Sofa position={SOFA} rotation={Math.PI}/>
    {/* Armchairs sit exactly behind the lounge seats agents use (LOUNGE_SEATS 2 and 3) */}
    <Armchair position={[2.1, 0, -2.9]} rotation={Math.PI / 2} color="#d9784a"/>
    <Armchair position={[7.1, 0, -2.9]} rotation={-Math.PI / 2} color="#3d7fd6"/>
    <CoffeeTable position={COFFEE_TABLE}/>
    <RBox position={[TV[0], 0.3, TV[2]]} size={[1.8, 0.6, 0.45]} radius={0.03} color="#6b4a32"/>
    <Television position={[TV[0], 1.35, minZ + 0.17]}/>
    <Plant position={[2.1, 0, -4.6]}/>
    {/* Pantry: galon dispenser, fridge and counter */}
    <GalonDispenser position={[maxX - 0.45, 0, -0.4]} rotation={-Math.PI / 2}/>
    <Fridge position={[maxX - 0.5, 0, 0.6]} rotation={-Math.PI / 2}/>
    <PantryCounter position={[maxX - 0.45, 0, 2.6]} rotation={-Math.PI / 2}/>
    {/* Split ACs high on the walls */}
    <AirConditioner position={[-5.3, 2.3, minZ + 0.125]}/>
    <AirConditioner position={[TV[0], 2.3, minZ + 0.125]}/>
    <AirConditioner position={[minX + 0.125, 2.3, 2.6]} rotation={Math.PI / 2}/>
    {/* Office lights: suspended cool-white LED bars */}
    {[...layout.desks.map(([x, , z]): Vec3 => [x, 2.4, z + 0.2]),  [(layout.meetingRoom.table.x1 + layout.meetingRoom.table.x2) / 2, 2.4, layout.meetingRoom.table.z] as Vec3, [COFFEE_TABLE[0], 2.4, COFFEE_TABLE[2] + 0.4] as Vec3, [8.2, 2.4, 1.2] as Vec3].map((position) => <OfficeLight key={position.join(',')} position={position} night={night}/>)}
    <Stairs/>
    <GameRoom night={night}/>
  </group>
}

/** A glass pane along z = const, from `bottom` to near the top of the walls. */
function GlassAlongX({ z, fromX, toX, bottom }: { z: number; fromX: number; toX: number; bottom: number }) {
  const top = WALL_HEIGHT - 0.2
  return <RBox position={[(fromX + toX) / 2, (bottom + top) / 2, z]} size={[Math.abs(toX - fromX), top - bottom, 0.05]} radius={0.01} color="#cfe8ee" opacity={0.25} roughness={0.05} shadow={false}/>
}

/** The meeting room: long table and chairs, a TV showing a slide on the left wall, a whiteboard. */
function MeetingRoom({ layout, night }: { layout: OfficeLayout; night: boolean }) {
  const { minX, maxX, minZ, maxZ, table, tv, whiteboard, seats } = layout.meetingRoom
  const door = { from: MEETING_DOOR_X - 0.45, to: MEETING_DOOR_X + 0.45 }
  const chairs = seats.filter((seat) => seat.seated)
  return <group>
    {/* Right wall towards the lounge side, and the aisle-side wall with its door */}
    <Wall from={[maxX, minZ]} to={[maxX, maxZ]} height={0.9}/>
    <Glass x={maxX} fromZ={minZ} toZ={maxZ} bottom={0.9}/>
    {/* Its own left wall when the room is narrower than the building */}
    {minX > layout.building.minX + 0.1 && <><Wall from={[minX, minZ]} to={[minX, maxZ]} height={0.9}/><Glass x={minX} fromZ={minZ} toZ={maxZ} bottom={0.9}/></>}
    <Wall from={[minX, minZ]} to={[door.from, minZ]} height={0.9}/>
    <Wall from={[door.to, minZ]} to={[maxX, minZ]} height={0.9}/>
    <GlassAlongX z={minZ} fromX={minX} toX={door.from} bottom={0.9}/>
    <GlassAlongX z={minZ} fromX={door.to} toX={maxX} bottom={0.9}/>
    <RBox position={[MEETING_DOOR_X, WALL_HEIGHT - 0.15, minZ]} size={[0.95, 0.1, 0.12]} radius={0.02} color={WALL_TOP}/>
    <LongTable position={[(table.x1 + table.x2) / 2, 0, table.z]} length={table.x2 - table.x1}/>
    {chairs.map(({ position: [x, , z], facing }) => <OfficeChair key={`${x},${z}`} position={[x, 0, z]} rotation={facing}/>)}
    {/* TV on a stand at the table's left end, showing a slide */}
    <group position={[tv[0], 0, tv[2]]} rotation={[0, Math.PI / 2, 0]}>
      <RBox position={[0, 0.03, 0]} size={[0.9, 0.05, 0.5]} radius={0.02} color="#2a2f33"/>
      <RBox position={[0, 0.75, -0.08]} size={[0.1, 1.45, 0.08]} radius={0.02} color="#3a3f44" metalness={0.5}/>
      <group position={[0, 1.45, 0]}>
      <Television position={[0, 0, 0]}/>
      <RBox position={[0, 0.36, 0.05]} size={[1.6, 0.14, 0.004]} radius={0.004} color="#f4f1ea" emissive="#f4f1ea" emissiveIntensity={night ? 0.8 : 0.3} shadow={false}/>
      {[0.25, 0.45, 0.32, 0.6].map((height, index) => <RBox key={index} position={[-0.45 + index * 0.3, -0.38 + height / 2, 0.05]} size={[0.18, height, 0.004]} radius={0.004} color={['#e9c46a', '#2a9d8f', '#e76f51', '#8fd18a'][index]} emissive={['#e9c46a', '#2a9d8f', '#e76f51', '#8fd18a'][index]} emissiveIntensity={night ? 0.7 : 0.25} shadow={false}/>)}
      </group>
    </group>
    <Whiteboard position={whiteboard} rotation={-Math.PI / 2}/>
    <Plant position={[maxX - 0.4, 0, maxZ - 0.45]} size={0.8}/>
  </group>
}

function Stairs() {
  return <Staircase position={[STAIRS.lowX, 0, STAIRS.z]} run={STAIRS.highX - STAIRS.lowX} rise={FLOOR_HEIGHT} width={STAIRS.width}/>
}

/** A glass pane along z = const (front walls), from `bottom` to `top`. */
function GlassZ({ z, fromX, toX, bottom, top }: { z: number; fromX: number; toX: number; bottom: number; top: number }) {
  return <RBox position={[(fromX + toX) / 2, (bottom + top) / 2, z]} size={[Math.abs(toX - fromX), top - bottom, 0.05]} radius={0.01} color="#cfe8ee" opacity={0.25} roughness={0.05} shadow={false}/>
}

/**
 * Lantai 1 seen from lantai 2: the building closed up to full height (no cut-away), the game room
 * with its roof and tandon air, and the stairs visible through the stairwell.
 */
function BuildingShell({ night, layout }: { night: boolean; layout: OfficeLayout }) {
  const { minX, maxX, minZ, maxZ } = layout.building
  const g = GAME_ROOM
  return <group>
    <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
    <Wall from={[minX, minZ]} to={[minX, maxZ]}/>
    <Wall from={[maxX, minZ]} to={[maxX, maxZ]}/>
    <Wall from={[minX, maxZ]} to={[4.9, maxZ]}/>
    <Wall from={[6.7, maxZ]} to={[maxX, maxZ]}/>
    {/* Glass entrance doors and shop windows facing the street */}
    <GlassZ z={maxZ} fromX={4.9} toX={6.7} bottom={0} top={2.3}/>
    <RBox position={[ENTRANCE_X, 2.45, maxZ]} size={[1.9, 0.3, 0.3]} radius={0.02} color={WALL_TOP}/>
    {[-7, -3.6, -0.2, 2.6, 8.1].filter((x) => x > minX + 1).map((x) => <Window key={x} position={[x, 1.45, maxZ + 0.14]} night={night}/>)}
    {[-3, 0.6, 3].map((z) => <group key={z} rotation={[0, -Math.PI / 2, 0]} position={[minX - 0.14, 1.45, z]}><Window position={[0, 0, 0]} width={1.6} night={night}/></group>)}
    {/* Game room: full walls and a flat roof with the water tank */}
    <Wall from={[g.minX, g.minZ]} to={[g.maxX, g.minZ]}/>
    <Wall from={[g.maxX, g.minZ]} to={[g.maxX, g.maxZ]}/>
    <Wall from={[g.minX, g.maxZ]} to={[g.maxX, g.maxZ]}/>
    {[11, 13.8].map((x) => <Window key={x} position={[x, 1.45, g.maxZ + 0.14]} width={1.4} night={night}/>)}
    <RBox position={[(g.minX + g.maxX) / 2, WALL_HEIGHT + 0.08, (g.minZ + g.maxZ) / 2]} size={[g.maxX - g.minX + 0.3, 0.16, g.maxZ - g.minZ + 0.3]} radius={0.02} color="#9a9a94" roughness={0.95}/>
    <WaterTank position={[14.2, WALL_HEIGHT + 0.16, -3.8]}/>
    <AcOutdoorUnit position={[11.2, WALL_HEIGHT + 0.16, -4.3]}/>
    <Stairs/>
  </group>
}

/** Lantai 2: dorm bedroom, lesehan corner, bathroom, and the balcony over the front. */
function UpperFloor({ night, layout }: { night: boolean; layout: OfficeLayout }) {
  const { minX, maxX, minZ, maxZ } = layout.building
  const wood = useMemo(() => woodFloor([4, 4]), [])
  const bedroomRug = useMemo(() => carpet('#6d5a8c', [3, 3]), [])
  const lesehanRug = useMemo(() => carpet('#8c3b3b', [2, 2]), [])
  const readingRug = useMemo(() => carpet('#2f5d50', [2, 2]), [])
  const gymMat = useMemo(() => carpet('#3f454c', [3, 2]), [])
  const tiles = useMemo(() => tileFloor([2, 2]), [])
  const balconyTiles = useMemo(() => tileFloor([6, 1]), [])
  // The slab, leaving the stairwell open: [minX, maxX, minZ, maxZ] pieces.
  const hole = { minX: STAIRS.highX, maxX: STAIRS.lowX, minZ: STAIRS.z - STAIRS.width / 2 - 0.05, maxZ: STAIRS.z + STAIRS.width / 2 + 0.05 }
  const slab: [number, number, number, number][] = [
    [minX, maxX, minZ, hole.minZ], [minX, hole.minX, hole.minZ, hole.maxZ], [hole.maxX, maxX, hole.minZ, hole.maxZ], [minX, maxX, hole.maxZ, maxZ],
    [minX, maxX, BALCONY.minZ, BALCONY.maxZ],
  ]
  const blankets = ['#3d7fd6', '#e76f51', '#2a9d8f', '#e9c46a', '#8d5bc1', '#d64545']
  const doorX = (BALCONY_DOOR.fromX + BALCONY_DOOR.toX) / 2
  const balconyPosts = [minX + 0.15, (minX + maxX) / 2, maxX - 0.15]
  const H = FLOOR_HEIGHT
  return <group>
    {/* Balcony columns down to the sidewalk (ruko style) and the frame for the string lights */}
    {balconyPosts.map((x) => <RBox key={x} position={[x, (H + 2.3) / 2, BALCONY.maxZ - 0.12]} size={[0.18, H + 2.3, 0.18]} radius={0.02} color={WALL}/>)}
    <RBox position={[(minX + maxX) / 2, H + 2.3, BALCONY.maxZ - 0.12]} size={[maxX - minX, 0.12, 0.14]} radius={0.02} color={WALL_TOP}/>
    <group position={[0, H, 0]}>
      {slab.map(([x1, x2, z1, z2]) => <RBox key={`${x1},${z1}`} position={[(x1 + x2) / 2, -0.11, (z1 + z2) / 2]} size={[x2 - x1, 0.22, z2 - z1]} radius={0.01} color="#cfc6b5"/>)}
      {slab.slice(0, 4).map(([x1, x2, z1, z2]) => <Floor key={`f${x1},${z1}`} position={[(x1 + x2) / 2, 0.005, (z1 + z2) / 2]} size={[x2 - x1, z2 - z1]} map={wood} roughness={0.55}/>)}
      <Floor position={[(minX + maxX) / 2, 0.005, (BALCONY.minZ + BALCONY.maxZ) / 2]} size={[maxX - minX, BALCONY.maxZ - BALCONY.minZ]} map={balconyTiles} roughness={0.5}/>
      <Floor position={[(minX + PARTITION_X) / 2, 0.012, -2.4]} size={[PARTITION_X - minX - 0.4, 5]} map={bedroomRug}/>
      <Floor position={[LESEHAN_TABLE[0], 0.012, LESEHAN_TABLE[2]]} size={[3.4, 2.8]} map={lesehanRug}/>
      <Floor position={[(BATHROOM.minX + BATHROOM.maxX) / 2, 0.012, (BATHROOM.minZ + BATHROOM.maxZ) / 2]} size={[BATHROOM.maxX - BATHROOM.minX, BATHROOM.maxZ - BATHROOM.minZ]} map={tiles} roughness={0.3}/>
      {/* Walls: full at the back and sides, glass sliding doors onto the balcony */}
      <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
      <Wall from={[minX, minZ]} to={[minX, maxZ]}/>
      <Wall from={[maxX, minZ]} to={[maxX, maxZ]}/>
      <Wall from={[minX, maxZ]} to={[BALCONY_DOOR.fromX, maxZ]} height={0.3}/>
      <Wall from={[BALCONY_DOOR.toX, maxZ]} to={[maxX, maxZ]} height={0.3}/>
      <GlassZ z={maxZ} fromX={minX} toX={BALCONY_DOOR.fromX} bottom={0.3} top={2.2}/>
      <GlassZ z={maxZ} fromX={BALCONY_DOOR.toX} toX={maxX} bottom={0.3} top={2.2}/>
      {[-6, -2.4, 2.6].filter((x) => x > minX + 1).map((x) => <Window key={x} position={[x, 1.55, minZ + 0.14]} night={night}/>)}
      <group rotation={[0, -Math.PI / 2, 0]} position={[maxX - 0.14, 1.55, 0.6]}><Window position={[0, 0, 0]} width={1.6} night={night}/></group>
      {/* Bedroom: one bed per agent, a glass partition, wardrobes and bedside tables */}
      <Wall from={[PARTITION_X, minZ]} to={[PARTITION_X, LOUNGE_PARTITION_END_Z]} height={0.9}/>
      <Glass x={PARTITION_X} fromZ={minZ} toZ={LOUNGE_PARTITION_END_Z} bottom={0.9}/>
      {layout.beds.map(([x, , z], index) => <Bed key={index} position={[x, 0, z]} color={blankets[index % blankets.length]}/>)}
      {layout.beds.filter(([, , z]) => z < -3).map(([x], index) => <Nightstand key={index} position={[x - 0.85, 0, minZ + 0.4]} night={night}/>)}
      <Wardrobe position={[minX + 0.4, 0, 1.4]} rotation={Math.PI / 2}/>
      <Wardrobe position={[minX + 0.4, 0, 2.8]} rotation={Math.PI / 2}/>
      <AirConditioner position={[(minX + PARTITION_X) / 2, 2.3, minZ + 0.125]}/>
      {/* Lesehan corner */}
      <LowTable position={[LESEHAN_TABLE[0], 0, LESEHAN_TABLE[2]]}/>
      {[[-1, 0, '#e9c46a'], [1, 0, '#2a9d8f'], [0, -0.85, '#e76f51'], [0, 0.85, '#3d7fd6']].map(([dx, dz, color]) => <FloorCushion key={color as string} position={[LESEHAN_TABLE[0] + (dx as number), 0, LESEHAN_TABLE[2] + (dz as number)]} color={color as string}/>)}
      <Bookshelf position={[6.5, 0, minZ + 0.3]}/>
      {/* Pojok baca: shelf on the back wall, two armchairs and a side table on a carpet */}
      <Floor position={[READING_CORNER.rug.x, 0.012, READING_CORNER.rug.z]} size={[READING_CORNER.rug.width, READING_CORNER.rug.depth]} map={readingRug}/>
      <Bookshelf position={[READING_CORNER.shelf[0], 0, READING_CORNER.shelf[2]]}/>
      <Armchair position={[READING_CORNER.chairs[0].x, 0, READING_CORNER.chairs[0].z]} rotation={READING_CORNER.chairs[0].facing} color="#2a9d8f"/>
      <Armchair position={[READING_CORNER.chairs[1].x, 0, READING_CORNER.chairs[1].z]} rotation={READING_CORNER.chairs[1].facing} color="#b5651d"/>
      <SideTable position={[READING_CORNER.sideTable[0], 0, READING_CORNER.sideTable[2]]}/>
      <Plant position={[0.9, 0, -1.2]} size={0.9}/>
      <Plant position={[7.1, 0, 1.4]}/>
      {/* Gym: treadmill, exercise bike, bench press, dumbbell rack, samsak and a yoga mat */}
      <Floor position={[GYM.mat.x, 0.012, GYM.mat.z]} size={[GYM.mat.width, GYM.mat.depth]} map={gymMat} roughness={0.95}/>
      <Treadmill position={GYM.treadmill}/>
      <ExerciseBike position={GYM.bike}/>
      <WeightBench position={GYM.bench}/>
      <DumbbellRack position={GYM.rack} rotation={Math.PI}/>
      <PunchingBag position={GYM.bag}/>
      <YogaMat position={GYM.yogaMat}/>
      <GymMirror position={[minX + 0.14, 0, GYM.mirrorZ]} width={1.6}/>
      <OfficeLight position={[GYM.mat.x, 2.4, GYM.mat.z]} night={night}/>
      {/* Bathroom: kamar mandi with a bak mandi */}
      <Wall from={[BATHROOM.minX, minZ]} to={[BATHROOM.minX, BATHROOM.maxZ]} height={1.9}/>
      <Wall from={[BATHROOM.minX, BATHROOM.maxZ]} to={[BATHROOM_DOOR.fromX, BATHROOM.maxZ]} height={1}/>
      <Wall from={[BATHROOM_DOOR.toX, BATHROOM.maxZ]} to={[maxX, BATHROOM.maxZ]} height={1}/>
      <BathroomFittings position={[8.2, 0, -2.6]}/>
      {/* Railing around the stairwell */}
      <Railing position={[(hole.minX + hole.maxX) / 2, 0, hole.minZ]} length={hole.maxX - hole.minX}/>
      <Railing position={[hole.maxX, 0, STAIRS.z]} length={hole.maxZ - hole.minZ} rotation={Math.PI / 2}/>
      {[...layout.beds.filter((_, index) => index % 2 === 0).map(([x, , z]): Vec3 => [x, 2.4, z + 0.6]), [LESEHAN_TABLE[0], 2.4, LESEHAN_TABLE[2]] as Vec3, [doorX, 2.4, 2] as Vec3].map((position) => <OfficeLight key={position.join(',')} position={position} night={night}/>)}
      {/* Balcony */}
      <Railing position={[(minX + maxX) / 2, 0, BALCONY.maxZ - 0.05]} length={maxX - minX}/>
      <Railing position={[minX + 0.05, 0, (BALCONY.minZ + BALCONY.maxZ) / 2]} length={BALCONY.maxZ - BALCONY.minZ} rotation={Math.PI / 2}/>
      <Railing position={[maxX - 0.05, 0, (BALCONY.minZ + BALCONY.maxZ) / 2]} length={BALCONY.maxZ - BALCONY.minZ} rotation={Math.PI / 2}/>
      <SideTable position={[BALCONY_TABLE[0], 0, BALCONY_TABLE[2]]}/>
      <RattanChair position={[BALCONY_TABLE[0] - 0.85, 0, BALCONY_TABLE[2]]} rotation={Math.PI / 2}/>
      <RattanChair position={[BALCONY_TABLE[0] + 0.85, 0, BALCONY_TABLE[2]]} rotation={-Math.PI / 2}/>
      <Hammock position={[HAMMOCK[0], 0, HAMMOCK[2]]}/>
      <ClothesLine position={[Math.max(minX + 1.6, -3.2), 0, 6.15]}/>
      <Plant position={[maxX - 0.5, 0, BALCONY.minZ + 0.5]} size={0.9}/>
      <Plant position={[minX + 0.5, 0, BALCONY.minZ + 0.5]} size={0.9}/>
      <StringLights position={[(minX + maxX) / 2, 2.15, BALCONY.maxZ - 0.12]} length={maxX - minX - 0.6} night={night}/>
    </group>
  </group>
}

function Outdoors({ night, layout }: { night: boolean; layout: OfficeLayout }) {
  // How far the building grew to the left for a larger crew; the grounds grow with it.
  const shift = layout.building.minX + 9.5
  const lawn = useMemo(() => grass([14, 12]), [])
  const road = useMemo(() => asphalt([8, 1]), [])
  const sidewalk = useMemo(() => pavingStones([14, 2]), [])
  const gang = useMemo(() => pavingStones([2, 5]), [])
  return <group>
    <Floor position={[shift / 2, -0.02, 2]} size={[60 - shift, 44]} map={lawn} roughness={1}/>
    <Floor position={[shift / 2, -0.005, 7.1]} size={[34 - shift, 5]} map={sidewalk} roughness={0.9}/>
    <Floor position={[shift / 2, -0.01, 12.1]} size={[60 - shift, 5]} map={road} roughness={0.95}/>
    {/* Path from the entrance to the sidewalk */}
    <Floor position={[5.8, 0, 4.7]} size={[1.8, 1]} map={sidewalk}/>
    {/* Merah Putih by the entrance */}
    <FlagPole position={FLAG}/>
    {/* The gang (alley) left of the building, with the street food out of the main view */}
    <Floor position={[layout.gangCenterX, -0.008, -0.4]} size={[3.6, 10]} map={gang} roughness={0.9}/>
    <group position={layout.baksoCart} rotation={[0, STALL_ROTATION, 0]}>
      <Gerobak position={[0, 0, 0]} night={night}/>
      <Vendor position={[-1.6, 0, 0]} rotation={Math.PI / 2} shirt="#f1f1ec" hat="peci"/>
    </group>
    <group position={layout.kopiBike} rotation={[0, STALL_ROTATION, 0]}>
      <KopiSepeda position={[0, 0, 0]} night={night}/>
      <Vendor position={[-1.35, 0, -0.1]} rotation={Math.PI / 2} shirt="#2f6d8f" hat="cap"/>
    </group>
    {/* AC outdoor units behind the building */}
    <AcOutdoorUnit position={[-5.3, 0, layout.building.minZ - 0.45]} rotation={Math.PI}/>
    <AcOutdoorUnit position={[TV[0] - 1.6, 0, layout.building.minZ - 0.45]} rotation={Math.PI}/>
    <StreetLamp position={[-8, 0, 9.3]} night={night}/>
    <StreetLamp position={[4, 0, 9.3]} night={night}/>
    {[[-12.8 + shift, -7.4, 1.3], [13.5, -7.2, 1.2], [-14.8 + shift, 2.6, 1.1], [18.6, 4.8, 1.3], [-10.5 + shift, 7.5, 1], [12, 8, 1.1], [-2, -8.5, 1.2], [6, -8, 1.1]].map(([x, z, size]) => <Tree key={`${x}${z}`} position={[x, 0, z]} size={size}/>)}
  </group>
}

/** The grounds plus the floor in view: lantai 1 as a cut-away, or lantai 2 on top of the closed building. */
export function Environment({ night = false, layout, floor = 1 }: { night?: boolean; layout: OfficeLayout; floor?: FloorNumber }) {
  return <group>
    {floor === 1 ? <Building night={night} layout={layout}/> : <><BuildingShell night={night} layout={layout}/><UpperFloor night={night} layout={layout}/></>}
    <Outdoors night={night} layout={layout}/>
  </group>
}
