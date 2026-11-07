import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/stores/gameStore';
import { gameRef } from '@/game/Game';
import { MapRenderer, type MapMarker } from '@/game/MapRenderer';
import { DISTRICT_COLORS, DISTRICT_NAMES, POIS } from '@/game/world/cityLayout';
import { VEHICLES, VEHICLE_MAP, PAINT_COLORS, WHEEL_STYLES, TINT_LEVELS, CATEGORY_NAMES, categoryOf } from '@/config/vehicles';
import type { VehicleCategory } from '@/types';
import { PROPERTIES, PROPERTY_MAP, PROPERTY_TYPE_NAMES } from '@/config/properties';
import { ECONOMY } from '@/config/economy';
import { PRESETS, MOBILE_PRESETS, DESKTOP_PRESETS, settingsFromPreset } from '@/config/graphics';
import { ASSETS, VEHICLE_MODELS } from '@/assets/manifest';
import { JOBS, startJob, cancelMission } from '@/systems/jobs/missions';
import { buyVehicle, sellVehicle, sellPrice, setActiveVehicle, paintVehicle, setWheels, setTint, setPlate, upgrade, upgradeCost, repair, repairCost, refuel, callVehicle } from '@/systems/vehicles/vehicleService';
import { buyProperty, sellProperty, propertySellPrice, dailyIncome, businessFigures, upgradeBusiness } from '@/systems/properties/propertyService';
import { deposit, withdraw } from '@/systems/economy/economy';
import { formatSom, formatTime } from '@/utils/math';
import type { OwnedVehicle, QualityPreset, VehicleSpec } from '@/types';
import VehiclePreview from './VehiclePreview';

function Stat({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <div className="b"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
      <span style={{ textAlign: 'right' }}>{text}</span>
    </div>
  );
}

function SpecStats({ spec, o }: { spec: VehicleSpec; o?: OwnedVehicle }) {
  const p = spec.perf;
  const e = o?.engine ?? 0, h = o?.handling ?? 0;
  return (
    <div className="list" style={{ gap: 6 }}>
      <Stat label="Maks. tezlik" value={p.maxSpeedKmh * (1 + 0.08 * e)} max={300} text={`${Math.round(p.maxSpeedKmh * (1 + 0.08 * e))}`} />
      <Stat label="Tezlanish" value={p.accel * (1 + 0.18 * e)} max={9} text={`${(p.accel * (1 + 0.18 * e)).toFixed(1)}`} />
      <Stat label="Tormoz" value={p.brake} max={10} text={`${p.brake}`} />
      <Stat label="Boshqaruv" value={p.grip * (1 + 0.07 * h)} max={1.35} text={`${(p.grip * (1 + 0.07 * h)).toFixed(2)}`} />
      <Stat label="Massa" value={p.mass} max={1800} text={`${p.mass}`} />
      <Stat label="Bak" value={p.fuelCapacity} max={65} text={`${p.fuelCapacity} l`} />
    </div>
  );
}

const modelBadge = (specId: string) =>
  VEHICLE_MODELS[specId] || VEHICLE_MAP[specId]?.modelUrl || gameRef.current?.vehicleGLB.has(specId) ? <span className="badge ok">GLB MODEL</span> : <span className="badge warn">PROTSEDURAL MODEL · YAKUNIY EMAS</span>;

