import { create } from 'zustand';
import type {
  ActiveMission,
  CargoItem,
  DeviceInfo,
  HudState,
  Notification,
  OwnedVehicle,
  PanelId,
  Settings,
  Transaction,
  Vec2,
  WeatherKind,
} from '@/types';
import { detectDevice } from '@/game/engine/device';
import { recommendedPreset, settingsFromPreset } from '@/config/graphics';
import { hasSave, readSettings, writeSettings } from '@/systems/save/save';
import { uid } from '@/utils/math';

export interface GameStore {
  screen: 'menu' | 'playing';
  panel: PanelId;
  panelArg: string | null;
  cash: number;
  bank: number;
  transactions: Transaction[];
  vehicles: OwnedVehicle[];
  activeVehicleUid: string | null;
  properties: string[];
  cargo: CargoItem[];
  mission: ActiveMission | null;
  jobStats: Record<string, number>;
  waypoint: Vec2 | null;
  day: number;
  minutes: number;
  weather: WeatherKind;
  settings: Settings;
  device: DeviceInfo;
  notifications: Notification[];
  hud: HudState;
  hasSave: boolean;
  lastSaved: number | null;
  /** bumps whenever the GLB library changes (UI refresh) */
  assetsVersion: number;
  /** fictional wanted level 0–3 */
  wanted: number;
  /** 0–100, drops over time, restored by eating */
  energy: number;
  businessLevels: Record<string, number>;
  setPanel: (p: PanelId, arg?: string | null) => void;
  notify: (text: string, kind?: Notification['kind']) => void;
  dismiss: (id: string) => void;
  setHud: (p: Partial<HudState>) => void;
  updateSettings: (p: Partial<Settings>) => void;
}

const device = detectDevice();

export const INITIAL_HUD: HudState = {
  inVehicle: false,
  vehicleName: '',
  speedKmh: 0,
  gear: 'N',
  rpm: 0,
  fuel: 0,
  fuelMax: 1,
  health: 100,
  prompt: null,
  district: '',
  activity: 'Piyoda',
  fps: 0,
  missionDistance: null,
  missionHold: 0,
  missionArrow: null,
  waypointDistance: null,
  interaction: null,
  vehicleAction: null,
  vehicleOwner: '',
  lights: 'auto',
  signal: 'none',
  engineOn: true,
  minigame: null,
};

export const useGame = create<GameStore>((set, get) => ({
  screen: 'menu',
  panel: null,
  panelArg: null,
  cash: 0,
  bank: 0,
  transactions: [],
  vehicles: [],
  activeVehicleUid: null,
  properties: [],
  cargo: [],
  mission: null,
  jobStats: {},
  waypoint: null,
  day: 1,
  minutes: 510,
  weather: 'clear',
  settings: readSettings() ?? settingsFromPreset(recommendedPreset(device)),
  device,
  notifications: [],
  hud: INITIAL_HUD,
  hasSave: hasSave(),
  lastSaved: null,
  assetsVersion: 0,
  wanted: 0,
  energy: 100,
  businessLevels: {},
  setPanel: (panel, arg = null) => set({ panel, panelArg: arg }),
  notify: (text, kind = 'info') => {
    const n: Notification = { id: uid(), text, kind, at: performance.now() };
    set({ notifications: [...get().notifications.slice(-3), n] });
    window.setTimeout(() => get().dismiss(n.id), 4200);
  },
  dismiss: (id) => set({ notifications: get().notifications.filter((n) => n.id !== id) }),
  setHud: (p) => set({ hud: { ...get().hud, ...p } }),
  updateSettings: (p) => {
    const settings = { ...get().settings, ...p };
    writeSettings(settings);
    set({ settings });
  },
}));

export const getGame = () => useGame.getState();
