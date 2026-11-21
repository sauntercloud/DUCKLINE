// The fence is half a metre beyond the movement limit on each side.
export const yard = { west: -66, east: 66, north: -72, south: 72 };
export const districts = [
  { x: -43, z: -48, kind: "rail", name: "北线编组站", code: "R–01" },
  { x: 0, z: -48, kind: "camp", name: "北坡哨营", code: "CAMP–02" },
  { x: 43, z: -48, kind: "gantry", name: "东区装卸台", code: "G–03" },
  { x: -43, z: 0, kind: "tank", name: "西区储罐站", code: "T–04" },
  { x: 43, z: 0, kind: "store", name: "海关监管仓", code: "C–05" },
  { x: -43, z: 48, kind: "gantry", name: "西南吊装区", code: "E–06" },
  { x: 0, z: 48, kind: "rail", name: "南线编组站", code: "R–07" },
  { x: 43, z: 48, kind: "tank", name: "南区泵站", code: "P–08" },
];
