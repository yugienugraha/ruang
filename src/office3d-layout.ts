import type { OfficeStation } from './types.ts'

// Layout of the 3D office (world units ≈ metres, y up, +z towards the street).
// Kept apart from the scene so it can be tested. The office adapts to the crew: there is one
// unlabeled desk per agent (hot desking), and the building grows to the left to fit them.
//
//   z -5 ┌──────────── back wall ────────────┬────┬───────────┐
//   gang │ desks (one per agent, two rows,   │ lounge │ game room │
//  bakso │  growing to the left)             │(TV,sofa)│          │
//   kopi │ meeting room (long table, TV,     │  pantry ├──────────┘
//        │  whiteboard) │ stairs
//   z  4 └── low front wall ─── entrance ───────────┘
//        sidewalk · flag      (street food sits in the gang left of the building)
//        road
//
// Lantai 2 sits on the same footprint, FLOOR_HEIGHT up: a dorm bedroom (one bed per agent, above
// the desks), a lesehan corner and a bathroom, reached by the stairs by the entrance, with a
// ruko-style balcony over the front. Positions on lantai 2 have y = FLOOR_HEIGHT.

export type Vec3 = [number, number, number]

/** Glass wall between the workspace and the lounge (back part, up to LOUNGE_PARTITION_END_Z). */
export const PARTITION_X = 0.4
export const LOUNGE_PARTITION_END_Z = -0.5
/** Game room wing right of the building, entered through a door in the lounge wall. */
export const GAME_ROOM = { minX: 9.5, maxX: 15.5, minZ: -5.2, maxZ: 0.6 }
/** Walking line from the lounge lane through the game room door, and the door's extent. */
export const GAME_LANE_Z = -3.7
export const GAME_DOOR = { fromZ: -4.4, toZ: -3.0 }
export const PING_PONG: Vec3 = [12.6, 0, -1.4]
export const ARCADES: Vec3[] = [[10.6, 0, -4.75], [11.6, 0, -4.75]]
export const GAME_TV: Vec3 = [14.2, 0, -5.05]
export const BEANBAGS: Vec3[] = [[13.7, 0, -4.35], [14.7, 0, -4.35]]
export const CARROM: Vec3 = [10.6, 0, -0.1]

/** Walkway in front of the desks; agents walk along it between areas instead of through furniture. */
export const AISLE_Z = 0.4
/** The meeting room's right wall (glass), its door in the aisle-side wall, and its table line. */
export const MEETING_ROOM_MAX_X = -3.2
export const MEETING_ROOM_MIN_Z = 0.95
export const MEETING_DOOR_X = -4.15
export const MEETING_TABLE_Z = 2.75
/** Walking lanes inside the meeting room: behind the aisle-side chairs and behind the front ones. */
const MEETING_BACK_LANE_Z = 1.45
const MEETING_FRONT_LANE_Z = 3.95
const MEETING_SEAT_PITCH = 0.8
/** The TV hangs on the back wall; the sofa faces it (backrest towards the aisle). */
export const TV: Vec3 = [4.6, 0, -4.8]
export const SOFA: Vec3 = [4.6, 0, -1.3]
export const LOUNGE_SEATS: Vec3[] = [[4, 0, -1.8], [2.5, 0, -2.9], [6.7, 0, -2.9]]
const LOUNGE_FACING = [Math.PI, Math.PI / 2, -Math.PI / 2]
export const COFFEE_TABLE: Vec3 = [4.6, 0, -2.9]
/** Gap in the low front wall, and the walking line along the sidewalk just outside it. */
export const ENTRANCE_X = 5.8
export const SIDEWALK_Z = 5.4
/** Lounge agents step to this lane first, so they pass between the armchair and the TV. */
export const LOUNGE_LANE_X = 3.1
export const STALL_ROTATION = Math.PI / 2
/** The flag stands at the front-right corner of the grounds, clear of the rooms in view. */
export const FLAG: Vec3 = [16.4, 0, 2.6]

