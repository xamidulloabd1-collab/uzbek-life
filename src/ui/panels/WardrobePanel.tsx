import { useGame } from '@/stores/gameStore';
import { gameRef } from '@/game/Game';
import { formatSom } from '@/utils/math';

export const CLOTHES = [
  { id: 'doppi', name: 'Qora do‘ppi', slot: 'hat', price: 60_000 },
  { id: 'doppi-oq', name: 'Oq do‘ppi', slot: 'hat', price: 75_000 },
  { id: 'kepka', name: 'Kepka', slot: 'hat', price: 45_000 },
  { id: 'glasses', name: 'Quyosh ko‘zoynagi', slot: 'glasses', price: 90_000 },
] as const;

/** wardrobe / shop: the bought items are real meshes on the character (Player.setAccessories) */
export function WardrobePanel() {
  const wardrobe = useGame((s) => s.wardrobe);
  const outfit = useGame((s) => s.outfit);
  const cash = useGame((s) => s.cash);
  const panelArg = useGame((s) => s.panelArg);
  const shop = panelArg === 'shop';
  const wear = (o: { hat: string; glasses: boolean }) => {
    useGame.setState({ outfit: o });
    gameRef.current?.player.setAccessories(o);
  };
  return (
    <>
      <h2 className="ptitle">{shop ? 'Kiyim va aksessuarlar do‘koni' : 'Kiyim javoni'}</h2>
      <p className="psub">Tanlangan buyum personajingizda darhol ko‘rinadi. Ko‘ylak va shimni almashtirish uchun modulli personaj modeli kerak — bu hali yo‘q (KNOWN_LIMITATIONS).</p>
      <div className="grid2">
        {CLOTHES.map((c) => {
          const owned = wardrobe.includes(c.id);
          const worn = c.slot === 'hat' ? outfit.hat === c.id : outfit.glasses;
          return (
            <div key={c.id} className="card">
              <b>{c.name}</b>
              <span className="k">{owned ? (worn ? 'Kiyilgan' : 'Sizda bor') : formatSom(c.price)}</span>
              {owned ? (
                <button className="btn" onClick={() => wear(c.slot === 'hat' ? { ...outfit, hat: worn ? 'none' : c.id } : { ...outfit, glasses: !worn })}>{worn ? 'Yechish' : 'Kiyish'}</button>
              ) : shop ? (
                <button className="btn" disabled={cash < c.price} onClick={() => {
                  useGame.setState({ cash: useGame.getState().cash - c.price, wardrobe: [...wardrobe, c.id] });
                  wear(c.slot === 'hat' ? { ...outfit, hat: c.id } : { ...outfit, glasses: true });
                  useGame.getState().notify(`${c.name} sotib olindi`, 'good');
                }}>Sotib olish</button>
              ) : <span className="k">Bozor do‘konida sotiladi</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
