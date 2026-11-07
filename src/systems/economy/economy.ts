import { useGame } from '@/stores/gameStore';
import { formatSom, uid } from '@/utils/math';

type Account = 'cash' | 'bank';

function record(amount: number, label: string) {
  const s = useGame.getState();
  const t = { id: uid(), day: s.day, minutes: s.minutes, amount, label };
  useGame.setState({ transactions: [t, ...s.transactions].slice(0, 60) });
}

export const totalFunds = () => {
  const s = useGame.getState();
  return s.cash + s.bank;
};

export const canAfford = (amount: number) => amount <= totalFunds();

/**
 * Pay `amount`. Uses the preferred account first, then the other one.
 * Returns false (and changes nothing) if the player cannot afford it.
 */
export function spend(amount: number, label: string, prefer: Account = 'cash'): boolean {
  if (!Number.isFinite(amount) || amount < 0) return false;
  const s = useGame.getState();
  if (amount > s.cash + s.bank) {
    s.notify(`Mablag‘ yetarli emas: ${formatSom(amount)} kerak`, 'bad');
    return false;
  }
  let cash = s.cash;
  let bank = s.bank;
  let rest = amount;
  const take = (acc: Account) => {
    const have = acc === 'cash' ? cash : bank;
    const used = Math.min(have, rest);
    if (acc === 'cash') cash -= used;
    else bank -= used;
    rest -= used;
  };
  take(prefer);
  take(prefer === 'cash' ? 'bank' : 'cash');
  useGame.setState({ cash, bank });
  record(-amount, label);
  return true;
}

export function earn(amount: number, label: string, to: Account = 'cash') {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const s = useGame.getState();
  useGame.setState(to === 'cash' ? { cash: s.cash + amount } : { bank: s.bank + amount });
  record(amount, label);
}

export function deposit(amount: number): boolean {
  const s = useGame.getState();
  if (amount <= 0 || amount > s.cash) return false;
  useGame.setState({ cash: s.cash - amount, bank: s.bank + amount });
  return true;
}

export function withdraw(amount: number): boolean {
  const s = useGame.getState();
  if (amount <= 0 || amount > s.bank) return false;
  useGame.setState({ cash: s.cash + amount, bank: s.bank - amount });
  return true;
}