/** Height of lantai 2's floor above the ground. */
export const FLOOR_HEIGHT = 2.8
export type Floor = 1 | 2
export const floorOf = (position: Vec3 | number): Floor => ((typeof position === 'number' ? position : position[1]) > FLOOR_HEIGHT / 2 ? 2 : 1)
/** Straight stairs by the entrance, rising towards -x: lantai 1 at lowX, lantai 2 at highX. */
export const STAIRS = { z: 3.45, width: 0.9, lowX: 4.7, highX: 1.8 }
/** Where agents step on and off the stairs on each floor. */
const STAIRS_FOOT: [number, number] = [5.2, STAIRS.z]
const STAIRS_HEAD: [number, number] = [1.3, STAIRS.z]
/** Balcony over the front of the building, and the sliding door onto it. */
export const BALCONY = { minZ: 4.2, maxZ: 6.6 }
export const BALCONY_DOOR = { fromX: 6.2, toX: 7.4 }
const BALCONY_LANE_Z = 5
export const BALCONY_TABLE: Vec3 = [0.6, FLOOR_HEIGHT, 5.5]
export const HAMMOCK: Vec3 = [4.2, FLOOR_HEIGHT, 5.95]
/** Lesehan corner upstairs: a low table on a carpet with floor cushions around it. */
export const LESEHAN_TABLE: Vec3 = [4.3, FLOOR_HEIGHT, -3]
/**
 * Pojok baca (reading corner) upstairs: a bookshelf against the back wall in the strip between the
 * bedroom partition and the lesehan rug, with two armchairs and a side table on a small carpet.
 */
export const READING_CORNER = {
  shelf: [1.4, 0, -4.9] as Vec3,
  rug: { x: 1.55, z: -3.35, width: 2.4, depth: 2.3 },
  sideTable: [1.55, 0, -3.35] as Vec3,
  chairs: [{ x: 0.95, z: -3.35, facing: Math.PI / 2 }, { x: 2.15, z: -3.35, facing: -Math.PI / 2 }],
  /** Standing at the shelf, far enough in front of it to leave its doors clear. */
  browse: { x: 1.4, z: -4.25, facing: Math.PI },
}
export const BATHROOM = { minX: 7.6, maxX: 9.5, minZ: -5.2, maxZ: -2.6 }
/** The kamar mandi's door gap in its front wall; agents must enter between these x. */
export const BATHROOM_DOOR = { fromX: 8, toX: 8.9 }
/**
 * Gym upstairs, on the empty strip between the lemari on the left wall and the stairwell, in
 * front of the bedroom (z stays clear of the upstairs aisle at AISLE_Z). Coordinates are fixed:
 * the building only grows further to the left, so this strip exists for any crew size.
 */
export const GYM = {
  mat: { x: -5.3, z: 2.3, width: 6.4, depth: 2.6 },
  treadmill: [-8, 0, 2.3] as Vec3,
  bike: [-6.8, 0, 2.3] as Vec3,
  bench: [-5.2, 0, 2.5] as Vec3,
  rack: [-3.7, 0, 3.35] as Vec3,
  bag: [-2.6, 0, 1.6] as Vec3,
  yogaMat: [-6.9, 0, 2.95] as Vec3,
  /** Mirror panel on the left wall, beside the gym (x comes from the building's left wall). */
  mirrorZ: 1.1,
}
/** Beds stand above the desk columns, in two rows with their heads to the back wall. */
const BED_ROWS_Z = [-4.1, -1.6]

/** Hot desking: one unlabeled desk per agent, in two rows that grow to the left. */
const DESK_RIGHT_X = -2
const DESK_PITCH = 2.6
const DESK_ROWS_Z = [-3.5, -1]
const MIN_DESK_COLUMNS = 3
/** The stock building (up to six agents) and the scene width the camera is framed for. */
const BASE_MIN_X = -9.5
const BASE_SCENE_WIDTH = 28.7
const CAMERA_OFFSET_BASE: Vec3 = [-3.9, 15.2, 18.8]

