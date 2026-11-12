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


# 0.15 — realizm va o‘yin jarayoni

| Vazifa | Holati | Izoh |
|---|---|---|
| TurboSquid / Poly Haven / ambientCG / OpenGameArt / Sketchfab modellari | **Blocked** | Barchasi tarmoq ruxsati yo‘qligi sabab ochilmadi (HTTP 000) |
| Ruxsat etilgan manba: npm `@pmndrs/assets` (CC0) | **Completed** | Uchta HDRI (quyosh chiqishi, botishi, tun) va bulut teksturasi qo‘shildi |
| Vaqtga qarab yorug‘lik va aks-sado | **Completed** | Kun, tong, shom va tun uchun alohida muhit xaritasi; sinovda 4 tasi yuklandi, shomga almashish ko‘rildi |
| Bulut qatlami | **Completed** | Real bulut suratidan billbordlar; bulutli va yomg‘irli havoda zichlashadi |
| Rang tuzatish | **Completed** | To‘yinganlik 1,12 → 0,96, kontrast 1,06 → 1,03, vinyetka 0,22 → 0,12 (multfilmdek yorqinlik kamaydi) |
| Teksturalar aniqligi | **Completed** | Yuqori va Ultra’da 1024 px |
| Noutbuk GPU’sini aniqlash | **Completed** | MX350 va Iris Xe → «O‘rta» |
| Yutuqlar | **Completed** | 12 ta yutuq va 6 ta joyni kashf etish, pul mukofoti bilan; yutuqlar saqlanadi (sinovda tasdiqlandi) |
| Tasodifiy voqealar | **Completed** | Yo‘lda qolgan haydovchi, yo‘qolgan hamyon, bozor chegirmasi, to‘y mavsumi, benzin narxi; narxlar tegishli tizimlarga ulangan. Sinov: voqea joyiga borilganda +120 000 so‘m tushdi |
| Yangi «Yutuqlar» paneli | **Completed** | |
| Fotorealistik mashinalar, binolar, personaj | **Qilinmadi** | Litsenziyali modellar olib bo‘lmadi; protsedural modellar qoldi |
| React Three Fiber / Rapier’ga o‘tish | **Qilinmadi (ataylab)** | Mavjud Three.js arxitekturasi ishlayapti; ko‘chirish mavjud tizimlarni buzar edi |
| Interyerlar, kiyim tanlash, NPC kun tartibi | **Qilinmadi** | |

## 0.15 sinovlari (dasturiy GPU)
- Tip tekshiruvi va ikkala build xatosiz.
- Konsol xatolari: yo‘q. Faqat Chrome’ning `willReadFrequently` haqidagi ogohlantirishi bor.
- Kun, shom, tun va bulutli havo skrinshotlari olindi.
- Musofir ota masjidiga borilganda `visit-mosque` yutug‘i ochildi (+30 000 so‘m) va saqlashga yozildi.


# 0.16 — interyerlar, kiyim, shahar ritmi

## Yakuniy jadval
| Funksiya | Oldingi holat | Yangi holat | Isbot |
|---|---|---|---|
| Realistik mashina modellari | yo‘q (8 ta protsedural) | **Blocked** — o‘zgarmadi | TurboSquid, Sketchfab va boshqa model saytlari DNS orqali ochilmaydi |
| Realistik binolar | protsedural | **Blocked** — o‘zgarmadi | xuddi shu sabab |
| Yakuniy personaj (Mixamo o‘rniga) | vaqtinchalik Michelle | **Blocked** — o‘zgarmadi | xuddi shu sabab |
| Bino interyerlari | yo‘q | **Completed (2 ta)** | Uy: mehmonxona, gilam, xontaxta, televizor, yotoq, shkaf, oshxona, derazalar, chiroqlar. Bozor do‘koni: javonlar, muzlatkich, kassa, kiyim stendi. Kirish/chiqishda ekran qorayadi; ichkarida pol balandligi, devor collision va kamera devordan chiqib ketmasligi sinaldi |
| Uyga kirish | «dam olish» tugmasi | **Completed** | Uyingiz va sotib olingan uy/kvartira → «Uyga kirish»; ichkarida yotoq (uxlash va saqlash), kiyim javoni, garaj |
| Kiyim tizimi | yo‘q | **Qisman** | Do‘ppi (qora, oq), kepka, quyosh ko‘zoynagi do‘konda sotiladi, kiyiladi, yechiladi va saqlanadi; personaj boshida haqiqiy 3D obyekt sifatida ko‘rinadi (skrinshot). Ko‘ylak va shim almashmaydi: Michelle modeli bitta mesh va bitta teksturadan iborat |
| Ish vaqtlari | yo‘q | **Completed** | Bank 9–18, birja 8–20, avtosalon 9–20, servis 8–20, osh 7–23, bozor 6–20; yopiq paytda yozuv chiqadi |
| NPC kun ritmi | yo‘q | **Qisman** | Transport va piyodalar soni soatga qarab o‘zgaradi (tunda kam, ertalab va kechqurun ko‘p, yomg‘irda piyodalar kamayadi). Har bir NPC uchun alohida kun tartibi (uy → ish → uy) yo‘q |
| Yutuqlar, tasodifiy voqealar | 0.15 da | Completed | 0.15 hisobotiga qarang |
| Saqlash | bor | Completed | Kiyim va javon saqlanishi sinaldi: `{"outfit":{"hat":"doppi","glasses":true},"wardrobe":["doppi","glasses"]}` |

