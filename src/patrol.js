import { yard, districts } from "./yard-layout.js";
// Checkpoints are in world coordinates. Each guard returns to its own circuit
// after inspecting the last place it saw the player.
export const circuits = [
  [
    [2, -16],
    [-3, -15],
    [-3, -9],
    [-1, -5],
    [8.8, -10],
    [9, -16],
  ],
  [
    [-15.5, -10.8],
    [-15, -1],
    [-13, 0],
    [-4, 0],
    [-3, -11],
    [-14, -11],
  ],
  [
    [15.3, 3.5],
    [13.3, 6],
    [5, 5],
    [5, 12.6],
    [6, 16],
    [18, 16],
    [18, 4],
  ],
];
// Outer patrols follow the service road around each facility.
circuits.push(
  ...districts.map(({ x, z, kind }) =>
    kind === "camp"
      ? [
          [-1, -38],
          [-1, -48],
          [6, -50],
          [7, -44],
          [11, -38],
        ]
      : [
          [x - 17, z - 17],
          [x + 16, z - 17],
          [x + 16, z + 11],
          [x + 6, z + 18],
          [x - 17, z + 12],
        ],
  ),
);
export const arrivals = [
  [-62, -67],
  [61, -66],
  [62, 66],
  [-62, 66],
  [0, -67],
  [0, 67],
];

export function createNavigation(blocked) {
  const nodes = [],
    grid = new Map(),
    key = (x, z) => x + z * (yard.east - yard.west + 3);
  function clear(ax, az, bx, bz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.32));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (blocked(ax + (bx - ax) * t, az + (bz - az) * t, 0.45)) return false;
    }
    return true;
  }
  for (let z = yard.north + 1; z < yard.south; z++)
    for (let x = yard.west + 1; x < yard.east; x++) {
      if (blocked(x, z, 0.49)) continue;
      const node = { x, z, links: [], id: nodes.length };
      nodes.push(node);
      grid.set(key(x, z), node);
    }
  for (const node of nodes)
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const other = grid.get(key(node.x + dx, node.z + dz));
        if (other && other !== node && clear(node.x, node.z, other.x, other.z))
          node.links.push(other);
      }
  function nearest(x, z) {
    const snapped = grid.get(key(Math.round(x), Math.round(z)));
    if (snapped && clear(x, z, snapped.x, snapped.z)) return snapped;
    let best = null,
      distance = Infinity;
    for (const node of nodes) {
      const d = (node.x - x) ** 2 + (node.z - z) ** 2;
      if (d < distance && clear(x, z, node.x, node.z)) {
        best = node;
        distance = d;
      }
    }
    return best;
  }
  return function findPath(from, x, z) {
    if (clear(from.x, from.z, x, z)) return [{ x, z }];
    const start = nearest(from.x, from.z),
      goal = nearest(x, z);
    if (!start || !goal) return [];
    const parent = new Int16Array(nodes.length).fill(-1),
      queue = [start];
    parent[start.id] = start.id;
    for (let i = 0; i < queue.length && parent[goal.id] === -1; i++) {
      for (const next of queue[i].links) {
        if (parent[next.id] !== -1) continue;
        parent[next.id] = queue[i].id;
        queue.push(next);
      }
    }
    if (parent[goal.id] === -1) return [];
    const path = [{ x, z }];
    for (let n = goal; ; n = nodes[parent[n.id]]) {
      path.push(n);
      if (n === start) break;
    }
    path.reverse();
    // Remove grid corners when a body-width straight segment is walkable.
    const smooth = [];
    let a = from;
    for (let i = 0; i < path.length; i++) {
      while (
        i + 1 < path.length &&
        clear(a.x, a.z, path[i + 1].x, path[i + 1].z)
      )
        i++;
      a = path[i];
      smooth.push(a);
    }
    return smooth;
  };
}