/**
 * Where and how an agent is. `pose` lying (bed, hammock: `height` is the surface) or sitting on
 * the floor (lesehan); otherwise standing, or sitting on a chair when `seated`.
 */
export interface Placement { position: Vec3; facing: number; seated: boolean; label?: string; pose?: 'lie' | 'floor'; height?: number }
export interface IdleStop { key: string; label: string; spots: Placement[] }

export interface OfficeLayout {
  deskCount: number
  building: { minX: number; maxX: number; minZ: number; maxZ: number }
  desks: Vec3[]
  /** One bed per agent on lantai 2 (y = FLOOR_HEIGHT). */
  beds: Vec3[]
  /** Walking line up the gang (alley) along the left outside wall, between the wall and the carts. */
  sideLaneX: number
  /** Street food parks in the gang, turned so its stools and customers face the building. */
  baksoCart: Vec3
  kopiBike: Vec3
  gangCenterX: number
  /** Meeting room in the front of the workspace: a long table (x1..x2) with a TV on a stand at its left end and a whiteboard at its right. */
  meetingRoom: { minX: number; maxX: number; minZ: number; maxZ: number; table: { x1: number; x2: number; z: number }; tv: Vec3; whiteboard: Vec3; seats: Placement[] }
  camera: { target: Vec3; offset: Vec3 }
  /** How far the view may be panned (camera target bounds), so the office never leaves the screen. */
  pan: { minX: number; maxX: number; minZ: number; maxZ: number }
  idleStops: IdleStop[]
}

const spot = (x: number, z: number, facing: number, seated = false, label?: string): Placement => ({ position: [x, 0, z], facing, seated, ...(label ? { label } : {}) })
const upstairs = (x: number, z: number, facing: number, extra: Partial<Placement> = {}): Placement => ({ position: [x, FLOOR_HEIGHT, z], facing, seated: false, ...extra })
/** Lying in a bed: feet at the foot end, head on the pillow by the back wall. */
export const bedSpot = ([x, , z]: Vec3, label?: string): Placement => upstairs(x, z + 0.95, 0, { pose: 'lie', height: 0.5, ...(label ? { label } : {}) })
/** A spot given in a stall's own coordinates (as if unrotated), placed in the world. */
function stallSpot(stall: Vec3, x: number, z: number, facing: number, seated = false): Placement {
  const cos = Math.cos(STALL_ROTATION)
  const sin = Math.sin(STALL_ROTATION)
  return spot(stall[0] + x * cos + z * sin, stall[2] - x * sin + z * cos, facing + STALL_ROTATION, seated)
}

/**
 * Where idle agents spend their time. Each stop has a few spots; idlePlan spreads agents so that
 * no two share a spot while free ones remain.
 */
