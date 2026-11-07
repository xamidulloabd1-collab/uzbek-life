import { useGame } from '@/stores/gameStore';
import { PROPERTY_MAP } from '@/config/properties';
import { ECONOMY } from '@/config/economy';
import { earn, spend } from '@/systems/economy/economy';
import { formatSom } from '@/utils/math';

export const ownsProperty = (id: string) => useGame.getState().properties.includes(id);

export function buyProperty(id: string): boolean {
  const p = PROPERTY_MAP[id];
  if (!p || ownsProperty(id)) return false;
  if (!spend(p.price, `Ko‘chmas mulk: ${p.name}`, 'bank')) return false;
  useGame.setState({ properties: [...useGame.getState().properties, id] });
  useGame.getState().notify(`Tabriklaymiz! «${p.name}» endi sizniki`, 'good');
  return true;
}

export const propertySellPrice = (id: string) => Math.round((PROPERTY_MAP[id]?.price ?? 0) * ECONOMY.propertySellRatio);

export function sellProperty(id: string): boolean {
  const p = PROPERTY_MAP[id];
  if (!p || !ownsProperty(id)) return false;
  useGame.setState({ properties: useGame.getState().properties.filter((x) => x !== id) });
  earn(propertySellPrice(id), `Sotildi: ${p.name}`, 'bank');
  return true;
}

export const businessLevel = (id: string) => useGame.getState().businessLevels[id] ?? 0;

/** income grows 30% per upgrade level; running costs are a fixed share of base income */
export function businessFigures(id: string) {
  const p = PROPERTY_MAP[id];
  const lvl = businessLevel(id);
  const income = Math.round((p?.income ?? 0) * (1 + 0.3 * lvl));
  const expenses = Math.round((p?.income ?? 0) * ECONOMY.businessExpense * (1 + 0.1 * lvl));
  const upgradeCost = lvl < 3 ? Math.round(((p?.price ?? 0) * ECONOMY.businessUpgrade * (lvl + 1)) / 1000) * 1000 : null;
  return { lvl, income, expenses, net: income - expenses, upgradeCost };
}

export function upgradeBusiness(id: string) {
  const f = businessFigures(id);
  if (!ownsProperty(id) || f.upgradeCost === null) return false;
  if (!spend(f.upgradeCost, `Biznesni kengaytirish: ${PROPERTY_MAP[id].name}`, 'bank')) return false;
  useGame.setState({ businessLevels: { ...useGame.getState().businessLevels, [id]: f.lvl + 1 } });
  useGame.getState().notify(`${PROPERTY_MAP[id].name}: ${f.lvl + 1}-daraja`, 'good');
  return true;
}

export const dailyIncome = () =>
  useGame.getState().properties.reduce((sum, id) => sum + (PROPERTY_MAP[id]?.income ? businessFigures(id).net : 0), 0);

/** called by the game clock when a new day starts */
export function payDailyIncome() {
  const income = dailyIncome();
  if (income > 0) {
    earn(income, 'Biznes daromadi', 'bank');
    useGame.getState().notify(`Bizneslaringizdan ${formatSom(income)} daromad tushdi`, 'good');
  }
}
