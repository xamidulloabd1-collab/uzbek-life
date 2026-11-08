# TEST_REPORT — 0.12

Barcha o‘lchovlar shu ishlab chiqish muhitida, **dasturiy GPU (SwiftShader, headless Chromium)** bilan qilingan.
- Sizning kompyuteringizda (i5-4590, RX550 4 GB) va telefonda test qilinmagan.
- Haqiqiy qurilmalardagi FPS noma’lum.

## Hal qilingan muammolar

| # | Muammo | Yechim | O‘zgargan fayllar | Holati |
|---|---|---|---|---|
| 1 | Mahalla ichidagi ko‘chalar haqiqiy emas | OpenStreetMap importeri yozildi: `.osm` eksportini o‘yin yo‘llariga aylantiradi, ODbL atributsiyasi bilan. OSM ma’lumoti bo‘lsa, generatsiya qilingan ko‘chalar o‘rniga haqiqiy ko‘chalar ishlatiladi | `scripts/import-osm.mjs`, `src/game/world/guzor/osm.json`, `network.ts` | **Qisman.** Importer kichik test faylida ishladi. Haqiqiy G‘uzor OSM ma’lumoti olinmadi (pastga qarang). Hozircha ko‘chalar avvalgidek: asosiylari suratdan, ichkilari generatsiya |
| 2 | Binolar orasida bo‘sh tuproq | Bo‘sh yerlarga hududiga qarab ko‘kalam qo‘shildi: mahallada bog‘ va butalar, markazda maysa va daraxtlar, qishloqda bog‘lar. Yer rangi ham bo‘laklarga bo‘lindi: tomorqa, maysa, to‘q tuproq | `network.ts` (placeInfill), `World.ts` (groundColor) | Qilindi, skrinshotda ko‘rildi. Skameyka, chiqindi qutisi, elektr ustunlari qo‘shilmadi |
| 3 | Chorraha rangi yo‘ldan to‘q | Chorraha qoplamasi yo‘l teksturasining o‘rtacha rangiga moslab bo‘yaladi, g‘adir-budurligi bir xil, yomg‘irda ham yo‘l bilan birga ho‘llanadi | `World.ts` | Qilindi, skrinshotda keskin farq ko‘rinmadi |
| 4 | Motamsaro ona va markaziy favvora tasdiqlanmagan | Rus va o‘zbek tillarida qayta qidirildi: faqat Toshkent, Samarqand, Xorazm, Andijon, Namangandagi haykallar topildi | — | **Tasdiqlanmadi.** Parkdagi Xotira maydoni «joylashuvi o‘ylab topilgan» deb qoldi |
| 5 | Real mashinalar yo‘q | Sababi aniqlandi (pastga qarang). GitHub’da ochiq litsenziyali real mashina modeli qidirildi: 0 natija | — | **Hal qilinmadi** |
| 6 | Ishga tushish sekin | Yer bo‘laklari va daraxt guruhlari faqat kamera yaqinlashganda quriladi; yer normali qo‘shimcha hisoblarsiz olinadi | `World.ts` | Menyu 20,4 s → 15,2 s (dasturiy GPU) |

## Nima uchun model saytlari va OSM ochilmadi (sabab aniqlandi)
- Bu muhitda internetga faqat ruxsat etilgan domenlar orqali chiqiladi: GitHub, npm, PyPI va boshqalar.
- `sketchfab.com`, `blenderkit.com`, `cgtrader.com`, `kenney.nl`, `polyhaven.com`, `overpass-api.de`, `download.geofabrik.de` uchun **DNS nom topilmadi**. Sabab sayt emas, muhitning tarmoq ruxsatlari.
- GitHub’dagi «osm-uzbekistan» omborida faqat server sozlamalari bor, xarita ma’lumoti yo‘q.
- GitHub API soatlik so‘rov chegarasi (60 ta) ham tugadi.

## O‘lchovlar (dasturiy GPU)

| Ko‘rsatkich | Natija |
|---|---|
| Menyu paydo bo‘lishi | 15,2 s (avval 20,4 s) |
| «Yangi o‘yin» dan sahna tayyor bo‘lguncha | 1,2 s |
| World konstruktori | 4,8 s (teksturalar 4,0 s; yo‘llar 0,45 s; joylar 0,11 s) |
| JS xotirasi | 95 MB → sayr qilgandan keyin 114 MB |
| Boshqa hududga o‘tish (260 m atrofni darhol qurish) | 0,3 s |
| Bo‘laklab yuklash | sinovda 42 bo‘lak qurildi |
| FPS | 4,4 — faqat dasturiy GPU’da, haqiqiy qurilmaga taalluqli emas |
| GPU xotirasi | o‘lchab bo‘lmadi |
| Mashina modeli yuklanish vaqti | real modellar yo‘qligi uchun o‘lchanmadi |
| Konsol xatolari | yo‘q |

## Real modeli bilan qo‘shilgan mashinalar
**Yo‘q.** Hozirgi 8 ta mashina original va vaqtinchalik. `VEHICLE_INVENTORY.md` ga qarang.

## Hali yetishmayotgan aktivlar
- Chevrolet va boshqa real mashina modellari.
- G‘uzorning OSM ko‘cha ma’lumoti (`.osm` eksport).
- Bino GLB modellari.

## Qolgan muammolar
- 3D modellar panelini ikkita rejimga (o‘yinchi mulki va butun dunyo muhiti) ajratish **qilinmadi**.
- Ko‘chada skameyka, chiqindi qutisi, elektr ustunlari yo‘q.
- Teksturalarni yaratish dasturiy GPU’da 4 soniya oladi. Keyingi qadam: teksturalarni bir marta yaratib, keshda saqlash.