function idleStops(building: OfficeLayout['building'], baksoCart: Vec3, kopiBike: Vec3, beds: Vec3[]): IdleStop[] {
  const [tableX, , tableZ] = LESEHAN_TABLE
  return [
    { key: 'tidur', label: 'Sleeping', spots: beds.map((bed) => bedSpot(bed)) },
    { key: 'balkon', label: 'Relaxing on the balcony', spots: [
      upstairs(BALCONY_TABLE[0] - 0.85, BALCONY_TABLE[2], Math.PI / 2, { seated: true }),
      upstairs(BALCONY_TABLE[0] + 0.85, BALCONY_TABLE[2], -Math.PI / 2, { seated: true }),
      upstairs(HAMMOCK[0] + 0.9, HAMMOCK[2], -Math.PI / 2, { pose: 'lie', height: 0.62, label: 'Napping in the hammock' }),
      upstairs(7.9, BALCONY.maxZ - 0.45, 0, { label: 'Enjoying the view from the balcony' }),
    ] },
    { key: 'baca', label: 'Reading in the pojok baca', spots: [
      ...READING_CORNER.chairs.map((chair) => upstairs(chair.x, chair.z, chair.facing, { seated: true })),
      upstairs(READING_CORNER.browse.x, READING_CORNER.browse.z, READING_CORNER.browse.facing, { label: 'Picking a book from the shelf' }),
    ] },
    { key: 'gym', label: 'Working out in the gym', spots: [
      upstairs(GYM.treadmill[0], GYM.treadmill[2] - 0.2, Math.PI, { label: 'Running on the treadmill' }),
      upstairs(GYM.bike[0], GYM.bike[2] + 0.3, Math.PI, { seated: true, label: 'On the exercise bike' }),
      upstairs(GYM.bench[0], GYM.bench[2], 0, { pose: 'lie', height: 0.48, label: 'Bench press' }),
      upstairs(GYM.rack[0], GYM.rack[2] - 0.6, 0, { label: 'Lifting dumbbells' }),
      upstairs(GYM.bag[0], GYM.bag[2] + 0.6, Math.PI, { label: 'Hitting the punching bag' }),
      upstairs(GYM.yogaMat[0], GYM.yogaMat[2], Math.PI, { pose: 'floor', label: 'Stretching on the mat' }),
    ] },
    // In the kamar mandi upstairs; every spot is entered straight through the door gap.
    { key: 'toilet', label: 'In the kamar mandi', spots: [
      upstairs(8.6, -3.9, Math.PI * 0.75, { label: 'Mandi with the gayung' }),
      upstairs(8.35, -4.4, -Math.PI / 2, { label: 'Using the toilet' }),
      upstairs(8.5, -3.1, Math.PI, { label: 'Washing up' }),
    ] },
    { key: 'lesehan', label: 'Lesehan upstairs', spots: [[-1, 0, Math.PI / 2], [1, 0, -Math.PI / 2], [0, -0.85, 0], [0, 0.85, Math.PI]].map(([dx, dz, facing]) => upstairs(tableX + dx, tableZ + dz, facing, { pose: 'floor' })) },
    { key: 'lounge', label: 'Relaxing in the lounge', spots: LOUNGE_SEATS.map(([x, , z], index) => spot(x, z, LOUNGE_FACING[index], true)) },
    { key: 'galon', label: 'Getting water from the galon', spots: [spot(8.35, -0.4, Math.PI / 2), spot(8.2, -1.05, 2.2), spot(8.2, 0.3, 1.1)] },
    // On the gerobak's plastic stools, facing the cart.
    { key: 'bakso', label: 'Eating bakso', spots: [stallSpot(baksoCart, 0.5, 1.1, Math.PI, true), stallSpot(baksoCart, -0.3, 1.2, Math.PI, true), stallSpot(baksoCart, 1.3, 0.9, -2.4)] },
    { key: 'dapur', label: 'In the kitchen', spots: [spot(8.25, 2.6, Math.PI / 2), spot(8.3, 0.65, Math.PI / 2), spot(8.25, 3.3, Math.PI / 2)] },
    { key: 'kopi', label: 'Coffee at the kopi bike', spots: [stallSpot(kopiBike, -0.5, 0.85, Math.PI), stallSpot(kopiBike, 0.5, 0.85, Math.PI), stallSpot(kopiBike, 1.45, 0.3, -Math.PI / 2)] },
    { key: 'game', label: 'Playing ping-pong', spots: [spot(PING_PONG[0] - 1.75, PING_PONG[2], Math.PI / 2), spot(PING_PONG[0] + 1.75, PING_PONG[2], -Math.PI / 2), spot(BEANBAGS[0][0], BEANBAGS[0][2], Math.PI, true, 'Gaming on the console')] },
    { key: 'arcade', label: 'Playing arcade games', spots: [spot(ARCADES[0][0], ARCADES[0][2] + 0.8, Math.PI), spot(ARCADES[1][0], ARCADES[1][2] + 0.8, Math.PI), spot(BEANBAGS[1][0], BEANBAGS[1][2], Math.PI, true, 'Gaming on the console')] },
    { key: 'jalan', label: 'Taking a stroll', spots: [spot(FLAG[0] - 0.8, FLAG[2] + 0.3, Math.PI / 2), spot(building.minX + 0.95, -0.9, -Math.PI / 2), spot(1.3, -4.4, Math.PI)] },
  ]
}

