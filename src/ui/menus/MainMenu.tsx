import { gameRef } from '@/game/Game';
import { useGame } from '@/stores/gameStore';
import { Star } from '@/ui/Logo';
import { formatTime } from '@/utils/math';

export default function MainMenu() {
  const hasSave = useGame((s) => s.hasSave);
  const device = useGame((s) => s.device);
  const preset = useGame((s) => s.settings.preset);
  const setPanel = useGame((s) => s.setPanel);
  const start = (cont: boolean) => {
    const g = gameRef.current;
    if (!g) return;
    g.audio.unlock();
    if (cont) g.continueGame();
    else {
      if (hasSave && !window.confirm('Yangi o‘yin boshlansa, saqlangan o‘yin o‘chadi. Davom etasizmi?')) return;
      g.startNew();
    }
    if (device.mobile) {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
      try {
        if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
        else el.webkitRequestFullscreen?.();
      } catch {
        /* fullscreen not allowed (e.g. iPhone Safari) */
      }
    } else g.input.requestPointerLock();
  };
  const saved = hasSave ? (() => {
    try {
      const d = JSON.parse(localStorage.getItem('uzbek-life:save') ?? 'null');
      return d ? `${d.day}-kun, ${formatTime(d.minutes)}` : '';
    } catch {
      return '';
    }
  })() : '';
  return (
    <div className="menu">
      <div className="menu-col">
        <div className="logo">
          <Star />
          <h1>
            UZBEK LIFE
            <span>OPEN WORLD</span>
          </h1>
        </div>
        <p className="tagline">Shahringiz. Hikoyangiz. Hayotingiz.</p>
        <div className="menu-buttons">
          <button className="menu-btn primary" disabled={!hasSave} onClick={() => start(true)}>
            Davom etish
            <small>{hasSave ? saved : 'Saqlangan o‘yin yo‘q'}</small>
          </button>
          <button className="menu-btn" onClick={() => start(false)}>
            Yangi o‘yin
            <small>G‘uzorda hayotni noldan boshlang</small>
          </button>
          <button className="menu-btn" onClick={() => setPanel('settings')}>
            Sozlamalar
            <small>Grafika, boshqaruv, ovoz</small>
          </button>
          <button className="menu-btn" onClick={() => setPanel('credits')}>
            Mualliflar va litsenziyalar
          </button>
        </div>
        <div className="menu-foot">
          Grafika: <b>{preset}</b> · {device.mobile ? 'Mobil qurilma' : 'Kompyuter'} · {device.touch ? 'sensorli boshqaruv' : 'klaviatura va sichqoncha'}
          <br />
          Versiya 0.2 — ishlab chiqilmoqda (alfa)
        </div>
      </div>
    </div>
  );
}
