# UZBEK LIFE: Open World (alfa 0.2)

Brauzerda ishlaydigan 3D ochiq dunyo hayot simulyatori. Voqealar o‘ylab topilgan **Yangi Guzor** shahrida bo‘lib o‘tadi.
Bir xil havola kompyuterda ham, telefonda ham ochiladi, alohida o‘rnatish shart emas.

## Ishga tushirish
```bash
npm install
npm run dev            # http://localhost:5173 (telefondan sinash uchun --host yoqilgan)
npm run build          # dist/ — Vercel / Netlify uchun
npm run build:single   # dist-single/index.html — bitta fayl (≈6 MB)
npm run typecheck
```
Talab: Node 18+, WebGL 2 qo‘llaydigan brauzer (Chrome, Edge, Firefox, Safari 15+).

## Boshqaruv
| Kompyuter | Telefon | Amal |
|---|---|---|
| W A S D | chap joystik | yurish / rul |
| Shift / C | «Yugurish» | yugurish / sekin yurish |
| Space | «Sakrash» / «Qo‘l tormoz» | sakrash / qo‘l tormozi |
| W / S (mashinada) | «Gaz» / «Tormoz» | gaz / tormoz, orqaga yurish |
| E | sariq tugma | harakat, mashinaga o‘tirish yoki tushish |
| F | sariq tugma | mashina ichidan: yoqilg‘i quyish, servis |
| V | «Kamera» | salon kamerasi |
| sichqoncha, g‘ildirak | o‘ng tomonni surish | kamerani burish, masofa |
| M · Tab · I · Esc | M · ☎ · II | xarita · telefon · inventar · pauza |

Gamepad ham ishlaydi (standart joylashuv).

## Tuzilma
```
src/
  assets/            tashqi fayllar + manifest.ts (litsenziya va holat)
  config/            mashinalar, iqtisod, mulk, grafika sozlamalari — barcha narx va sozlamalar shu yerda
  game/
    engine/          AssetManager (GLB/HDR, Meshopt, KTX2), PostFX, qurilmani aniqlash
    world/           shahar rejasi, protsedural binolar, teksturalar, chunk/LOD, instancing
    vehicles/        model, haydash fizikasi, litsenziyali GLB mashinalarni ulash
    player/ camera/ traffic/ npc/ weather/ audio/ input/ physics/
    Game.ts          asosiy sikl va tizimlarni bog‘lash
  systems/           iqtisod, ishlar, mashinalar, mulk, saqlash (UIdan alohida)
  stores/            Zustand (UI holati; simulyatsiya React’dan tashqarida)
  ui/                menyu, HUD, sensorli boshqaruv, panellar
```

## Qo‘shimcha hujjatlar
- `AUDIT.md` — arxitektura va grafika tahlili, placeholderlar ro‘yxati, tezlik va reja.
- `ASSETS.md` — litsenziyalar va litsenziyali mashina modellarini ulash yo‘riqnomasi.

## Dunyo (0.11)
Dunyo uzluksiz: asosiy yo‘llar, G‘uzordaryo va joylar foydalanuvchi yuborgan xarita suratlaridan olingan, mahalla ko‘chalari generatsiya qilinadi. Batafsil: `LANDMARK_DISTRICT_INVENTORY.md`.

## Hujjatlar
- `CHANGELOG.md` — o‘zgarishlar tarixi
- `TESTING.md` — test hisoboti
- `KNOWN_LIMITATIONS.md` — ma’lum cheklovlar
- `ASSET_INVENTORY.md`, `ASSET_LICENSES.md`, `ASSET_CREDITS.md`, `THIRD_PARTY_NOTICES.md` — assetlar va litsenziyalar
- `public/assets/vehicles/README.md` — real mashina modellarini qo‘shish tartibi

## Tez ishga tushirish (o‘rnatishsiz)
`OYNASH-uzbek-life.html` faylini brauzerda oching (Chrome, Edge, Safari yoki Firefox).

## Foto materiallar (ixtiyoriy, CC0)
```
npm run assets:fetch
npm run dev
```
ambientCG’dan asfalt, beton, suvoq, tuproq, maysa va boshqa materiallarni yuklaydi. O‘yin ularni avtomatik ishlatadi. Bitta HTML faylli versiyaga ular kirmaydi.
