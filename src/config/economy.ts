/** Every price in the game lives here — never hard-code money in components. */
export const ECONOMY = {
  /** starting from almost nothing: ≈ $75 in cash, empty bank account */
  startCash: 1_000_000_000,
  startBank: 0,
  /** starter car handed down in the family */
  starterVehicle: 'lola',
  starterPlate: '70 A 707 GZ',
  fuelPricePerLiter: 11_500,
  repairPerPoint: 42_000,
  paint: 1_600_000,
  wheels: [0, 2_200_000, 3_400_000, 6_500_000],
  tint: 900_000,
  customPlate: 2_500_000,
  engineUpgrade: [0, 6_500_000, 13_000_000, 24_000_000],
  handlingUpgrade: [0, 4_500_000, 9_500_000, 17_000_000],
  sellRatio: 0.6,
  vehicleDelivery: 120_000,
  propertySellRatio: 0.75,
  foodOsh: 35_000,
  foodBazaar: 18_000,
  /** fictional paperwork to keep an NPC car you are driving (share of its price) */
  registerRatio: 0.7,
  /** business: daily running costs as a share of base income, upgrade cost as a share of price */
  businessExpense: 0.35,
  businessUpgrade: 0.15,
  jobs: {
    taxiBase: 14_000,
    taxiPerMeter: 55,
    deliveryBase: 22_000,
    deliveryPerMeter: 35,
    courierPerDrop: 38_000,
    mechanicFix: 160_000,
    farmerHarvest: 210_000,
    cargoPerMeter: 70,
    workshopShift: 240_000,
    speedBonus: 0.25,
  },
} as const;

export const TIME = {
  /** game minutes per real second */
  minutesPerSecond: 1,
  startMinutes: 8 * 60 + 30,
  autosaveSeconds: 60,
} as const;
