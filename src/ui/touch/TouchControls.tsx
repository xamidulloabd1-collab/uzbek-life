import { useRef, useState } from 'react';
import { gameRef } from '@/game/Game';
import type { ButtonId } from '@/game/input/InputManager';
import { useGame } from '@/stores/gameStore';

/** Full touchscreen control scheme: floating joystick, drag-to-look, context buttons */
export default function TouchControls() {
  const inVehicle = useGame((s) => s.hud.inVehicle);
  const inter = useGame((s) => s.hud.interaction);
  const vact = useGame((s) => s.hud.vehicleAction);
  const setPanel = useGame((s) => s.setPanel);
  const [joy, setJoy] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const joyId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const [sprint, setSprint] = useState(false);
  const input = () => gameRef.current?.input;

  const joyDown = (e: React.PointerEvent) => {
    if (joyId.current !== null) return;
    joyId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setJoy({ x: e.clientX, y: e.clientY, kx: e.clientX, ky: e.clientY });
  };
  const joyMove = (e: React.PointerEvent) => {
    if (e.pointerId !== joyId.current || !joy) return;
    const R = 60;
    let dx = e.clientX - joy.x, dy = e.clientY - joy.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setJoy({ ...joy, kx: joy.x + dx, ky: joy.y + dy });
    input()?.setJoystick(dx / R, -dy / R);
  };
  const joyUp = (e: React.PointerEvent) => {
    if (e.pointerId !== joyId.current) return;
    joyId.current = null;
    setJoy(null);
    input()?.setJoystick(0, 0);
  };
  const lookDown = (e: React.PointerEvent) => {
    if (lookId.current !== null) return;
    lookId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const lookMove = (e: React.PointerEvent) => {
    if (e.pointerId !== lookId.current) return;
    input()?.addLook((e.clientX - lookLast.current.x) * 1.6, (e.clientY - lookLast.current.y) * 1.6);
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const lookUp = (e: React.PointerEvent) => {
    if (e.pointerId === lookId.current) lookId.current = null;
  };
  const hold = (id: ButtonId) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      input()?.setButton(id, true);
    },
    onPointerUp: () => input()?.setButton(id, false),
    onPointerCancel: () => input()?.setButton(id, false),
  });
  const tap = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      fn();
    },
  });

  return (
    <div className="touch" onContextMenu={(e) => e.preventDefault()}>
      <div className="look" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />
      <div className="joyzone" onPointerDown={joyDown} onPointerMove={joyMove} onPointerUp={joyUp} onPointerCancel={joyUp} />
      {joy && (
        <>
          <div className="joy-base" style={{ left: joy.x, top: joy.y }} />
          <div className="joy-knob" style={{ left: joy.kx, top: joy.ky }} />
        </>
      )}
      <div className="ttop">
        <button {...tap(() => setPanel('map'))} aria-label="Xarita">M</button>
        <button {...tap(() => setPanel('phone'))} aria-label="Telefon">☎</button>
        <button {...tap(() => setPanel('pause'))} aria-label="Pauza">II</button>
        {inVehicle && <button {...tap(() => input()?.press('horn'))} aria-label="Signal">♪</button>}
        {inVehicle && <button {...tap(() => input()?.press('lights'))} aria-label="Faralar">◉</button>}
        {inVehicle && <button {...tap(() => input()?.press('signalLeft'))} aria-label="Chapga burilish">◀</button>}
        {inVehicle && <button {...tap(() => input()?.press('signalRight'))} aria-label="O‘ngga burilish">▶</button>}
      </div>
      <div className="tbtns">
        {inVehicle ? (
          <>
            <button className="tbtn" {...tap(() => gameRef.current?.toggleCamera())}>Kamera</button>
            {vact ? <button className="tbtn act" {...tap(() => gameRef.current?.pressVehicleAction())}>{vact.split(' ')[0]}</button> : <span />}
            <button className="tbtn" {...tap(() => gameRef.current?.pressInteract())}>Chiqish</button>
            <button className="tbtn" {...hold('handbrake')}>Qo‘l tormoz</button>
            <button className="tbtn big brake" {...hold('brake')}>Tormoz</button>
            <button className="tbtn big gas" {...hold('accelerate')}>Gaz</button>
          </>
        ) : (
          <>
            <span />
            <span />
            {inter ? <button className="tbtn act" {...tap(() => gameRef.current?.pressInteract())}>{inter.length > 14 ? inter.slice(0, 13) + '…' : inter}</button> : <span />}
            <button className={`tbtn ${sprint ? 'on' : ''}`} {...tap(() => {
              setSprint(!sprint);
              input()?.setButton('sprint', !sprint);
            })}>Yugurish</button>
            <span />
            <button className="tbtn big" {...tap(() => input()?.press('jump'))}>Sakrash</button>
          </>
        )}
      </div>
    </div>
  );
}
