import { useEffect, useState } from 'react';
import type { LotEdit } from '@/game/world/World';
import { useGame } from '@/stores/gameStore';
import { gameRef } from '@/game/Game';
import { VEHICLES } from '@/config/vehicles';
import { UserAssets } from '@/game/engine/UserAssets';
import type { SlotKind } from '@/assets/library';

const ROLE: Record<string, string> = { lola: 'Nexia 3', chumchuq: 'Spark', zarafshon: 'Cobalt', bahor: 'Gentra', amir: 'Malibu 2', karvon: 'Damas', qoya: 'Tracker', burgut: 'Equinox' };
const SHOWCASE_SLOTS: { slot: string; kind: SlotKind; label: string }[] = [
  { slot: 'house:house_a', kind: 'house', label: 'Mahalla uyi A' },
  { slot: 'house:house_b', kind: 'house', label: 'Mahalla uyi B' },
  { slot: 'house:house_c', kind: 'house', label: 'Mahalla uyi C' },
  { slot: 'gate:gate_a', kind: 'gate', label: 'Darvoza A' },
  { slot: 'gate:gate_b', kind: 'gate', label: 'Darvoza B' },
  { slot: 'tree:tree_a', kind: 'tree', label: 'Daraxt A (chinor/terak)' },
  { slot: 'tree:tree_b', kind: 'tree', label: 'Daraxt B (o‘rik)' },
  { slot: 'bush:bush_a', kind: 'bush', label: 'Buta' },
  { slot: 'lamp:lamp_a', kind: 'lamp', label: 'Ko‘cha chirog‘i' },
  { slot: 'bench:bench_a', kind: 'bench', label: 'Skameyka' },
];
const LICENSES = ['CC0', 'CC BY 4.0', 'Royalty-free (sotib olingan)', 'O‘z ishim', 'Muallif ruxsati (yozma)'];

function Row({ slot, kind, label }: { slot: string; kind: SlotKind; label: string }) {
  useGame((s) => s.assetsVersion);
  const g = gameRef.current;
  const rep = g?.libraryReport.find((r) => r.slot === slot);
  const [file, setFile] = useState<File | null>(null);
  const [author, setAuthor] = useState('');
  const [license, setLicense] = useState(LICENSES[0]);
  const [source, setSource] = useState('');
  const [rotate, setRotate] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    if (!file || !g) return;
    if (!author.trim() || !source.trim()) {
      setMsg('Muallif va manba havolasi majburiy');
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      await g.assets.parseGLB(buffer); // validate before storing
      await UserAssets.put({ slot, kind, name: file.name.replace(/\.glb$/i, ''), buffer, license: { author: author.trim(), license, source: source.trim() }, addedAt: Date.now(), rotate });
      await g.loadLibrary();
      setFile(null);
      setMsg(null);
      useGame.getState().notify(`${label}: GLB model qo‘shildi`, 'good');
    } catch (e) {
      setMsg('Faylni o‘qib bo‘lmadi: ' + String(e).slice(0, 120));
    }
    setBusy(false);
  };
  const remove = async () => {
    if (!g) return;
    await UserAssets.remove(slot);
    await g.loadLibrary();
  };
  return (
    <div className="card">
      <div className="row">
        <b>{label}</b>
        <span className="spacer" />
        {rep?.ok ? (
          <span className={`badge ${rep.triangles > 300000 ? 'warn' : 'ok'}`}>GLB · {rep.origin === 'user' ? 'siz qo‘shgan' : 'loyihada'} · {Math.round(rep.triangles / 1000)}k uchburchak</span>
        ) : rep ? (
          <span className="badge warn">XATO: {rep.error?.slice(0, 40)}</span>
        ) : (
          <span className="badge warn">PROTSEDURAL · GLB YO‘Q</span>
        )}
      </div>
      {rep?.license && <span className="k">{rep.license.license} · {rep.license.author} · {rep.license.source}</span>}
      <div className="row">
        <input type="file" accept=".glb,model/gltf-binary" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {rep?.origin === 'user' && <button className="btn danger" onClick={remove}>O‘chirish</button>}
      </div>
      {file && (
        <div className="list" style={{ gap: 6 }}>
          <input className="text-in" placeholder="Muallif (masalan, Sketchfab foydalanuvchisi)" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input className="text-in" placeholder="Manba havolasi" value={source} onChange={(e) => setSource(e.target.value)} />
          <div className="seg">{LICENSES.map((l) => <button key={l} className={license === l ? 'on' : ''} onClick={() => setLicense(l)}>{l}</button>)}</div>
          <div className="seg"><span className="k" style={{ alignSelf: 'center' }}>Old tomoni:</span>{[0, 90, 180, 270].map((d) => <button key={d} className={rotate === d ? 'on' : ''} onClick={() => setRotate(d)}>{d}°</button>)}</div>
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Yuklanmoqda…' : 'Saqlash va o‘yinga qo‘shish'}</button>
        </div>
      )}
      {msg && <span className="k" style={{ color: '#ff9a92' }}>{msg}</span>}
    </div>
  );
}

