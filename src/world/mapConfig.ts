// src/world/mapConfig.ts

export interface Zone {
  id: string;
  name: string;
  type: 'city_center' | 'mahalla' | 'highway' | 'industrial';
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  speedLimit: number; // km/h
  description: string;
}

export const UZBEK_LIFE_MAP_ZONES: Zone[] = [
  {
    id: 'guzor_center',
    name: "G'uzor Shahar Markazi",
    type: 'city_center',
    bounds: { minX: -500, maxX: 500, minZ: -500, maxZ: 500 },
    speedLimit: 60,
    description: "Markaziy bozor, hokimiyat binosi, do'konlar va gavjum ko'chalar."
  },
  {
    id: 'mahalla_obod',
    name: "Obod Mahallasi",
    type: 'mahalla',
    bounds: { minX: -1500, maxX: -500, minZ: -500, maxZ: 500 },
    speedLimit: 40,
    description: "An'anaviy uylar, tor ko'chalar va tinch muhit."
  },
  {
    id: 'industrial_zone',
    name: "G'uzor Sanoat Zonasi",
    type: 'industrial',
    bounds: { minX: 500, maxX: 1500, minZ: -500, maxZ: 500 },
    speedLimit: 70,
    description: "Zavodlar, omborxonalar va yuk mashinalari harakatlanish hududi."
  },
  {
    id: 'highway_m39',
    name: "M-39 Magistral Yo'li",
    type: 'highway',
    bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: -1500 },
    speedLimit: 100,
    description: "Shaharlararo tezkor harakatlanish uchun katta yo'l."
  }
];

export interface RoadNode {
  id: string;
  x: number;
  z: number;
  connections: string[];
}

export const MAIN_ROAD_NETWORK: RoadNode[] = [
  { id: 'node_center', x: 0, z: 0, connections: ['node_north', 'node_south', 'node_east', 'node_west'] },
  { id: 'node_north', x: 0, z: -1000, connections: ['node_center', 'node_highway'] },
  { id: 'node_south', x: 0, z: 1000, connections: ['node_center'] },
  { id: 'node_east', x: 1000, z: 0, connections: ['node_center'] },
  { id: 'node_west', x: -1000, z: 0, connections: ['node_center'] },
  { id: 'node_highway', x: 0, z: -1750, connections: ['node_north'] }
];