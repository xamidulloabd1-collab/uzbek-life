import { useGame } from '@/stores/gameStore';
import { ALL_ACHIEVEMENTS } from '@/systems/progress/achievements';
import { formatSom } from '@/utils/math';

export function ProgressPanel() {
  const got = useGame((s) => s.achievements);
  const events = useGame((s) => s.events);
  return (
    <>
      <h2 className="ptitle">Yutuqlar va voqealar</h2>
      <p className="psub">{got.length} / {ALL_ACHIEVEMENTS.length} yutuq ochildi. Ishlang, mulk oling, shaharni kezing — har bir yutuq pul mukofoti beradi.</p>
      <h3 style={{ margin: '10px 0 6px' }}>Hozirgi voqealar</h3>
      {events.length ? (
        <div className="grid2">{events.map((e, i) => <div key={i} className="card"><b>{e.title}</b><span className="k">{e.desc} · {e.left} daqiqa qoldi{e.place ? ' · GPS’da belgilangan' : ''}</span></div>)}</div>
      ) : <p className="psub">Hozircha voqea yo‘q. Shaharda vaqti-vaqti bilan nimadir yuz beradi.</p>}
      <h3 style={{ margin: '14px 0 6px' }}>Yutuqlar</h3>
      <div className="grid2">
        {ALL_ACHIEVEMENTS.map((a) => {
          const on = got.includes(a.id);
          return (
            <div key={a.id} className="card" style={{ opacity: on ? 1 : 0.62 }}>
              <b>{on ? '✓ ' : '○ '}{a.name}</b>
              <span className="k">{a.desc}{a.reward ? ` · +${formatSom(a.reward)}` : ''}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