/** The office for a given number of agents: one desk each, and a building wide enough for them. */
export function createLayout(agentCount: number): OfficeLayout {
  const deskCount = Math.max(1, agentCount)
  const columns = Math.max(MIN_DESK_COLUMNS, Math.ceil(deskCount / DESK_ROWS_Z.length))
  // The back row fills first (right to left), then the front row.
  const desks: Vec3[] = Array.from({ length: deskCount }, (_, index) => {
    const row = index < columns ? 0 : 1
    const column = row === 0 ? index : index - columns
    return [DESK_RIGHT_X - column * DESK_PITCH, 0, DESK_ROWS_Z[row]]
  })
  const minX = DESK_RIGHT_X - (columns - 1) * DESK_PITCH - 2.3
  const shift = minX - BASE_MIN_X
  const building = { minX, maxX: 9.5, minZ: -5.2, maxZ: 4.2 }
  const beds: Vec3[] = desks.map(([x], index) => [x, FLOOR_HEIGHT, BED_ROWS_Z[index < columns ? 0 : 1]])
  const baksoCart: Vec3 = [-11.9 + shift, 0, -2.3]
  const kopiBike: Vec3 = [-11.9 + shift, 0, 1.6]
  const sceneMinX = minX - 3.7
  const scale = (GAME_ROOM.maxX - sceneMinX) / BASE_SCENE_WIDTH
  return {
    deskCount, building, desks, beds, baksoCart, kopiBike,
    sideLaneX: -10.15 + shift,
    gangCenterX: -11.4 + shift,
    camera: { target: [(sceneMinX + GAME_ROOM.maxX) / 2 - 0.15, 0.6, 0.2], offset: CAMERA_OFFSET_BASE.map((value) => value * scale) as Vec3 },
    pan: { minX: sceneMinX - 0.3, maxX: 17, minZ: -7, maxZ: 11 },
    idleStops: idleStops(building, baksoCart, kopiBike, beds),
    meetingRoom: meetingRoom(building, deskCount),
  }
}

/**
 * The meeting room sits in the front of the workspace, by the aisle. Its long table has a chair for
 * every agent but the presenter (at least six), so the room grows with the crew, up to the
 * building's left wall: a TV on a stand at the table's left end, a whiteboard at its right.
 */
function meetingRoom(building: OfficeLayout['building'], agents: number): OfficeLayout['meetingRoom'] {
  const pairs = Math.max(3, Math.ceil((agents - 1) / 2))
  const x2 = -4.7
  const x1 = Math.max(building.minX + 1.6, x2 - (pairs * MEETING_SEAT_PITCH + 0.5))
  const table = { x1, x2, z: MEETING_TABLE_Z }
  const minX = Math.max(building.minX, x1 - 1.4)
  const whiteboard: Vec3 = [-3.75, 0, MEETING_TABLE_Z]
  // The first agent presents at the whiteboard; the others sit along both sides, nearest the
  // door first, alternating sides; any more stand along the lanes.
  const columns: number[] = []
  for (let x = table.x2 - 0.45; x >= table.x1 + 0.35; x -= MEETING_SEAT_PITCH) columns.push(x)
  const seated = columns.flatMap((x): Placement[] => [
    { position: [x, 0, table.z - 0.7], facing: 0, seated: true },
    { position: [x, 0, table.z + 0.7], facing: Math.PI, seated: true },
  ])
  const standing = columns.flatMap((x): Placement[] => [
    { position: [x, 0, MEETING_BACK_LANE_Z], facing: 0, seated: false },
    { position: [x, 0, MEETING_FRONT_LANE_Z], facing: Math.PI, seated: false },
  ])
  const presenter: Placement = { position: [whiteboard[0] - 0.5, 0, table.z], facing: -Math.PI / 2, seated: false, label: 'Presenting at the whiteboard' }
  return { minX, maxX: MEETING_ROOM_MAX_X, minZ: MEETING_ROOM_MIN_Z, maxZ: building.maxZ, table, tv: [x1 - 0.75, 0, table.z], whiteboard, seats: [presenter, ...seated, ...standing] }
}

