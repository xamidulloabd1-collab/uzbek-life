// src/store/gameStore.ts

import { create } from 'zustand';

export interface PlayerStats {
  money: number;
  bankAccount: number;
  job: string | null;
  salary: number;
  hunger: number;
  energy: number;
  currentVehicle: string | null;
  ownedVehicles: string[];
  ownedProperties: string[];
}

interface GameState extends PlayerStats {
  setMoney: (amount: number) => void;
  addMoney: (amount: number) => void;
  subtractMoney: (amount: number) => boolean;
  setJob: (jobName: string, salary: number) => void;
  buyVehicle: (vehicleId: string, price: number) => boolean;
  buyProperty: (propertyId: string, price: number) => boolean;
  updateNeeds: (hungerDelta: number, energyDelta: number) => void;
  setCurrentVehicle: (vehicleId: string | null) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  money: 500000, // Boshlang'ich so'm (masalan, 500,000 so'm)
  bankAccount: 1500000,
  job: null,
  salary: 0,
  hunger: 100,
  energy: 100,
  currentVehicle: 'nexia_3',
  ownedVehicles: ['nexia_3'],
  ownedProperties: ['starter_flat'],

  setMoney: (amount) => set({ money: amount }),

  addMoney: (amount) => set((state) => ({ money: state.money + amount })),

  subtractMoney: (amount) => {
    const state = get();
    if (state.money >= amount) {
      set({ money: state.money - amount });
      return true;
    }
    return false;
  },

  setJob: (jobName, salary) => set({ job: jobName, salary }),

  buyVehicle: (vehicleId, price) => {
    const state = get();
    if (state.money >= price && !state.ownedVehicles.includes(vehicleId)) {
      set({
        money: state.money - price,
        ownedVehicles: [...state.ownedVehicles, vehicleId]
      });
      return true;
    }
    return false;
  },

  buyProperty: (propertyId, price) => {
    const state = get();
    if (state.money >= price && !state.ownedProperties.includes(propertyId)) {
      set({
        money: state.money - price,
        ownedProperties: [...state.ownedProperties, propertyId]
      });
      return true;
    }
    return false;
  },

  updateNeeds: (hungerDelta, energyDelta) => set((state) => ({
    hunger: Math.max(0, Math.min(100, state.hunger + hungerDelta)),
    energy: Math.max(0, Math.min(100, state.energy + energyDelta))
  })),

  setCurrentVehicle: (vehicleId) => set({ currentVehicle: vehicleId })
}));