const KIND_NAMES: Record<string, string> = { house: 'Hovli uy', villa: 'Villa', commercial: 'Do‘kon / tijorat', apartment: 'Ko‘p qavatli uy', industrial: 'Ombor / ustaxona', farm: 'Ferma', orchard: 'Bog‘' };
const WORLD_SLOTS = ['building:world_a', 'building:world_b', 'building:world_c', 'building:world_d'];
const DEV_KEY = 'uzbek-life:dev';

/** World Environment Editor — buildings and street objects anywhere in the world (developer mode only) */
type Target = number | string;
type Batch = { items: { id: Target; prev: LotEdit; next: LotEdit }[] };
const PROP_NAMES: Record<string, string> = { chinor: 'Chinor', terak: 'Terak', fruit: 'Mevali daraxt', pine: 'Archa', bush: 'Buta', grass: 'Maysa', lamp: 'Chiroq', bench: 'Skameyka', bin: 'Chiqindi qutisi' };
const ZONE_LABELS: Record<string, string> = { all: 'Barcha hududlar', center: 'Markaz', mahalla: 'Mahalla', villas: 'Yangi uylar', industrial: 'Sanoat', village: 'Qishloq', fields: 'Dalalar' };

function WorldEditor() {
  useGame((s) => s.assetsVersion);
  const district = useGame((s) => s.hud.district);
  const [dev, setDev] = useState(() => localStorage.getItem(DEV_KEY) === '1');
  const [mode, setMode] = useState<'lots' | 'props'>('lots');
  const [zoneF, setZoneF] = useState('all');
  const [kindF, setKindF] = useState('all');
  const [radius, setRadius] = useState(90);
  const [sel, setSel] = useState<Target[]>([]);
  const [undo, setUndo] = useState<Batch[]>([]);
  const [redo, setRedo] = useState<Batch[]>([]);
  const [, setTick] = useState(0);
  const g = gameRef.current;
  useEffect(() => () => g?.world.highlightTargets([]), [g]);
  useEffect(() => { g?.world.highlightTargets(sel); }, [g, sel]);
  if (!g) return null;
  if (!dev) {
    return (
      <div className="card">
        <b>Ishlab chiquvchi rejimi o‘chiq</b>
        <span className="k">Dunyo muharriri butun shahar binolari va ko‘cha obyektlarini o‘zgartiradi, shuning uchun oddiy o‘yinda yopiq turadi.</span>
        <button className="btn" onClick={() => { if (confirm('Ishlab chiquvchi rejimini yoqasizmi? Dunyo muharriri butun shaharni o‘zgartiradi.')) { localStorage.setItem(DEV_KEY, '1'); setDev(true); } }}>Ishlab chiquvchi rejimini yoqish</button>
      </div>
    );
  }
  const W = g.world;
  const all = mode === 'lots' ? W.lotsNear(g.player.x, g.player.z, radius) : W.propsNear(g.player.x, g.player.z, radius);
  const kinds = [...new Set(all.map((l) => l.kind))];
  const list = all.filter((l) => (zoneF === 'all' || l.zone === zoneF) && (kindF === 'all' || l.kind === kindF));
  const first = sel.length ? W.getEdit(sel[0]) : {};
  const anyModel = sel.some((t) => typeof t === 'number' && !!W.getEdit(t).model);
  const models = W.worldModelSlots();
  const run = (fn: (e: LotEdit) => LotEdit) => {
    if (!sel.length) return;
    const items = sel.map((id) => { const prev = W.getEdit(id); return { id, prev, next: fn({ ...prev }) }; });
    for (const it of items) W.setEdit(it.id, it.next);
    setUndo((u) => [...u.slice(-49), { items }]);
    setRedo([]);
    W.highlightTargets(sel);
    setTick((t) => t + 1);
  };
  const replay = (b: Batch, back: boolean) => {
    for (const it of b.items) W.setEdit(it.id, back ? it.prev : it.next);
    W.highlightTargets(sel);
    setTick((t) => t + 1);
  };
  const label = (l: (typeof all)[number]) => (mode === 'lots' ? `${KIND_NAMES[l.kind] ?? l.kind} #${l.id}` : `${PROP_NAMES[l.kind] ?? l.kind} ${l.id}`);
  return (
    <>
      <div className="card" style={{ marginBottom: 10 }}>
        <b>Hudud: {district}</b>
        <span className="k">Saqlangan va joriy o‘zgarishlar: {W.editCount()} · tanlangan: {sel.length}</span>
        <div className="seg">
          <button className={mode === 'lots' ? 'on' : ''} onClick={() => { setMode('lots'); setSel([]); setKindF('all'); }}>Binolar</button>
          <button className={mode === 'props' ? 'on' : ''} onClick={() => { setMode('props'); setSel([]); setKindF('all'); }}>Daraxt, chiroq, skameyka, quti</button>
          <button onClick={() => { localStorage.removeItem(DEV_KEY); setDev(false); setSel([]); }}>Rejimni o‘chirish</button>
        </div>
        <div className="seg">
          {[40, 90, 150].map((r) => <button key={r} className={radius === r ? 'on' : ''} onClick={() => setRadius(r)}>{r} m</button>)}
          <select value={zoneF} onChange={(e) => setZoneF(e.target.value)}>{Object.entries(ZONE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={kindF} onChange={(e) => setKindF(e.target.value)}>
            <option value="all">Barcha turlar</option>
            {kinds.map((k) => <option key={k} value={k}>{(mode === 'lots' ? KIND_NAMES : PROP_NAMES)[k] ?? k}</option>)}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div>
          <div className="seg">
            <button onClick={() => setSel(list.map((l) => l.id))}>Hammasini guruhga ({list.length})</button>
            <button onClick={() => setSel([])}>Tanlovni tozalash</button>
          </div>
          <div className="list" style={{ maxHeight: 280, overflow: 'auto' }}>
            {list.map((l) => (
              <button key={String(l.id)} className={`li ${sel.includes(l.id) ? 'on' : ''}`} onClick={() => setSel(sel.includes(l.id) ? sel.filter((x) => x !== l.id) : [...sel, l.id])}>
                <b>{label(l)}{l.owned ? ' · mulk' : ''}</b>
                <span className="k">{Math.round(l.dist)} m · {ZONE_LABELS[l.zone] ?? l.zone}{W.getEdit(l.id).hidden ? ' · yashirilgan' : ''}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          {!sel.length ? <span className="k">Ro‘yxatdan bitta yoki bir nechta obyekt tanlang. Bir nechta tanlansa, amal butun guruhga qo‘llanadi.</span> : (
            <>
              <b>{sel.length === 1 ? 'Tanlangan obyekt' : `Guruh: ${sel.length} ta obyekt`}</b>
              <span className="k">Birinchisi: siljish {first.dx ?? 0} / {first.dz ?? 0} m · {first.drot ?? 0}° · masshtab {(first.scale ?? 1).toFixed(1)}</span>
              <div className="seg">
                <button onClick={() => run((e) => ({ ...e, dx: (e.dx ?? 0) - 1 }))}>← 1 m</button>
                <button onClick={() => run((e) => ({ ...e, dx: (e.dx ?? 0) + 1 }))}>1 m →</button>
                <button onClick={() => run((e) => ({ ...e, dz: (e.dz ?? 0) - 1 }))}>↑ 1 m</button>
                <button onClick={() => run((e) => ({ ...e, dz: (e.dz ?? 0) + 1 }))}>↓ 1 m</button>
              </div>
              <div className="seg">
                <button onClick={() => run((e) => ({ ...e, drot: (e.drot ?? 0) - 15 }))}>⟲ 15°</button>
                <button onClick={() => run((e) => ({ ...e, drot: (e.drot ?? 0) + 15 }))}>⟳ 15°</button>
                <button disabled={mode === 'lots' && !anyModel} onClick={() => run((e) => ({ ...e, scale: Math.max(0.5, +((e.scale ?? 1) - 0.1).toFixed(2)) }))}>Kichraytirish</button>
                <button disabled={mode === 'lots' && !anyModel} onClick={() => run((e) => ({ ...e, scale: Math.min(2, +((e.scale ?? 1) + 0.1).toFixed(2)) }))}>Kattalashtirish</button>
              </div>
              {mode === 'lots' && (
                <label className="k">Model
                  <select value={first.model ?? ''} onChange={(ev) => { const v = ev.target.value || undefined; run((e) => ({ ...e, model: v, scale: undefined })); }}>
                    <option value="">Asl (protsedural)</option>
                    {models.map((m) => <option key={m} value={m}>{m.replace('building:', 'GLB ')}</option>)}
                  </select>
                </label>
              )}
              <div className="seg">
                <button onClick={() => { const h = !first.hidden; run((e) => ({ ...e, hidden: h })); }}>{first.hidden ? 'Qaytarish' : 'O‘chirish (yashirish)'}</button>
                <button onClick={() => run(() => ({}))}>Asl holat</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="seg" style={{ marginTop: 10 }}>
        <button disabled={!undo.length} onClick={() => { const b = undo[undo.length - 1]; replay(b, true); setUndo(undo.slice(0, -1)); setRedo([...redo, b]); }}>Undo ({undo.length})</button>
        <button disabled={!redo.length} onClick={() => { const b = redo[redo.length - 1]; replay(b, false); setRedo(redo.slice(0, -1)); setUndo([...undo, b]); }}>Redo ({redo.length})</button>
        <button onClick={() => { W.saveEdits(); setTick((t) => t + 1); }}>Saqlash</button>
        <button onClick={() => { if (confirm('Barcha dunyo o‘zgarishlarini o‘chirasizmi?')) { W.resetEdits(); setUndo([]); setRedo([]); setTick((t) => t + 1); } }}>Hammasini tiklash</button>
      </div>
      <h3 style={{ margin: '16px 0 6px' }}>Dunyo uchun bino modellari</h3>
      <p className="psub">Bu yerga yuklangan GLB faqat siz tanlagan uchastkalarda ishlatiladi; uyingizga ta’sir qilmaydi.</p>
      <div className="grid2">{WORLD_SLOTS.map((s, n) => <Row key={s} slot={s} kind="building" label={`Dunyo binosi ${'ABCD'[n]}`} />)}</div>
    </>
  );
}

export function AssetLabPanel() {
  useGame((s) => s.assetsVersion);
  const [tab, setTab] = useState<'property' | 'world' | 'vehicles'>('property');
  const g = gameRef.current;
  const sc = g?.showcase.report;
  const glbCount = g?.libraryReport.filter((r) => r.ok).length ?? 0;
  return (
    <>
      <h2 className="ptitle">3D modellar</h2>
      <div className="seg" style={{ marginBottom: 10 }}>
        <button className={tab === 'property' ? 'on' : ''} onClick={() => setTab('property')}>Mulk muharriri</button>
        <button className={tab === 'world' ? 'on' : ''} onClick={() => setTab('world')}>Dunyo muharriri</button>
        <button className={tab === 'vehicles' ? 'on' : ''} onClick={() => setTab('vehicles')}>Mashina modellari</button>
      </div>
      {tab === 'property' && (
        <>
          <p className="psub">Faqat sizning uyingiz va hovlingiz: uy, darvoza, daraxt, chiroq va skameyka modellari. Shahar binolariga ta’sir qilmaydi. Hozir {glbCount} ta GLB yuklangan.</p>
          {sc && (
            <div className="card" style={{ marginBottom: 12 }}>
              <b>Uyingiz atrofi</b>
              <span className="k">GLB uylar: {sc.houses} · protsedural uylar: {sc.proceduralHousesLeft} · darvozalar: {sc.gates} · daraxtlar: {sc.trees} · butalar: {sc.bushes} · chiroqlar: {sc.lamps} · skameykalar: {sc.benches}</span>
            </div>
          )}
          <div className="grid2">{SHOWCASE_SLOTS.map((s) => <Row key={s.slot} {...s} />)}</div>
        </>
      )}
      {tab === 'world' && <WorldEditor />}
      {tab === 'vehicles' && (
        <>
          <p className="psub">Litsenziyali mashina GLB fayli shu mashinaning barcha nusxalariga (ko‘cha, avtosalon, garaj) qo‘llanadi.</p>
          <div className="grid2">{VEHICLES.map((v) => <Row key={v.id} slot={`vehicle:${v.id}`} kind="vehicle" label={ROLE[v.id] ? `${v.name} (${ROLE[v.id]} o‘rniga)` : `${v.name} (katalog)`} />)}</div>
        </>
      )}
    </>
  );
}
