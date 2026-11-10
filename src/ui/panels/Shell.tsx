import { WardrobePanel } from './WardrobePanel';
import { ProgressPanel } from './ProgressPanel';
import { useState } from 'react';
import type { PanelId } from '@/types';
import { useGame } from '@/stores/gameStore';
import { gameRef } from '@/game/Game';
import { callVehicle } from '@/systems/vehicles/vehicleService';
import { ECONOMY } from '@/config/economy';
import { formatSom, formatTime } from '@/utils/math';
import { AssetLabPanel } from './AssetLab';
import { MapPanel, JobsPanel, GaragePanel, DealershipPanel, PropertiesPanel, BankPanel, InventoryPanel, SettingsPanel, CreditsPanel } from './panels';

type Tab = Exclude<PanelId, null | 'pause' | 'phone'>;
const TABS: { id: Tab; name: string; ic: string }[] = [
  { id: 'map', name: 'Xarita', ic: 'X' },
  { id: 'progress', name: 'Yutuqlar', ic: 'Y' },
  { id: 'jobs', name: 'Ishlar', ic: 'I' },
  { id: 'garage', name: 'Garaj', ic: 'G' },
  { id: 'dealership', name: 'Avtosalon', ic: 'A' },
  { id: 'properties', name: 'Ko‘chmas mulk', ic: 'M' },
  { id: 'bank', name: 'Bank', ic: 'B' },
  { id: 'inventory', name: 'Inventar', ic: 'N' },
  { id: 'settings', name: 'Sozlamalar', ic: 'S' },
  { id: 'assets', name: '3D modellar', ic: '3D' },
];

function Content({ tab }: { tab: Tab | 'home' }) {
  switch (tab) {
    case 'map': return <MapPanel />;
    case 'jobs': return <JobsPanel />;
    case 'garage': return <GaragePanel />;
    case 'dealership': return <DealershipPanel />;
    case 'properties': return <PropertiesPanel />;
    case 'bank': return <BankPanel />;
    case 'inventory': return <InventoryPanel />;
    case 'settings': return <SettingsPanel />;
    case 'credits': return <CreditsPanel />;
    case 'assets': return <AssetLabPanel />;
    case 'progress': return <ProgressPanel />;
    case 'wardrobe': return <WardrobePanel />;
    default: return <Home />;
  }
}

function Home() {
  const s = useGame();
  const g = gameRef.current;
  return (
    <>
      <h2 className="ptitle">Pauza</h2>
      <p className="psub">{s.day}-kun, {formatTime(s.minutes)} · {s.hud.district}</p>
      <div className="grid2">
        <div className="card"><span className="k">Naqd</span><span className="price">{formatSom(s.cash)}</span></div>
        <div className="card"><span className="k">Bank</span><span className="price">{formatSom(s.bank)}</span></div>
        <div className="card"><span className="k">Mashinalar</span><h3>{s.vehicles.length}</h3></div>
        <div className="card"><span className="k">Mulklar</span><h3>{s.properties.length}</h3></div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={() => s.setPanel(null)}>Davom etish</button>
        <button className="btn" onClick={() => g?.saveNow(true)}>O‘yinni saqlash</button>
        <button className="btn danger" onClick={() => g?.exitToMenu()}>Bosh menyuga</button>
      </div>
      {s.lastSaved && <p className="psub" style={{ marginTop: 10 }}>Oxirgi saqlash: {new Date(s.lastSaved).toLocaleTimeString()}</p>}
    </>
  );
}

export default function Shell() {
  const panel = useGame((s) => s.panel);
  const screen = useGame((s) => s.screen);
  const setPanel = useGame((s) => s.setPanel);
  const minutes = useGame((s) => s.minutes);
  const isPhone = panel === 'phone';
  const [phoneTab, setPhoneTab] = useState<Tab | 'home'>('jobs');
  const close = () => setPanel(null);

  if (screen === 'menu') {
    return (
      <div className="shell-bg" onPointerDown={(e) => e.target === e.currentTarget && close()}>
        <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
          <div className="content">
            <button className="close-x" onClick={close} aria-label="Yopish">✕</button>
            <Content tab={panel === 'credits' ? 'credits' : 'settings'} />
          </div>
        </div>
      </div>
    );
  }

  if (isPhone) {
    const apps: { id: Tab | 'call'; name: string; ic: string }[] = [
      { id: 'jobs', name: 'Ishlar', ic: 'I' },
      { id: 'map', name: 'GPS', ic: 'X' },
      { id: 'bank', name: 'Bank', ic: 'B' },
      { id: 'properties', name: 'Mulk', ic: 'M' },
      { id: 'garage', name: 'Garaj', ic: 'G' },
      { id: 'inventory', name: 'Inventar', ic: 'N' },
      { id: 'call', name: 'Taksi-evak.', ic: '↯' },
      { id: 'settings', name: 'Sozlama', ic: 'S' },
    ];
    return (
      <div className="shell-bg" onPointerDown={(e) => e.target === e.currentTarget && close()}>
        <div className="shell phone">
          <div className="phone-top"><span>{formatTime(minutes)}</span><span>UzMobile 5G</span></div>
          <div className="content">
            <button className="close-x" onClick={close} aria-label="Yopish">✕</button>
            <Content tab={phoneTab} />
          </div>
          <div className="phone-apps">
            {apps.map((a) => (
              <button key={a.id} className={phoneTab === a.id ? 'on' : ''} onClick={() => {
                if (a.id === 'call') {
                  if (window.confirm(`Mashinangizni yoningizga keltirish: ${formatSom(ECONOMY.vehicleDelivery)}`)) callVehicle();
                } else setPhoneTab(a.id);
              }}>
                <span className="ic">{a.ic}</span>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tab: Tab | 'home' = panel === 'pause' ? 'home' : (panel as Tab);
  return (
    <div className="shell-bg" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="shell">
        <nav>
          <div className="brand">UZBEK <span>LIFE</span></div>
          <button className={`navbtn ${tab === 'home' ? 'on' : ''}`} onClick={() => setPanel('pause')}><span className="ic">II</span>Pauza</button>
          {TABS.map((t) => (
            <button key={t.id} className={`navbtn ${tab === t.id ? 'on' : ''}`} onClick={() => setPanel(t.id)}><span className="ic">{t.ic}</span>{t.name}</button>
          ))}
          <div className="navsep" />
          <button className={`navbtn ${tab === 'credits' ? 'on' : ''}`} onClick={() => setPanel('credits')}><span className="ic">©</span>Litsenziyalar</button>
        </nav>
        <div className="content">
          <button className="close-x" onClick={close} aria-label="Yopish">✕</button>
          <Content tab={tab} />
        </div>
      </div>
    </div>
  );
}