## Sinov (dasturiy GPU)
- Tip tekshiruvi va ikkala build xatosiz.
- Konsolda faqat Google Fonts yuklanmagani haqida xabar bor (bu muhitda internet yopiq), boshqa xato yo‘q.
- Uyga kirish: HUD «Uyingiz», pol balandligi 0,00.
- Do‘kondan xarid: 950 000 → 800 000 so‘m (do‘ppi 60 000 + ko‘zoynak 90 000).
- Kamera eshik orqali tashqariga chiqib ketishi topildi va tuzatildi.


# 0.17 — aktivlarga kirish, material pipeline, 5 ta interyer

| Funksiya | Oldingi holat | Yangi holat | Isbot |
|---|---|---|---|
| Asset saytlariga kirish | yopiq | **Qisman ochiq** | Saytlar ochiladi, lekin yuklash va API hostlari yopiq (NETWORK_ACCESS.md) |
| Real mashina, bino, personaj modellari | yo‘q | **Blocked** | Yuklash hostlari yopiq. OpenGameArt’dagi mashinalar realistik emas, ataylab qo‘shilmadi |
| Foto PBR materiallar | yo‘q | **Pipeline completed, aktivlar blocked** | `npm run assets:fetch` (ambientCG CC0, 10 ta material, ID’lar API orqali tekshirilgan). Runtime yuklovchi sinov teksturalari bilan sinaldi: maysa, g‘isht va parket qo‘llandi (2048 px tekstura yuklandi). Sinov fayllari arxivga kirmagan |
| Bank interyeri | yo‘q | **Completed** | Kassa oynalari, bankomat; ikkala nuqta bank panelini ochdi |
| Osh markazi (restoran) | yo‘q | **Completed** | Stol-stullar, so‘ri va gilam, qozon, devor gilami; «Osh buyurtma qilish» ishladi |
| Idora (mehnat birjasi va ko‘chmas mulk) | yo‘q | **Completed** | Ikkala stol tegishli panellarni ochdi |
| Avtoservis | yo‘q | **Completed** | Ko‘targich, asboblar shkafi, shinalar; ta’mir paneli ochildi |
| Avtosalon interyeri | yo‘q | **Completed** | Ko‘rgazma poydevorlari, sotuvchi stoli; avtosalon paneli ochildi. Poydevorlarda mashina yo‘q |
| Kamera interyerda | devordan chiqib ketardi | **Tuzatildi** | Kamera ship ostida va o‘yinchidan 3,2 m ichida ushlab turiladi |
| Kafe, supermarket | yo‘q | **Qilinmadi** | Ular uchun xaritada joy (POI) yo‘q |
| NPC shaxsiy kun tartibi | yo‘q | **Qilinmadi** | Keyingi bosqich |
| Modulli personaj va to‘liq kiyim | qisman | **Blocked** | Modulli model kerak (ASSET_MANIFEST #3) |

Sinov: tip tekshiruvi va ikkala build xatosiz. Konsolda xato yo‘q, faqat Google Fonts yuklanmagani haqida xabar. Barcha interyer nuqtalari brauzerda chaqirib ko‘rildi.


# 0.18 — taksi mijozi, GPS, yo‘llar, mashina nomlari

| Funksiya | Oldingi holat | Hozirgi holat | Haqiqiy sinov dalili |
|---|---|---|---|
| Taksi mijozi 3D dunyoda | faqat belgi va matn | **Completed** | Mijoz yo‘l chetida turadi, taksiga qaraydi, mashinaga yuradi va yo‘qoladi (yo‘lovchi), manzilda tushib, uzoqlashadi. Sinov holatlari: wait → ride; tushgan mijoz skrinshotda ko‘rinadi |
| Taksi to‘lovi | bor | Completed | 950 000 → 1 136 000 so‘m (+136 000, tezlik bonusi bilan) |
| Yo‘l tarmog‘i bo‘yicha GPS | to‘g‘ri chiziq masofasi | **Completed** | Marshrut 2 309 m, ETA, burilish matni; yo‘l ustida chiziq va minixaritada marshrut (skrinshot) |
| Marshrutni qayta hisoblash | yo‘q | **Completed** (kodda) | Marshrutdan 24 m chetga chiqilsa yoki har 4 s. Alohida avtomatik sinov qilinmadi |
| Barcha ishlar uchun navigatsiya | yo‘q | **Completed** | Bitta servis joriy ish qadamini yoki GPS nuqtasini kuzatadi |
| Svetoforlar va chorraha chiziqlari | tartibsiz | **Completed** | Zebra, to‘xtash chizig‘i, ustunlar chorraha burchaklarida (skrinshot) |
| Takroriy (parallel) ko‘chalar | bor edi | **Tuzatildi** | 107 ta olib tashlandi |
| Mashina nomlari | Lola, Qoya va hokazo | **Completed** | Sarbon Motors (o‘ylab topilgan brend): S3, City, S5, S4 Classic, S7, Van, X3, X5; ishlab chiqaruvchi va yil maydonlari bilan. Real brend nomlari ataylab ishlatilmadi — modellar real mashinalar emas |
| Realistik odam modellari (NPC) | multfilmdek | **Blocked** | Model manbalarining yuklash hostlari yopiq (NETWORK_ACCESS.md). Mijoz vaqtinchalik Mixamo modelidan foydalanadi |
| NPC shaxsiy kun tartibi | yo‘q | **Qilinmadi** | Keyingi bosqich |
| Kafe, supermarket joylari | yo‘q | **Qilinmadi** | |
| Realistik mashina va bino modellari | yo‘q | **Blocked** | NETWORK_ACCESS.md |

Sinov: tip tekshiruvi va ikkala build xatosiz. Konsolda xato chiqmadi. Barcha sinovlar dasturiy GPU’da o‘tkazildi.


# 0.19 — real aktivlar

| Funksiya | Oldin | Hozir | Dalil |
|---|---|---|---|
| ambientCG CC0 PBR materiallari | yuklab bo‘lmasdi | **Completed (ko‘p faylli build)** | 10/10 yuklandi. O‘yinda asfalt, beton, plitka, suvoq, tuproq, maysa, tom, g‘isht, parket va kafelga qo‘llandi (`photoMaterials` 10 ta, asfalt teksturasi 1024 px). Skrinshot: real asfalt va plitka |
| Bitta HTML (artifact) ichiga 512 px materiallarni qo‘shish | — | **Olib tashlandi** | Dasturiy GPU’da sahifa qulab tushdi. Qaytarilgach, HTML barqaror ishladi |
| Real mashinalar (Sketchfab) | yo‘q | **Blocked — token kerak** | 15 ta mashina bo‘yicha nomzodlar va litsenziyalar API orqali tekshirildi. 3 tasi qayta yuklangani uchun rad etildi. `/download` → 401 |
| `vehicles:fetch` (Sketchfab yuklovchi) | yo‘q | **Qisman sinalgan** | Litsenziya va qayta yuklash tekshiruvi ishladi (Damas qabul qilindi, Malibu rad etildi). Yuklash qismi token yo‘qligi sabab sinalmadi |
| Blender skripti (`tools/blender/prepare_vehicle.py`) | yo‘q | **Sinalmagan** | Bu muhitda Blender yo‘q; sizning kompyuteringizda ishga tushirish kerak |


# 0.20 — Milestone 1 (GIS) holati

| Vazifa | Holati | Dalil |
|---|---|---|
| Haqiqiy OSM yo‘llari | **Blocked** | Overpass, OSM API va Geofabrik — DNS topilmadi (docs/GEOGRAPHIC_SOURCES.md) |
| Haqiqiy relyef (DEM) | **Blocked** | Copernicus S3 — DNS topilmadi. Pipeline va o‘yindagi ulanish sintetik GeoTIFF bilan sinaldi (balandliklar o‘qildi, `baseH` qiyalikni qaytardi) |
| Yo‘llarni tekshirish skripti | **Completed** | `validate-roads.mjs` ishga tushirildi |
| Uzilgan yo‘l bo‘laklari | **Tuzatildi** | Avval 62 ta bog‘lanish komponenti edi (122 ta tugun asosiy tarmoqdan ajralgan); endi 1 ta |
| Rejalanmagan berk ko‘chalar / ustma-ust parallel yo‘llar | **0 / 0** | validate-roads |
| Yo‘lga tegib turgan bino uchastkalari | 11 → **3** (2 537 tadan) | validate-roads |
| Regressiya | **O‘tdi** | 10 ta material, transport, taksi mijozi «wait», GPS «Chapga buriling · 28 m», konsolda xato yo‘q |


# 0.21 — Stage 1–2

| Funksiya | Oldin | Hozir | Dalil |
|---|---|---|---|
| Svetoforli chorrahalar | 129 | **44** | network statistikasi; tip tekshiruvi va build xatosiz |
| Elektr ustunlari va simlar (mahalla, qishloq) | yo‘q | **2 112 ta ustun / 1 166 ta oraliq** | skrinshot: ustun va simlar |
| Ko‘cha bo‘yi ariqlari | yo‘q | **bor** (mahalla ko‘chalari) | buildda geometriya qo‘shildi |
| Kun uzunligi va shafaq | botish 18:00, 18:45 da tun | **botish ≈ 19:20**, 18:55 da oltin shafaq | skrinshotlar: 06:40, 18:55, 22:00 |
| Yo‘l tekshiruvi | — | komponentlar 1, berk ko‘chalar 0, ustma-ust yo‘llar 0 | validate-roads |
| Konsol xatolari | — | yo‘q | Playwright sinovi |
| FPS | — | o‘lchanmadi | faqat dasturiy GPU mavjud |


# 0.22 — unumdorlik
- **Uchburchaklar:** 4,50 mln → 1,25 mln (−72 %), bir xil ko‘rinishda (PERFORMANCE_REPORT.md).
- **Regressiya sinovi o‘tdi:** 10 ta material, transport, taksi mijozi «wait», GPS «O‘ngga buriling · 28 m», konsolda xato yo‘q.
- **Real modellar** (mashina, odam, bino): hali ham to‘xtab turibdi (VEHICLE_INVENTORY.md, NETWORK_ACCESS.md).

# 0.24 test natijalari (headless Chromium, SwiftShader dasturiy GPU, 1280×720, O‘rta preset)
- `npm install`, `tsc --noEmit`, `npm run build`: xatosiz. `validate-roads.mjs` ishladi, yo‘llar o‘zgartirilmagan (`plotsOnRoad: 3` avvaldan bor).
- Menyu 17–21 s da chiqdi. Barcha assetlar yuklandi: `char.player` va 7 ta `char.npc.*`.
- Konsolda JS xatosi yo‘q. Faqat bitta tarmoq xabari bor (`ERR_NAME_NOT_RESOLVED` — test muhitida tashqi hostga chiqib bo‘lmaydi).
- **Tekshirildi (skrinshotlar `docs/screenshots/`):**
  - yangi o‘yin;
  - balans 1 mlrd so‘m;
  - ochiq darvoza oldida paydo bo‘lish va hovlidagi mashina;
  - mashinaga o‘tirish ketma-ketligi: yurish → eshik → cho‘kkalash → o‘rindiq;
  - o‘rindiqda o‘tirgan Joshqin;
  - mashinadan tushib turish;
  - uy interyeriga kirish (eshik animatsiyasidan keyin);
  - NPC modeli va umumiy kliplar.
- **Tekshirilmadi:**
  - to‘liq taksi missiyasi davomida yo‘lovchining o‘tirishi va tushishi (komponent alohida tekshirilgan);
  - haydash fizikasi (kod o‘zgarmagan);
  - telefon/touch boshqaruvi;
  - saqlash/yuklash (yangi maydon qo‘shilmagan).
