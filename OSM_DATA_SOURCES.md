# OSM_DATA_SOURCES — G‘uzor yo‘l ma’lumotlari manbalari

## Tekshirilgan manbalar (2026-11-08)

| Manba | Natija | Sababi |
|---|---|---|
| openstreetmap.org API, overpass-api.de, download.geofabrik.de | ochilmadi | Ish muhitining tarmog‘ida bu domenlarga ruxsat yo‘q, DNS nom topilmadi |
| GitHub: «uzbekistan osm», «uzbekistan geojson roads» | 2 ta ombor | `samandarozodbekovich/osm-uzbekistan` — faqat server sozlamalari, xarita ma’lumoti yo‘q. `anvar42/osmon` — tekshirilmadi, GitHub API so‘rov chegarasi tugadi |
| npm / PyPI | tekshirildi | G‘uzor ma’lumotini o‘z ichida saqlaydigan paket topilmadi. OSMnx va pyrosm ham ma’lumotni yuqoridagi yopiq serverlardan oladi |

## O‘yindagi yo‘llar qayerdan olingan

| Tur | Manba | Belgisi |
|---|---|---|
| Asosiy yo‘llar: A380, M39, Kitob yo‘li, markaziy ko‘chalar | Foydalanuvchi yuborgan Google Maps suratlaridan qo‘lda chizilgan (suratlar o‘yinga qo‘shilmagan) | `Edge.osm = false`, `major = true` |
| G‘uzordaryo | Suratlardan chizilgan, taxminiy | `RIVER` |
| Mahalla ko‘chalari | **Generatsiya qilingan.** Har ~380 m mahallaga o‘z yo‘nalishi va kvartal o‘lchami berilgan; ko‘chalar biroz egri, ichkariga berk ko‘chalar kiradi. **Haqiqiy ko‘chalar emas** | `Edge.osm = false`, `major = false`, `alley` |

## OSM ma’lumoti paydo bo‘lganda
- `scripts/import-osm.mjs` OSM XML faylni `src/game/world/guzor/osm.json` ga aylantiradi.
- Shunda o‘yin generatsiya qilingan ko‘chalar o‘rniga OSM ko‘chalarini ishlatadi va har bir yo‘l `osm = true` belgisini oladi.
- Atributsiya: «© OpenStreetMap contributors, ODbL 1.0».
- Hozir `osm.json` bo‘sh. Importer faqat sinov fayli bilan tekshirilgan.


## 0.14 qayta tekshiruv
- overpass-api.de, openstreetmap.org, download.geofabrik.de: ochilmadi (HTTP 000).
- GitHub qidiruvi «guzar OR guzor map»: tegishli ma’lumot topilmadi.
- `osm.json` bo‘sh. Barcha mahalla ko‘chalari `osm=false`.
