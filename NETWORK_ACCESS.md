# NETWORK_ACCESS — 0.17 tekshiruvi (shu ish muhitidan)

| Manba | Sayt | API / yuklash hosti | Natija |
|---|---|---|---|
| TurboSquid | `turbosquid.com` → 301 | `www.turbosquid.com` | **Yopiq**. Bepul yuklash uchun akkaunt ham kerak |
| Sketchfab | `sketchfab.com` 200 | `api.sketchfab.com` | **Yopiq**. Yuklash API’si foydalanuvchi tokenini ham talab qiladi |
| Poly Haven | `polyhaven.com` 200 | `api.polyhaven.com`, `dl.polyhaven.org` | **Yopiq**. Fayllar shu hostlarda turadi |
| ambientCG | `ambientcg.com` 200, API ishlaydi | `acg-download.struffelproductions.com` (yo‘naltirish) | **Yuklash yopiq**. Qidiruv va materiallarni tanlash ishladi |
| OpenGameArt | `opengameart.org` 200 | xuddi shu domen | **Ochiq**. Lekin mashinalar past poligonli yoki multfilm uslubida, qo‘shilmadi |
| Kenney | `kenney.nl` 403 | — | Yopiq (stili ham multfilm) |
| BlenderKit | `blenderkit.com` → 301 | `www.blenderkit.com` | **Yopiq**. API kaliti va Blender kerak |

## Ochish uchun ruxsatlar ro‘yxatiga qo‘shiladigan hostlar
- `www.turbosquid.com`
- `api.sketchfab.com`
- `media.sketchfab.com`
- `api.polyhaven.com`
- `dl.polyhaven.org`
- `acg-download.struffelproductions.com`
- `www.blenderkit.com`

Hostlarning o‘zi yetmaydigan joylar:
- **Sketchfab va TurboSquid** — bundan tashqari akkaunt va token kerak.
- **Poly Haven va ambientCG** — CC0 litsenziyali, akkaunt talab qilmaydi.

## Muqobil yo‘l: sizning kompyuteringizda
Kompyuteringizda internet cheklanmagan:
```
npm run assets:fetch
```
Bu buyruq ambientCG’dan 10 ta CC0 PBR materialni `public/assets/materials/` ga yuklaydi. O‘yin ularni avtomatik ishlatadi (ko‘p faylli build: `npm run dev`, Netlify yoki Vercel).


## 0.19 qayta tekshiruv (2026-11-12)

| Host | Natija |
|---|---|
| `acg-download.struffelproductions.com` | **ochiq** — 10 ta material yuklandi |
| `api.polyhaven.com` | ochiq (Poly Haven’da mashina modeli yo‘q) |
| `dl.polyhaven.org` | bosh sahifa 521, fayllar sinalmadi |
| `api.sketchfab.com` | qidiruv va model ma’lumotlari ochiq; `/download` 401 — token kerak |
| `www.turbosquid.com` | 403 (bot himoyasi); yuklash uchun login ham kerak |
| `www.blenderkit.com` | API qidiruvi ochiq; yuklash uchun API kaliti va Blender kerak |
| `kenney.nl` | 403 |
