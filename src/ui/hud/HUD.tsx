import { useEffect, useRef } from 'react';
import { gameRef } from '@/game/Game';
import { useGame } from '@/stores/gameStore';
import { formatDistance, formatSomShort, formatTime } from '@/utils/math';

const WEATHER: Record<string, string> = { clear: 'Ochiq', cloudy: 'Bulutli', rain: 'Yomg‘ir', fog: 'Tuman' };

function LockGame() {
  const m = useGame((s) => s.hud.minigame);
  const touch = useGame((s) => s.device.touch);
  if (!m) return null;
  return (
    <div className="lockgame chip">
      <div className="title">QULFNI OCHISH · {m.tries} urinish</div>
      <div className="track"><i className="zone" style={{ left: `${m.zone[0] * 100}%`, width: `${(m.zone[1] - m.zone[0]) * 100}%` }} /><i className="needle" style={{ left: `${m.needle * 100}%` }} /></div>
      <div className="k">{touch ? 'Ko‘rsatkich yashil joyda bo‘lganda sariq tugmani bosing' : 'Ko‘rsatkich yashil joyda bo‘lganda E ni bosing'} · yurish — bekor qilish</div>
    </div>
  );
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const district = useGame((s) => s.hud.district);
  useEffect(() => {
    gameRef.current?.setMinimap(ref.current);
    return () => gameRef.current?.setMinimap(null);
  }, []);
  return (
    <>
      <div className="minimap-label">{district}</div>
      <div className="minimap-wrap">
        <canvas ref={ref} />
      </div>
    </>
  );
}