/** The n-th place in the meeting room (0-based): the whiteboard, then the chairs, then standing room. */
export function meetingSeat(index: number, layout: OfficeLayout = DEFAULT_LAYOUT): Placement {
  const { seats } = layout.meetingRoom
  return seats[index % seats.length]
}

/**
 * Where a station stands: a desk (seat n uses desk n; desks have no names), a place at the
 * meeting table (`meetingIndex` counts the agents already there), or a lounge seat.
 */
export function placementFor(station: OfficeStation, layout: OfficeLayout = DEFAULT_LAYOUT, meetingIndex = 0): Placement {
  const seat = Math.max(station.seat, 1) - 1
  if (station.room === 'Lounge') {
    const [x, y, z] = LOUNGE_SEATS[seat % LOUNGE_SEATS.length]
    return { position: [x, y, z], facing: LOUNGE_FACING[seat % LOUNGE_SEATS.length], seated: true }
  }
  if (station.roomPosition === 'meeting-area') return meetingSeat(meetingIndex, layout)
  const [x, y, z] = layout.desks[seat % layout.desks.length]
  return { position: [x, y, z - 0.75], facing: 0, seated: station.state === 'Working' || station.state === 'Reviewing' }
}

const inGameRoom = ([x, z]: [number, number]) => x > GAME_ROOM.minX && x < GAME_ROOM.maxX && z > GAME_ROOM.minZ && z < GAME_ROOM.maxZ
const inLounge = ([x, z]: [number, number]) => x > 1.5 && x < 7.8 && z < -0.6

/**
 * Waypoints from one spot to another, so agents walk around furniture instead of through it:
 * inside along the aisle (lounge spots via the lounge lane), in or out through the entrance,
 * along the sidewalk, and up the gang's lane to the street food. The last point is always the
 * destination.
 */
export function walkPath(from: [number, number], to: [number, number], layout: OfficeLayout = DEFAULT_LAYOUT): [number, number][] {
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 0.3) return [to]
  return simplify(from, groundRoute(from, to, layout), to)
}

function groundRoute(from: [number, number], to: [number, number], layout: OfficeLayout): [number, number][] {
  const { building, sideLaneX } = layout
  const outside = (point: [number, number]) => point[1] > building.maxZ || point[0] < building.minX || (point[0] > building.maxX && !inGameRoom(point))
  const inGang = ([x]: [number, number]) => x < building.minX
  const route: [number, number][] = [from]
  const room = layout.meetingRoom
  const inMeetingRoom = ([x, z]: [number, number]) => x > room.minX && x < room.maxX && z > room.minZ && z < room.maxZ
  // In the meeting room: along the lane behind the chairs (or past the table's end) to the door.
  const meetingExit = ([x, z]: [number, number]): [number, number][] => x > room.table.x2 ? [[MEETING_DOOR_X, z], [MEETING_DOOR_X, AISLE_Z]]
    : z > room.table.z ? [[x, MEETING_FRONT_LANE_Z], [MEETING_DOOR_X, MEETING_FRONT_LANE_Z], [MEETING_DOOR_X, AISLE_Z]]
      : [[x, MEETING_BACK_LANE_Z], [MEETING_DOOR_X, MEETING_BACK_LANE_Z], [MEETING_DOOR_X, AISLE_Z]]
  const toAisle = (point: [number, number]): [number, number][] => inGameRoom(point) ? [[point[0], GAME_LANE_Z], [LOUNGE_LANE_X, GAME_LANE_Z], [LOUNGE_LANE_X, AISLE_Z]]
    : inLounge(point) ? [[LOUNGE_LANE_X, point[1]], [LOUNGE_LANE_X, AISLE_Z]] : inMeetingRoom(point) ? meetingExit(point) : [[point[0], AISLE_Z]]
  const toSidewalk = (point: [number, number]): [number, number][] => inGang(point) ? [[sideLaneX, point[1]], [sideLaneX, SIDEWALK_Z]] : [[point[0], SIDEWALK_Z]]
  if (!outside(from) && !outside(to)) {
    route.push(...toAisle(from), ...toAisle(to).reverse())
  } else if (inGang(from) && inGang(to)) {
    route.push([sideLaneX, from[1]], [sideLaneX, to[1]])
  } else if (outside(from) && outside(to)) {
    route.push(...toSidewalk(from), ...toSidewalk(to).reverse())
  } else if (outside(to)) {
    route.push(...toAisle(from), [ENTRANCE_X, AISLE_Z], [ENTRANCE_X, SIDEWALK_Z], ...toSidewalk(to).reverse())
  } else {
    route.push(...toSidewalk(from), [ENTRANCE_X, SIDEWALK_Z], [ENTRANCE_X, AISLE_Z], ...toAisle(to).reverse())
  }
  route.push(to)
  return route
}

