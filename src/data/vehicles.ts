// src/data/vehicles.ts

export interface VehicleSpec {
  id: string;
  name: string;
  category: 'sedan' | 'suv' | 'commercial';
  price: number;
  topSpeed: number; // km/h
  acceleration: number; // 0-100 km/h
  weight: number; // kg
  fuelCapacity: number; // liters
  description: string;
}

export const UZBEK_VEHICLES: VehicleSpec[] = [
  {
    id: 'damas',
    name: 'Damas / Labo',
    category: 'commercial',
    price: 85000000,
    topSpeed: 110,
    acceleration: 14.5,
    weight: 950,
    fuelCapacity: 35,
    description: "Kichik biznes va yuk tashish uchun xalqona afsona."
  },
  {
    id: 'nexia_3',
    name: 'Nexia 3 (Ravon R3)',
    category: 'sedan',
    price: 110000000,
    topSpeed: 170,
    acceleration: 11.2,
    weight: 1065,
    fuelCapacity: 45,
    description: "Shahar ichida tezkor va tejamkor sedan."
  },
  {
    id: 'cobalt',
    name: 'Chevrolet Cobalt',
    category: 'sedan',
    price: 135000000,
    topSpeed: 175,
    acceleration: 10.5,
    weight: 1150,
    fuelCapacity: 50,
    description: "Keng yukxona va yumshoq osmaga ega avtomobil."
  },
  {
    id: 'gentra',
    name: 'Chevrolet Lacetti (Gentra)',
    category: 'sedan',
    price: 160000000,
    topSpeed: 180,
    acceleration: 10.0,
    weight: 1250,
    fuelCapacity: 60,
    description: "Qulaylik va barqarorlikni yoqtiruvchilar uchun ideal."
  },
  {
    id: 'tracker',
    name: 'Chevrolet Tracker 2',
    category: 'suv',
    price: 240000000,
    topSpeed: 190,
    acceleration: 9.2,
    weight: 1335,
    fuelCapacity: 50,
    description: "Zamonaviy krossover va shahar yo'ltanlamasi."
  }
];