function Speedometer() {
  const h = useGame((s) => s.hud);
  if (!h.inVehicle) return null;
  const max = 220;
  const t = Math.min(1, h.speedKmh / max);
  const R = 80, cx = 100, cy = 100;
  const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  const arc = (from: number, to: number) => {
    const x0 = cx + Math.cos(from) * R, y0 = cy + Math.sin(from) * R;
    const x1 = cx + Math.cos(to) * R, y1 = cy + Math.sin(to) * R;
    return `M ${x0} ${y0} A ${R} ${R} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const rpmT = Math.min(1, h.rpm / 6500);
  const fuel = h.fuel / h.fuelMax;
  return (
    <div className="speedo chip" style={{ padding: 10 }}>
      <svg viewBox="0 0 200 150">
        <path d={arc(a0, a1)} stroke="rgba(237,230,216,0.12)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={arc(a0, a0 + (a1 - a0) * Math.max(0.001, t))} stroke="#2bb3c0" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={arc(a0, a0 + (a1 - a0) * Math.max(0.001, rpmT))} stroke={rpmT > 0.85 ? '#c8423b' : '#e9b44c'} strokeWidth="3" fill="none" transform="translate(100 100) scale(0.82) translate(-100 -100)" />
      </svg>
      <div className="num">{Math.round(h.speedKmh)}</div>
      <div className="unit">KM/S · {h.vehicleName}</div>
      <div className="gear">{h.gear}</div>
      <div className="vflags">
        <span className={h.signal === 'left' || h.signal === 'hazard' ? 'on amber' : ''}>◀</span>
        <span className={h.lights === 'on' ? 'on' : h.lights === 'off' ? 'off' : ''}>{h.lights === 'auto' ? 'A' : '◉'}</span>
        <span className={h.engineOn ? '' : 'off'}>⏻</span>
        <span className={h.signal === 'right' || h.signal === 'hazard' ? 'on amber' : ''}>▶</span>
      </div>
      <div className="owner">{h.vehicleOwner}</div>
      <div className="bars">
        <div className={`meter ${fuel < 0.15 ? 'low' : ''}`}>
          Yoqilg‘i {Math.round(h.fuel)} l
          <div><i style={{ width: `${fuel * 100}%` }} /></div>
        </div>
        <div className={`meter ${h.health < 30 ? 'low' : ''}`}>
          Holati {Math.round(h.health)}%
          <div><i style={{ width: `${h.health}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

function MissionCard() {
  const m = useGame((s) => s.mission);
  const h = useGame((s) => s.hud);
  const wp = h.waypointDistance;
  if (!m && wp === null) return null;
  const step = m?.steps[m.stepIndex];
  return (
    <div className="mission chip">
      {m && step ? (
        <>
          <div className="title">{m.title.toUpperCase()}</div>
          <div className="step">{step.label}</div>
          <div className="meta">
            {h.missionArrow !== null && (
              <svg className="arrow" viewBox="0 0 16 16" style={{ transform: `rotate(${-h.missionArrow}rad)` }}>
                <path d="M8 1 L14 14 L8 10 L2 14 Z" fill="currentColor" />
              </svg>
            )}
            {h.missionDistance !== null && <span>{formatDistance(h.missionDistance)}</span>}
            {h.navEta !== null && <span>· ~{Math.max(1, Math.round(h.navEta / 60))} daq</span>}
            <span>· {step.kind === 'work' ? 'ish' : step.kind === 'pickup' ? 'olish' : 'topshirish'}</span>
            {h.prompt && <span className="blocked">{h.prompt}</span>}
          </div>
          {h.navTurn && <div className="meta"><span>{h.navTurn}</span></div>}
          {h.missionHold > 0 && <div className="hold"><i style={{ width: `${Math.min(100, h.missionHold * 100)}%` }} /></div>}
        </>
      ) : (
        <>
          <div className="title">GPS MANZIL</div>
          <div className="step">{formatDistance(wp ?? 0)}{h.navEta !== null ? ` · ~${Math.max(1, Math.round(h.navEta / 60))} daq` : ''}</div>
          {h.navTurn && <div className="meta"><span>{h.navTurn}</span></div>}
        </>
      )}
    </div>
  );
}

export default function HUD() {
  const fadeOn = useGame((st) => st.fade);
  const cash = useGame((s) => s.cash);
  const bank = useGame((s) => s.bank);
  const minutes = useGame((s) => s.minutes);
  const day = useGame((s) => s.day);
  const weather = useGame((s) => s.weather);
  const notes = useGame((s) => s.notifications);
  const activity = useGame((s) => s.hud.activity);
  const inter = useGame((s) => s.hud.interaction);
  const vact = useGame((s) => s.hud.vehicleAction);
  const fps = useGame((s) => s.hud.fps);
  const showFps = useGame((s) => s.settings.showFps);
  const touch = useGame((s) => s.device.touch);
  const wanted = useGame((s) => s.wanted);
  const energy = useGame((s) => s.energy);
  return (
    <div className="hud">
      <div className={`screen-fade ${fadeOn ? 'on' : ''}`} />
      <div className="tl">
        <div className="chip status">
          <div className="name">Siz</div>
          <div className="act">{activity}</div>
          <div className={`energy ${energy < 25 ? 'low' : ''}`}>Kuch-quvvat<div><i style={{ width: `${energy}%` }} /></div></div>
        </div>
      </div>
      <div className="tr">
        <div className="chip money">
          <div className="cash">{formatSomShort(cash)} so‘m</div>
          <div className="bank">Bank: {formatSomShort(bank)}</div>
        </div>
        <div className="chip clock">
          <span>{formatTime(minutes)}</span>
          <span className="day">{day}-kun · {WEATHER[weather]}</span>
        </div>
        {wanted > 0 && <div className="chip wanted">{'★'.repeat(wanted)}<span>{'★'.repeat(3 - wanted)}</span></div>}
        {showFps && <div className="fps chip">{fps} FPS</div>}
        <div className="notes">
          {notes.map((n) => (
            <div key={n.id} className={`note ${n.kind}`}>{n.text}</div>
          ))}
        </div>
      </div>
      <MissionCard />
      <LockGame />
      <Minimap />
      <Speedometer />
      {inter && !touch && (
        <div className="prompt">
          <span className="key">E</span>
          {inter}
        </div>
      )}
      {vact && !touch && (
        <div className="prompt second">
          <span className="key">F</span>
          {vact}
        </div>
      )}
    </div>
  );
}