// ------------------------------------------------------------------ map
export function MapPanel() {
  const ref = useRef<HTMLCanvasElement>(null);
  const waypoint = useGame((s) => s.waypoint);
  const mission = useGame((s) => s.mission);
  useEffect(() => {
    const c = ref.current!;
    const g = gameRef.current;
    if (!g) return;
    const draw = () => {
      const size = c.clientWidth;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = c.height = Math.round(size * dpr);
      const markers: MapMarker[] = [];
      const st = mission?.steps[mission.stepIndex];
      if (st) markers.push({ pos: st.pos, color: '#e9b44c', big: true });
      if (waypoint) markers.push({ pos: waypoint, color: '#2bb3c0', big: true });
      g.map.drawWorld(c.getContext('2d')!, size, g.playerPos, g.playerHeading, markers);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [waypoint, mission]);
  const click = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const p = MapRenderer.worldFromMap(e.clientX - r.left, e.clientY - r.top, r.width);
    useGame.setState({ waypoint: p });
    useGame.getState().notify('GPS manzil belgilandi', 'info');
  };
  return (
    <>
      <h2 className="ptitle">G‘uzor xaritasi</h2>
      <p className="psub">Manzil belgilash uchun xaritaga bosing. Sariq — joriy ish, firuza — sizning manzilingiz.</p>
      <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
        <div className="mapbox"><canvas ref={ref} onClick={click} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="legend">
            {(Object.keys(DISTRICT_NAMES) as (keyof typeof DISTRICT_NAMES)[]).map((d) => (
              <span key={d}><i style={{ background: DISTRICT_COLORS[d] }} />{DISTRICT_NAMES[d]}</span>
            ))}
          </div>
          <div className="list" style={{ marginTop: 14 }}>
            {POIS.filter((p) => p.kind !== 'property').map((p) => (
              <button key={p.id} className="li" onClick={() => useGame.setState({ waypoint: p.pos })}>
                <b>{p.glyph} · {p.name}</b>
              </button>
            ))}
            {waypoint && <button className="btn" onClick={() => useGame.setState({ waypoint: null })}>Manzilni o‘chirish</button>}
          </div>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ jobs
export function JobsPanel() {
  const mission = useGame((s) => s.mission);
  const stats = useGame((s) => s.jobStats);
  const props = useGame((s) => s.properties);
  const setPanel = useGame((s) => s.setPanel);
  const start = (id: string) => {
    const g = gameRef.current!;
    startJob(id, { pos: g.playerPos, inVehicle: g.inVehicle, vehicleSpecId: (g.dv ?? g.vehicle)?.spec.id ?? null });
  };
  return (
    <>
      <h2 className="ptitle">Ishlar</h2>
      <p className="psub">Ish tanlang — belgilangan joylarga borib, topshiriqni bajaring. Tez bajarsangiz bonus olasiz.</p>
      {mission && (
        <div className="card sel" style={{ marginBottom: 14 }}>
          <span className="badge warn">JORIY ISH</span>
          <h3>{mission.title}</h3>
          <div className="k">{mission.stepIndex + 1}/{mission.steps.length}: {mission.steps[mission.stepIndex].label}</div>
          <div className="row"><span className="price">{formatSom(mission.reward)}</span><span className="spacer" /><button className="btn danger" onClick={cancelMission}>Bekor qilish</button></div>
        </div>
      )}
      <div className="grid2">
        {JOBS.map((j) => (
          <div key={j.id} className="card">
            <div className="row"><h3>{j.name}</h3><span className="spacer" /><span className="badge">{stats[j.id] ?? 0} marta</span></div>
            <div className="k">{j.description}</div>
            <div className="row">
              <span className="k">To‘lov: {j.pay}{j.requireVehicle ? ' · mashina kerak' : ''}</span>
              <span className="spacer" />
              {j.id === 'business' ? (
                <button className="btn" onClick={() => setPanel('properties')}>{props.some((p) => PROPERTY_MAP[p]?.income) ? `Kunlik ${formatSom(dailyIncome())}` : 'Mulk bozori'}</button>
              ) : (
                <button className="btn primary" disabled={!!mission} onClick={() => start(j.id)}>Boshlash</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ garage
export function GaragePanel() {
  const vehicles = useGame((s) => s.vehicles);
  const active = useGame((s) => s.activeVehicleUid);
  const arg = useGame((s) => s.panelArg);
  const atGarage = arg !== null;
  const [sel, setSel] = useState<string | null>(active ?? vehicles[0]?.uid ?? null);
  const [plate, setPlateText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const v = vehicles.find((x) => x.uid === sel) ?? vehicles[0];
  if (!v) return <><h2 className="ptitle">Garaj</h2><p className="psub">Sizda hali mashina yo‘q. Avtosalonga boring.</p></>;
  const spec = VEHICLE_MAP[v.specId];
  const rc = repairCost(v);
  return (
    <>
      <h2 className="ptitle">Garaj{atGarage ? '' : ' (masofadan)'}</h2>
      <p className="psub">{atGarage ? 'Mashinani tanlang, sozlang va ta’mirlang.' : 'Sozlash va ta’mir faqat avtoservisda yoki o‘z garajingizda mumkin.'}</p>
      {atGarage && gameRef.current?.dv?.borrowed && (
        <div className="card sel" style={{ marginBottom: 12 }}>
          <b>Begona mashina: {gameRef.current.dv.spec.name}</b>
          <span className="k">O‘yindagi rasmiylashtirish: narxining 70% i to‘lanadi va mashina sizniki bo‘ladi (qidiruvda bo‘lmasangiz).</span>
          <button className="btn primary" onClick={() => { const e = gameRef.current?.registerBorrowed(); if (e) useGame.getState().notify(e, 'bad'); }}>Rasmiylashtirish · {formatSom(Math.round(gameRef.current.dv.spec.price * ECONOMY.registerRatio / 1000) * 1000)}</button>
        </div>
      )}
      <div className="split">
        <div className="list">
          {vehicles.map((x) => (
            <button key={x.uid} className={`li ${x.uid === v.uid ? 'on' : ''}`} onClick={() => setSel(x.uid)}>
              <b>{VEHICLE_MAP[x.specId].name} {x.uid === active ? '· faol' : ''}</b>
              <span>{x.plate} · holati {Math.round(x.health)}% · {Math.round(x.fuel)} l</span>
            </button>
          ))}
        </div>
        <div className="list" style={{ gap: 12 }}>
          <div className="preview">
            <VehiclePreview specId={v.specId} custom={v} />
            <div className="tag">{modelBadge(v.specId)}</div>
          </div>
          <div className="row">
            <h3 style={{ margin: 0 }}>{spec.name}</h3>
            <span className="k">{spec.niche}</span>
            <span className="spacer" />
            {v.uid !== active && <button className="btn primary" onClick={() => setActiveVehicle(v.uid)}>{atGarage ? 'Garajdan chiqarish' : 'Faol qilish'}</button>}
            {v.uid === active && !atGarage && <button className="btn" onClick={() => callVehicle()}>Yoniga chaqirish · {formatSom(ECONOMY.vehicleDelivery)}</button>}
          </div>
          {atGarage && (
            <>
              <div className="card">
                <div className="row"><b>Ta’mir</b><span className="spacer" /><button className="btn" disabled={v.health >= 99.5} onClick={() => repair(v.uid)}>{v.health >= 99.5 ? 'Soz' : `Ta’mirlash · ${formatSom(rc)}`}</button></div>
                <div className="row"><b>Yoqilg‘i</b><span className="k">{Math.round(v.fuel)} / {spec.perf.fuelCapacity} l</span><span className="spacer" /><button className="btn" onClick={() => refuel(v.uid)}>To‘ldirish</button></div>
              </div>
              <div className="card">
                <div className="row"><b>Bo‘yoq</b><span className="k">{formatSom(ECONOMY.paint)}</span></div>
                <div className="swatches">{PAINT_COLORS.map((c) => <button key={c.hex} title={c.name} className={`sw ${v.color === c.hex ? 'on' : ''}`} style={{ background: c.hex }} onClick={() => v.color !== c.hex && paintVehicle(v.uid, c.hex)} />)}</div>
                <div className="row"><b>G‘ildirak</b></div>
                <div className="seg">{WHEEL_STYLES.map((w, i) => <button key={w.name} className={v.wheels === i ? 'on' : ''} onClick={() => v.wheels !== i && setWheels(v.uid, i)}>{w.name}{i ? ` · ${formatSom(ECONOMY.wheels[i])}` : ''}</button>)}</div>
                <div className="row"><b>Tonirovka</b></div>
                <div className="seg">{TINT_LEVELS.map((t, i) => <button key={t.name} className={v.tint === i ? 'on' : ''} onClick={() => v.tint !== i && setTint(v.uid, i)}>{t.name}</button>)}</div>
                <div className="row"><b>Davlat raqami</b><span className="k">{formatSom(ECONOMY.customPlate)}</span></div>
                <div className="row">
                  <input className="text-in" placeholder={v.plate} value={plate} maxLength={11} onChange={(e) => setPlateText(e.target.value.toUpperCase())} />
                  <button className="btn" disabled={!plate} onClick={() => { const r = setPlate(v.uid, plate); setErr(r); if (!r) setPlateText(''); }}>O‘rnatish</button>
                  {err && <span className="k" style={{ color: '#ff9a92' }}>{err}</span>}
                </div>
              </div>
              <div className="card">
                <b>Tuning</b>
                {(['engine', 'handling'] as const).map((k) => {
                  const c = upgradeCost(v, k);
                  return (
                    <div key={k} className="row">
                      <span>{k === 'engine' ? 'Dvigatel' : 'Boshqaruv va osma'} · {v[k]}/3</span>
                      <span className="spacer" />
                      <button className="btn" disabled={c === null} onClick={() => upgrade(v.uid, k)}>{c === null ? 'Maksimal' : `Yaxshilash · ${formatSom(c)}`}</button>
                    </div>
                  );
                })}
                <SpecStats spec={spec} o={v} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ dealership
export function DealershipPanel() {
  const here = useGame((s) => s.panelArg) === 'here';
  const vehicles = useGame((s) => s.vehicles);
  const [sel, setSel] = useState(VEHICLES[0].id);
  const [color, setColor] = useState<string>(VEHICLES[0].defaultColor);
  const [cat, setCat] = useState<VehicleCategory | 'all'>('all');
  const spec = VEHICLE_MAP[sel];
  const cats = [...new Set(VEHICLES.map(categoryOf))];
  const list = VEHICLES.filter((v) => cat === 'all' || categoryOf(v) === cat);
  const preview = { color, wheels: 0, tint: 0, plate: '70 A 000 GZ', engine: 0, handling: 0 };
  return (
    <>
      <h2 className="ptitle">Avtosalon</h2>
      <p className="psub">{here ? 'Mashinani 3D ko‘rinishda aylantirib ko‘ring, rangini tanlang va sotib oling.' : 'Katalog. Sotib olish uchun sanoat zonasidagi avtosalonga boring.'}</p>
      <div className="split">
        <div className="list">
          <div className="seg"><button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>Hammasi ({VEHICLES.length})</button>{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{CATEGORY_NAMES[c]}</button>)}</div>
          {list.map((v) => (
            <button key={v.id} className={`li ${v.id === sel ? 'on' : ''}`} onClick={() => { setSel(v.id); setColor(v.defaultColor); }}>
              <b>{v.name}</b>
              <span>{v.niche} · {formatSom(v.price)}</span>
            </button>
          ))}
        </div>
        <div className="list" style={{ gap: 12 }}>
          <div className="preview">
            <VehiclePreview specId={sel} custom={preview} />
            <div className="tag">{modelBadge(sel)}</div>
          </div>
          <div className="row"><h3 style={{ margin: 0 }}>{spec.name}</h3><span className="k">{spec.niche} · {spec.seats} o‘rin</span><span className="spacer" /><span className="price">{formatSom(spec.price)}</span></div>
          <div className="k">{spec.description}</div>
          {spec.license && <div className="k">Model: «{spec.license.title}» — {spec.license.author} · {spec.license.license} · {spec.license.source}</div>}
          <div className="swatches">{PAINT_COLORS.map((c) => <button key={c.hex} title={c.name} className={`sw ${color === c.hex ? 'on' : ''}`} style={{ background: c.hex }} onClick={() => setColor(c.hex)} />)}</div>
          <SpecStats spec={spec} />
          <div className="row">
            <button className="btn primary" disabled={!here} onClick={() => buyVehicle(sel, color)}>Sotib olish</button>
          </div>
          {here && vehicles.length > 0 && (
            <div className="card">
              <b>Mashinangizni sotish</b>
              {vehicles.map((v) => (
                <div key={v.uid} className="row">
                  <span>{VEHICLE_MAP[v.specId].name} · {v.plate}</span>
                  <span className="spacer" />
                  <button className="btn danger" onClick={() => window.confirm(`${VEHICLE_MAP[v.specId].name} ni ${formatSom(sellPrice(v))} ga sotasizmi?`) && sellVehicle(v.uid)}>Sotish · {formatSom(sellPrice(v))}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ properties
export function PropertiesPanel() {
  const owned = useGame((s) => s.properties);
  const arg = useGame((s) => s.panelArg);
  return (
    <>
      <h2 className="ptitle">Ko‘chmas mulk</h2>
      <p className="psub">Uy va garajlar mashinalaringiz uchun garaj beradi. Tijorat binolari har kuni bank hisobingizga daromad keltiradi.</p>
      <div className="grid2">
        {PROPERTIES.map((p) => {
          const own = owned.includes(p.id);
          const poi = POIS.find((x) => x.propertyId === p.id)!;
          return (
            <div key={p.id} className={`card ${arg === p.id ? 'sel' : ''}`}>
              <div className="row"><span className="badge">{PROPERTY_TYPE_NAMES[p.type]}</span>{own && <span className="badge ok">SIZNIKI</span>}</div>
              <h3>{p.name}</h3>
              <div className="k">{p.description}</div>
              <div className="k">{p.income ? `Daromad: ${formatSom(p.income)} / kun (xarajatdan oldin)` : p.hasGarage ? 'Garaj bor' : 'Garajsiz'}</div>
              {own && p.income > 0 && (() => {
                const f = businessFigures(p.id);
                return (
                  <div className="list" style={{ gap: 4 }}>
                    <span className="k">Daraja {f.lvl}/3 · daromad {formatSom(f.income)} · xarajat {formatSom(f.expenses)} · sof {formatSom(f.net)} / kun</span>
                    <button className="btn" disabled={f.upgradeCost === null} onClick={() => upgradeBusiness(p.id)}>{f.upgradeCost === null ? 'Maksimal daraja' : `Kengaytirish · ${formatSom(f.upgradeCost)}`}</button>
                  </div>
                );
              })()}
              <div className="row">
                <span className="price">{formatSom(p.price)}</span>
                <span className="spacer" />
                <button className="btn" onClick={() => useGame.setState({ waypoint: poi.pos })}>GPS</button>
                {own ? (
                  <button className="btn danger" onClick={() => window.confirm(`${formatSom(propertySellPrice(p.id))} ga sotilsinmi?`) && sellProperty(p.id)}>Sotish</button>
                ) : (
                  <button className="btn primary" onClick={() => window.confirm(`«${p.name}» ${formatSom(p.price)} ga sotib olinsinmi?`) && buyProperty(p.id)}>Sotib olish</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ bank
export function BankPanel() {
  const cash = useGame((s) => s.cash);
  const bank = useGame((s) => s.bank);
  const tx = useGame((s) => s.transactions);
  const amounts = [100_000, 1_000_000, 10_000_000];
  return (
    <>
      <h2 className="ptitle">Bank</h2>
      <p className="psub">Naqd pul bilan kundalik xarajatlar, bank hisobidan esa mashina va uy xaridlari to‘lanadi.</p>
      <div className="grid2">
        <div className="card"><span className="k">Naqd pul</span><span className="price" style={{ fontSize: 22 }}>{formatSom(cash)}</span>
          <div className="row">{amounts.map((a) => <button key={a} className="btn" disabled={cash < a} onClick={() => deposit(a)}>+{a / 1e6 >= 1 ? `${a / 1e6} mln` : `${a / 1e3} ming`}</button>)}<button className="btn" disabled={cash <= 0} onClick={() => deposit(cash)}>Hammasi</button></div>
          <span className="k">Bankka qo‘yish</span>
        </div>
        <div className="card"><span className="k">Bank hisobi</span><span className="price" style={{ fontSize: 22 }}>{formatSom(bank)}</span>
          <div className="row">{amounts.map((a) => <button key={a} className="btn" disabled={bank < a} onClick={() => withdraw(a)}>−{a / 1e6 >= 1 ? `${a / 1e6} mln` : `${a / 1e3} ming`}</button>)}</div>
          <span className="k">Naqdlashtirish</span>
        </div>
      </div>
      <h3 style={{ margin: '20px 0 6px' }}>Operatsiyalar</h3>
      {tx.length === 0 && <p className="psub">Hali operatsiyalar yo‘q.</p>}
      {tx.slice(0, 30).map((t) => (
        <div key={t.id} className="tx"><span>{t.label}<span className="k"> · {t.day}-kun {formatTime(t.minutes)}</span></span><span className={t.amount >= 0 ? 'plus' : 'minus'}>{t.amount >= 0 ? '+' : ''}{formatSom(t.amount)}</span></div>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ inventory
export function InventoryPanel() {
  const cargo = useGame((s) => s.cargo);
  const vehicles = useGame((s) => s.vehicles);
  const props = useGame((s) => s.properties);
  const items = [
    { name: 'Smartfon', note: 'Ishlar, bank, xarita (Tab)' },
    ...vehicles.map((v) => ({ name: `Kalit: ${VEHICLE_MAP[v.specId].name}`, note: v.plate })),
    ...props.map((p) => ({ name: `Kalit: ${PROPERTY_MAP[p].name}`, note: PROPERTY_TYPE_NAMES[PROPERTY_MAP[p].type] })),
    ...cargo.map((c) => ({ name: c.name, note: `${c.qty} dona · ish yuki` })),
  ];
  return (
    <>
      <h2 className="ptitle">Inventar</h2>
      <p className="psub">Yoningizdagi narsalar va kalitlar.</p>
      <div className="grid2">{items.map((it, n) => <div key={n} className="card"><h3>{it.name}</h3><span className="k">{it.note}</span></div>)}</div>
    </>
  );
}

// ------------------------------------------------------------------ settings
export function SettingsPanel() {
  const s = useGame((x) => x.settings);
  const device = useGame((x) => x.device);
  const update = useGame((x) => x.updateSettings);
  const [perf, setPerf] = useState(gameRef.current?.perf);
  useEffect(() => {
    const id = window.setInterval(() => setPerf({ ...gameRef.current!.perf }), 600);
    return () => window.clearInterval(id);
  }, []);
  const pick = (p: QualityPreset) => update(settingsFromPreset(p, s));
  const presets = device.mobile ? [...MOBILE_PRESETS, ...DESKTOP_PRESETS] : [...DESKTOP_PRESETS, ...MOBILE_PRESETS];
  const range = (label: string, key: keyof typeof s, min: number, max: number, step: number, fmt: (v: number) => string) => (
    <div className="field">
      <label>{label}<span>{fmt(s[key] as number)}</span></label>
      <input type="range" min={min} max={max} step={step} value={s[key] as number} onChange={(e) => update({ [key]: Number(e.target.value) })} />
    </div>
  );
  return (
    <>
      <h2 className="ptitle">Sozlamalar</h2>
      <p className="psub">Qurilma: {device.mobile ? 'mobil' : 'kompyuter'} · GPU: {device.gpu || 'aniqlanmadi'} · {perf ? `${perf.fps} FPS · ${perf.frameMs} ms · ${perf.calls} draw call` : ''}</p>
      <div className="field">
        <label>Grafika darajasi</label>
        <div className="seg">{presets.map((p) => <button key={p} className={s.preset === p ? 'on' : ''} onClick={() => pick(p)}>{PRESETS[p].label}</button>)}</div>
        <span className="k" style={{ fontSize: 11, color: 'var(--muted)' }}>Tekstura sifati va daraxt zichligi sahifa qayta yuklanganda qo‘llanadi.</span>
      </div>
      <div className="field">
        <label>Soyalar</label>
        <div className="seg">{['O‘chiq', 'Past', 'O‘rta', 'Yuqori'].map((n, i) => <button key={n} className={s.shadows === i ? 'on' : ''} onClick={() => update({ shadows: i })}>{n}</button>)}</div>
      </div>
      {range('Ekran aniqligi', 'resolutionScale', 0.5, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
      {range('Ko‘rish masofasi', 'renderDistance', 180, 900, 10, (v) => `${v} m`)}
      {range('Transport zichligi', 'trafficDensity', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
      {range('Piyodalar zichligi', 'pedestrianDensity', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
      {range('Sichqoncha sezgirligi', 'mouseSensitivity', 0.2, 3, 0.1, (v) => v.toFixed(1))}
      {range('Ovoz balandligi', 'volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
      {device.touch && range('Sensorli tugmalar o‘lchami', 'touchButtonScale', 0.7, 1.4, 0.05, (v) => `${Math.round(v * 100)}%`)}
      <div className="row" style={{ marginBottom: 16 }}>
        {([['showFps', 'FPS ko‘rsatish'], ['autoQuality', 'Avtomatik sifat'], ['dynamicResolution', 'Moslashuvchan aniqlik'], ['invertY', 'Y o‘qini teskari']] as const).map(([k, n]) => (
          <button key={k} className={`btn ${s[k] ? 'primary' : ''}`} onClick={() => update({ [k]: !s[k] })}>{n}: {s[k] ? 'yoqilgan' : 'o‘chiq'}</button>
        ))}
      </div>
      <h3 style={{ margin: '8px 0' }}>Boshqaruv</h3>
      <table className="keys"><tbody>
        {[['W A S D', 'Yurish / haydash'], ['Shift', 'Tez yugurish'], ['C', 'Sekin yurish / mashinada kamera'], ['H', 'Faralar: avto / yoniq / o‘chiq'], ['Q · R', 'Chap · o‘ng burilish chirog‘i'], ['G', 'Signal (gudok)'], ['X', 'Dvigatelni o‘chirish/yoqish'], ['Space', 'Sakrash / qo‘l tormozi'], ['E', 'Harakat · mashinaga o‘tirish/tushish'], ['F', 'Mashina ichidan: yoqilg‘i, servis'], ['V', 'Salon kamerasi'], ['Sichqoncha / g‘ildirak', 'Kamera / masofa'], ['M', 'Xarita'], ['Tab', 'Telefon'], ['I', 'Inventar'], ['Esc', 'Pauza'], ['Gamepad', 'Chap stik, RT/LT gaz-tormoz, A sakrash, X/Y harakat, B servis, RB kamera']].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
      </tbody></table>
    </>
  );
}

// ------------------------------------------------------------------ credits
export function CreditsPanel() {
  const report = gameRef.current?.assets.report ?? [];
  return (
    <>
      <h2 className="ptitle">Mualliflar va litsenziyalar</h2>
      <p className="psub">UZBEK LIFE: Open World — brauzer uchun ochiq dunyo simulyatori (alfa).</p>
      <div className="list">
        {Object.entries(ASSETS).map(([id, a]) => {
          const r = report.find((x) => x.id === id);
          return (
            <div key={id} className="card">
              <div className="row"><b>{a.source}</b><span className="spacer" /><span className={`badge ${a.status === 'final' ? 'ok' : 'warn'}`}>{a.status === 'final' ? 'YAKUNIY' : 'VAQTINCHA'}</span></div>
              <span className="k">{a.license}{r ? ` · yuklandi: ${r.ok ? `ha (${r.ms} ms)` : 'xato'}` : ''}</span>
            </div>
          );
        })}
        <div className="card"><b>Shahar, binolar, mashinalar, teksturalar, tovushlar</b><span className="k">Kod orqali yaratilgan original protsedural assetlar. Mashinalar va binolar hali yakuniy 3D modellar emas.</span></div>
        <div className="card"><b>Texnologiyalar</b><span className="k">Three.js (MIT), React (MIT), Zustand (MIT), Vite (MIT)</span></div>
      </div>
    </>
  );
}
