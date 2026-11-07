import { useEffect, useRef, useState } from 'react';
import { Game, gameRef } from '@/game/Game';
import { hasWebGL2 } from '@/game/engine/device';
import { useGame } from '@/stores/gameStore';
import MainMenu from '@/ui/menus/MainMenu';
import HUD from '@/ui/hud/HUD';
import TouchControls from '@/ui/touch/TouchControls';
import Shell from '@/ui/panels/Shell';
import { Logo } from '@/ui/Logo';

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<string | null>('Tayyorlanmoqda…');
  const [error, setError] = useState<string | null>(null);
  const screen = useGame((s) => s.screen);
  const panel = useGame((s) => s.panel);
  const touch = useGame((s) => s.device.touch);
  const btnScale = useGame((s) => s.settings.touchButtonScale);

  useEffect(() => {
    if (!hasWebGL2()) {
      setError('Brauzeringiz WebGL 2 ni qo‘llab-quvvatlamaydi. Chrome, Edge, Safari 15+ yoki Firefoxning yangi versiyasini oching.');
      return;
    }
    const g = new Game(canvas.current!);
    gameRef.current = g;
    let alive = true;
    g.init((s) => alive && setStep(s))
      .then(() => alive && setStep(null))
      .catch((e: unknown) => {
        console.error(e);
        setError('O‘yinni ishga tushirib bo‘lmadi: ' + String(e));
      });
    return () => {
      alive = false;
      g.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className={`game-root ${touch ? 'is-touch' : ''}`} style={{ ['--btn' as string]: btnScale }}>
      <canvas ref={canvas} className="game-canvas" tabIndex={0} />
      {!step && !error && screen === 'menu' && !panel && <MainMenu />}
      {!step && !error && screen === 'playing' && <HUD />}
      {!step && !error && screen === 'playing' && touch && !panel && <TouchControls />}
      {!step && !error && panel && <Shell />}
      {(step || error) && (
        <div className="loading">
          <div className="loading-inner">
            <Logo />
            {error ? (
              <p style={{ maxWidth: 420, marginTop: 24, color: '#ff9a92' }}>{error}</p>
            ) : (
              <>
                <div className="bar"><i /></div>
                <p>{step}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