/** Waypoints on lantai 2: along its aisle, into the bedroom between the bed columns, and out
 * through the sliding door onto the balcony. */
function upperRoute(from: [number, number], to: [number, number], layout: OfficeLayout): [number, number][] {
  const onBalcony = ([, z]: [number, number]) => z > BALCONY.minZ
  const doorX = (BALCONY_DOOR.fromX + BALCONY_DOOR.toX) / 2
  const inBedroom = ([x, z]: [number, number]) => x < PARTITION_X && z < -0.3
  // Beds share columns, so the back row is reached through the gap beside its column.
  const gapX = (x: number) => Math.min(x + DESK_PITCH / 2, PARTITION_X - 0.3)
  const toAisle = (point: [number, number]): [number, number][] => onBalcony(point) ? [[point[0], BALCONY_LANE_Z], [doorX, BALCONY_LANE_Z], [doorX, AISLE_Z]]
    : inBedroom(point) ? [[gapX(point[0]), point[1]], [gapX(point[0]), AISLE_Z]] : [[point[0], AISLE_Z]]
  void layout
  return [from, ...toAisle(from), ...toAisle(to).reverse(), to]
}

/**
 * Waypoints between any two spots, on either floor (y is the floor height). Changing floors goes
 * by the stairs: along the floor to the foot (or head) of the stairs, up (or down) them, and on.
 */
export function walkPath3(from: Vec3, to: Vec3, layout: OfficeLayout = DEFAULT_LAYOUT): Vec3[] {
  const flat = ([x, , z]: Vec3): [number, number] => [x, z]
  const at = (y: number) => ([x, z]: [number, number]): Vec3 => [x, y, z]
  const fromFloor = floorOf(from)
  const toFloor = floorOf(to)
  const route = (floor: Floor, a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.3 ? [b]
    : simplify(a, floor === 1 ? groundRoute(a, b, layout) : upperRoute(a, b, layout), b)
  if (fromFloor === toFloor) return route(fromFloor, flat(from), flat(to)).map(at(fromFloor === 1 ? 0 : FLOOR_HEIGHT)).map((point, index, all) => index === all.length - 1 ? to : point)
  const stairs: Vec3[] = [[STAIRS.lowX, 0, STAIRS.z], [STAIRS.highX, FLOOR_HEIGHT, STAIRS.z]]
  const up = fromFloor === 1
  return [
    ...route(fromFloor, flat(from), up ? STAIRS_FOOT : STAIRS_HEAD).map(at(up ? 0 : FLOOR_HEIGHT)),
    ...(up ? stairs : [...stairs].reverse()),
    ...route(toFloor, up ? STAIRS_HEAD : STAIRS_FOOT, flat(to)).map(at(up ? FLOOR_HEIGHT : 0)).slice(0, -1),
    to,
  ]
}

function simplify(from: [number, number], route: [number, number][], to: [number, number]): [number, number][] {
  // Drop waypoints that do not move the agent somewhere new, then any middle point of three on
  // one straight line (so going out to the aisle and straight back becomes one straight walk).
  const points: [number, number][] = [from]
  for (const point of route.slice(1)) {
    const last = points[points.length - 1]
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.2) points.push(point)
  }
  const aligned = (a: [number, number], b: [number, number], c: [number, number]) => (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(b[0] - c[0]) < 0.01) || (Math.abs(a[1] - b[1]) < 0.01 && Math.abs(b[1] - c[1]) < 0.01)
  for (let index = 1; index < points.length - 1;) {
    if (aligned(points[index - 1], points[index], points[index + 1])) points.splice(index, 1)
    else index += 1
  }
  const path = points.slice(1)
  if (path.length === 0 || path[path.length - 1] !== to) path.push(to)
  return path
}

