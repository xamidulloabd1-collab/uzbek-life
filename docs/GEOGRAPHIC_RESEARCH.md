# GEOGRAPHIC_RESEARCH — Milestone 1 holati

## Natija: real GIS ma’lumotlari bu muhitda olinmadi
Overpass, OSM API, Geofabrik, Copernicus DEM, OpenTopography va gov.uz hostlari ish muhitidan ochilmaydi (`curl` → 000, DNS topilmadi).

## Ma’lumot kelganda ishlaydigan pipeline (tayyor)
1. Yo‘llar va boshqa obyektlar:
   ```
   node scripts/gis/fetch-osm.mjs
   ```
   Yo‘llar, suv yo‘llari, temir yo‘l, binolar va joylarni yuklaydi, so‘ng `scripts/import-osm.mjs` orqali `src/game/world/guzor/osm.json` ga yozadi. Shundan keyin o‘yin generatsiya qilingan ko‘chalar o‘rniga OSM yo‘llarini ishlatadi va har bir yo‘l `osm = true` belgisini oladi.
2. Relyef:
   ```
   node scripts/gis/fetch-dem.mjs
   ```
   Copernicus GLO-30 balandligini 60 m qadamli `src/game/world/gis/dem.json` ga yozadi. `baseH()` uni avtomatik ishlatadi: gorizontal va vertikal masshtab 1:2, G‘uzor markazi = 0 m. Sintetik GeoTIFF bilan sinalgan, haqiqiy ma’lumot bilan sinalmagan.
3. Tekshiruv:
   ```
   node scripts/validation/validate-roads.mjs
   ```
   Natija `docs/ROAD_VALIDATION.md` ga yoziladi.

## Hozirgi dunyo nimaga asoslangan
- **Asosiy yo‘llar va daryo:** skrinshotlardan qo‘lda chizilgan, ya’ni taxminiy.
- **Mahalla ko‘chalari:** generatsiya qilingan, haqiqiy emas.
- **Relyef:** analitik (sinus to‘lqinlar + shimoli-sharqdagi adirlar), haqiqiy emas.
- **Joylar:** `LOCATION_VERIFICATION.md` ga qarang.

## Mahallalar soni
Siz keltirgan ma’lumot: o‘zbekcha sahifada 47 ta, boshqa tillarda 51 ta. Bu tafovut **tekshirilmadi** — gov.uz ochilmaydi. O‘yinda 16 ta mahalla nomi faqat hududlarga yorliq sifatida berilgan. Ularning joylashuvi haqiqiy chegaralarga mos **emas**.