# 0.13 — mustaqil bajarilgan ishlar

| Muammo | Nima qilindi | Fayllar | Holati |
|---|---|---|---|
| Ichki ko‘chalar | Har ~380 m mahallaga o‘z yo‘nalishi va kvartal o‘lchami berildi; ko‘chalar egri; 266 ta berk ko‘cha qo‘shildi. Har bir yo‘lda manba belgisi bor (`osm` / `alley` / `major`) | `guzor/network.ts`, `Traffic.ts`, `World.ts`, `MapRenderer.ts` | Qilindi. Ko‘chalar baribir generatsiya, haqiqiy emas |
| OSM ma’lumoti | 4 xil manba tekshirildi (`OSM_DATA_SOURCES.md`) | — | Bloklangan: tarmoq ruxsati yo‘q |
| Real mashinalar | GitHub qidiruvi: 0 natija. Model saytlariga DNS yo‘q | — | Bloklangan |
| Landmarklar | Motamsaro ona va favvora qayta qidirildi | `LANDMARK_VERIFICATION.md` | Tasdiqlanmadi |
| 3D modellar paneli | Uch bo‘limga ajratildi: Mulk muharriri, Dunyo muharriri (ishlab chiquvchi rejimi bilan himoyalangan), Mashina modellari | `AssetLab.tsx`, `World.ts`, `Game.ts`, `library.ts` | Qilindi va sinaldi |

## 0.13 sinovlari (dasturiy GPU)
- Tip tekshiruvi va ikkala build xatosiz.
- Konsol xatolari: yo‘q. HTTP 4xx/5xx javoblari: yo‘q.
- Menyu 16,3 s; World konstruktori 3,0 s (avval 4,8 s); JS xotira 111 MB.
- **Dunyo muharriri:** ishlab chiquvchi rejimini yoqish → uchastka tanlash → siljitish, aylantirish, yashirish → saqlash → orqaga qaytarish → sahifani qayta yuklash.
  - O‘zgarish saqlandi va qayta yuklangandan keyin ham qoldi.
  - Ketma-ket bosishda oldingi o‘zgarish yo‘qolib qolish xatosi topildi va tuzatildi.
- **Dunyo generatsiyasi:** 2 171 yo‘l bo‘lagi (266 berk ko‘cha), 2 530 uchastka, 21 890 daraxt, buta va maysa.


# 0.14 — natijalar

| # | Vazifa | Holati | Izoh |
|---|---|---|---|
| 1 | Real mashinalar | **Blocked** | Sketchfab, Poly Haven va boshqa model saytlari qayta tekshirildi: tarmoq ruxsati yo‘q (HTTP 000). GitHub’da «chevrolet gltf» bo‘yicha 0 natija. 8 ta original mashina vaqtinchalik model bo‘lib qoldi, Chevrolet deb ko‘rsatilmaydi |
| 2 | Haqiqiy G‘uzor yo‘llari | **Blocked** (ma’lumot yo‘q) | openstreetmap.org, overpass-api.de, geofabrik qayta tekshirildi: ochilmadi. Importer saqlandi. Yo‘llar `osm` / `major` / `alley` belgilari bilan ajratilgan |
| 3a | Muharrir: daraxtlar, chiroqlar, skameyka va chiqindi qutilari | **Completed** | Yangi obyektlar: 427 skameyka, 27 quti. 21 890 daraxt/buta/maysa, chiroqlar |
| 3b | Hudud va tur bo‘yicha filtr | **Completed** | |
| 3c | Guruhlash (bir nechta obyektga bir amal) | **Completed** | |
| 3d | Undo/Redo | **Completed** | Sinovda 2 o‘zgarish → Undo → 0 → Redo → 2 |
| 3e | Saqlash | **Completed** | Bino + chiroq + daraxt o‘zgarishlari qayta yuklangandan keyin ham qoldi (3 ta) |
| 3f | Bino ko‘chirilganda yer balandligi va collision | **Completed** | Bino 9,2 m siljitildi: yer balandligi yangi joyda ishladi. Yashirilganda collision qutilari 0 ta, qayta ko‘rsatilganda 3 ta. «Asl holat» bino joyini aniq tikladi |
| 3g | Yo‘l obyektlari (svetofor, belgi) | **Qilinmadi** | Faqat chiroq, skameyka va quti tahrirlanadi |
| 4 | Motamsaro ona va favvora | **Not verified** | Qayta qidirildi, G‘uzorga oid ishonchli manba yo‘q. Qo‘shilmadi |
| 5 | Ishga tushish tezligi | **Qisman** | GLB kutubxonasi endi menyudan keyin fonda yuklanadi (bu bosqich 3,0 s → 0,003 s). Katalog so‘roviga 1,2 s chegara qo‘yildi. Lekin dasturiy GPU’da menyu vaqti ≈ 20 s bo‘lib qoldi: sahifa tahlili ≈ 6,6 s va init tugagandan keyingi birinchi kadr/shaderlar ≈ 7 s. i5-4590 + RX550 da o‘lchanmagan |

## 0.14 sinovlari (headless Chromium, dasturiy GPU)
- Build va tip tekshiruvi: xatosiz.
- Konsol xatolari: yo‘q (4 ta sessiya).
- Init bosqichlari: katalog 2,3 s · shahar 3,5 s · osmon 0,3 s · personaj 0,26 s · kutubxona 0,003 s (fonda).
- Haqiqiy qurilmada FPS va yuklanish vaqti o‘lchanmagan.
