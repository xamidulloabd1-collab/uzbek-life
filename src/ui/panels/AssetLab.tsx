import { useState } from 'react';
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

export function AssetLabPanel() {
  useGame((s) => s.assetsVersion);
  const g = gameRef.current;
  const sc = g?.showcase.report;
  const glbCount = g?.libraryReport.filter((r) => r.ok).length ?? 0;
  return (
    <>
      <h2 className="ptitle">3D modellar (Asset Lab)</h2>
      <p className="psub">
        Litsenziyali GLB faylni tanlang: u darhol o‘yinga ulanadi va brauzerda saqlanib qoladi. Mashinalar barcha joyda ishlatiladi, uylar va jihozlar esa
        namunaviy mahallada (ijaradagi uyingiz joylashgan kvartal). Hozir {glbCount} ta GLB yuklangan.
      </p>
      {sc && (
        <div className="card" style={{ marginBottom: 12 }}>
          <b>Namunaviy mahalla holati</b>
          <span className="k">GLB uylar: {sc.houses} · protsedural uylar: {sc.proceduralHousesLeft} · darvozalar: {sc.gates} · daraxtlar: {sc.trees} · butalar: {sc.bushes} · chiroqlar: {sc.lamps} · skameykalar: {sc.benches}</span>
          <span className="k">Mashinalar: {g!.vehicleGLB.size ? `${g!.vehicleGLB.size} ta GLB model; protsedural mashinalar ko‘chaga chiqmaydi` : 'GLB yo‘q — protsedural mashinalar ishlatilmoqda'}</span>
        </div>
      )}
      <h3 style={{ margin: '6px 0' }}>Mashinalar</h3>
      <div className="grid2">{VEHICLES.map((v) => <Row key={v.id} slot={`vehicle:${v.id}`} kind="vehicle" label={ROLE[v.id] ? `${v.name} (${ROLE[v.id]} o‘rniga)` : `${v.name} (katalog)`} />)}</div>
      <h3 style={{ margin: '16px 0 6px' }}>Namunaviy mahalla</h3>
      <div className="grid2">{SHOWCASE_SLOTS.map((s) => <Row key={s.slot} {...s} />)}</div>
    </>
  );
}