/** How long an idle agent stays at one stop (walking included). */
export const IDLE_STOP_MS = 32_000
export const IDLE_ROUTE = ['lounge', 'galon', 'baca', 'balkon', 'gym', 'game', 'bakso', 'toilet', 'tidur', 'jalan', 'arcade', 'lesehan', 'gym', 'kopi', 'baca', 'toilet', 'dapur', 'balkon', 'game', 'tidur']

export interface IdleAssignment { stop: IdleStop; placement: Placement }

/**
 * Where each idle agent is at a given time. Purely decorative and deterministic (only the clock
 * and the seats matter, never agent data): each seat starts at a different point of the route, and
 * an agent whose stop is already full moves on along the route, so nobody shares a spot while
 * free ones remain.
 */
export function idlePlan(seats: number[], time: number, layout: OfficeLayout = DEFAULT_LAYOUT, sleepers: number[] = []): Map<number, IdleAssignment> {
  const plan = new Map<number, IdleAssignment>()
  const taken = new Map<string, number>()
  const step = Math.floor(time / IDLE_STOP_MS)
  const stopAt = (index: number) => layout.idleStops.find((item) => item.key === IDLE_ROUTE[index % IDLE_ROUTE.length])!
  // Sleepers (when the viewer sends idle agents to bed) stay in bed; they take the first beds.
  const beds = layout.idleStops.find((item) => item.key === 'tidur')!
  for (const seat of [...sleepers].sort((a, b) => a - b)) {
    const used = taken.get('tidur') ?? 0
    taken.set('tidur', used + 1)
    plan.set(seat, { stop: beds, placement: beds.spots[used % beds.spots.length] })
  }
  for (const seat of [...seats].filter((item) => !plan.has(item)).sort((a, b) => a - b)) {
    const start = step + (Math.max(seat, 1) - 1) * 3
    let stop = stopAt(start)
    for (let offset = 0; offset < IDLE_ROUTE.length; offset += 1) {
      const candidate = stopAt(start + offset)
      if ((taken.get(candidate.key) ?? 0) < candidate.spots.length) { stop = candidate; break }
    }
    const used = taken.get(stop.key) ?? 0
    taken.set(stop.key, used + 1)
    plan.set(seat, { stop, placement: stop.spots[used % stop.spots.length] })
  }
  return plan
}

/** One idle agent on its own. */
export function idleStop(seat: number, time: number, layout: OfficeLayout = DEFAULT_LAYOUT): IdleAssignment {
  return idlePlan([seat], time, layout).get(seat)!
}

/** Keeps a panned camera target inside the office grounds. */
export function clampTarget(x: number, z: number, bounds: OfficeLayout['pan'] = DEFAULT_LAYOUT.pan): [number, number] {
  return [Math.min(Math.max(x, bounds.minX), bounds.maxX), Math.min(Math.max(z, bounds.minZ), bounds.maxZ)]
}

/** The stock office (three agents), for callers that do not know the crew size. */
export const DEFAULT_LAYOUT = createLayout(3)
export const BUILDING = DEFAULT_LAYOUT.building
export const SIDE_LANE_X = DEFAULT_LAYOUT.sideLaneX
export const PAN_BOUNDS = DEFAULT_LAYOUT.pan
export const IDLE_STOPS = DEFAULT_LAYOUT.idleStops
export const DESKS = DEFAULT_LAYOUT.desks
