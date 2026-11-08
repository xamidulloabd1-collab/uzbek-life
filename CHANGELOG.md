# 0.3 — grafikani yangilash (1-, 2-, 4-, 5- va 7-bosqichlarning amalga oshirilgan qismi)

## O‘zgargan fayllar
| Fayl | Nima o‘zgardi |
|---|---|
| `src/game/world/facadeKit.ts` *(yangi)* | instanced modulli fasadlar: ramkali derazalar (raf, peshtoq), kechasi yonadigan oynalar, panelli eshiklar soyaboni bilan, oynalangan balkonlar |
| `src/game/world/buildings.ts` | panel va zamonaviy uylarga haqiqiy derazalar va podyezd eshiklari; mahalla uylari derazasiz devor + 3D deraza va eshiklar; karniz; ariqning beton qirg‘oqlari; butalar va o‘t |
| `src/game/world/World.ts` | har bir chunk’ka fasad modullari (LOD masofasi ichida); yangi devor materiallari; butalar va o‘t (alpha kartochkalar); to‘xtash chiziqlari, lyuklar, yomg‘ir suvi panjaralari |
| `src/game/world/textures.ts` | derazasiz devor teksturalari (g‘isht, suvoq va sokol), o‘t teksturasi |
| `src/game/engine/PostFX.ts` | post yo‘lida AgX tone mapping + kinematik rang gradatsiyasi; bloom sustlashtirildi |
| `src/game/weather/Environment.ts` | Ultra’da 4096 soya xaritasi; yomg‘irda tuman va qorong‘ilik; ekspozitsiya koeffitsienti |
| `src/game/player/Player.ts` | Mixamo kliplari suyak nomi bo‘yicha retarget qilinadi; procedural sakrash pozasi; pozani tekshirish va zaxira figura |
| `src/game/Game.ts` | fuqaro personaj + lokomotsiya kliplari; mashinaga o‘tirishdan oldin eshik oldiga yurish; avtomatik sifat |
| `src/config/graphics.ts`, `src/types/index.ts`, `src/systems/save/save.ts`, `src/ui/panels/panels.tsx` | Ultra soya darajasi, sifat zinapoyasi, «Avtomatik sifat» sozlamasi |
| `src/assets/*` | yangi papka tuzilmasi; `civilian-michelle.glb`; `mixamo-locomotion.glb` (faqat skelet va kliplar); `Soldier.glb` olib tashlandi |
| `MISSING_ASSETS.md` *(yangi)* | yetishmayotgan modellarning aniq ro‘yxati va texnik talablari |

## Tekshiruv
- `tsc --noEmit` va production build o‘tdi (bitta faylli build 8,0 MB).
- Avtomatik test (dasturiy GPU): assetlar yuklanadi, 406 ta instanced mesh (31 520 nusxa), mashinaga o‘tirish va haydash ishlaydi, JS xatolari yo‘q.

# 0.4 — haqiqiy GLB assetlar uchun to‘liq ishlaydigan tizim

| Fayl | Nima o‘zgardi |
|---|---|
| `src/assets/library.ts` *(yangi)* | `vehicles/ buildings/ props/ vegetation/` papkalaridagi GLB va `.license.json` fayllar build vaqtida avtomatik topiladi |
| `src/game/engine/UserAssets.ts` *(yangi)* | o‘yin ichida qo‘shilgan GLB fayllarni IndexedDB’da saqlash |
| `src/ui/panels/AssetLab.tsx` *(yangi)*, `Shell.tsx` | «3D modellar» paneli: har bir slot holati, uchburchaklar soni, litsenziya, fayl qo‘shish va o‘chirish |
| `src/game/world/Showcase.ts` *(yangi)* | namunaviy mahalla: GLB uylar va darvozalar hovli joylariga moslab o‘rnatiladi; daraxt, buta va chiroqlar instanced nusxalar o‘rniga qo‘yiladi; har bir GLB meshi uchun bitta draw call |
| `src/game/world/World.ts`, `buildings.ts` | kvartalni qayta qurish (uylar, darvozalar, parkovkadagi mashinalarsiz); slotlarni yozib borish; instanced prop’larni yashirish |
| `src/game/vehicles/Vehicle.ts` | g‘ildiraklarni nomi va joylashuvi bo‘yicha topish, markazida aylanish nuqtasi; old tomon burchagi |
| `src/game/traffic/Traffic.ts` | transport oqimida GLB mashinalar; GLB bo‘lsa protsedural mashinalar chiqmaydi |
| `src/game/engine/AssetManager.ts` | `parseGLB`, Draco dekoderi, tushunarli xato xabarlari |
| `src/game/Game.ts` | kutubxonani yuklash va qo‘llash, yuklanish hisoboti |

Tekshiruv: tizim test GLB fayllari bilan oxirigacha sinaldi (pastga qarang). Ular loyihaga qo‘shilmagan.

# 0.7 — ochiq dunyo mexanikasi

- **Begona mashinalar (o‘yindagi uydirma mexanika):**
  - ko‘chada turgan 88 ta NPC mashinasiga o‘tirish mumkin;
  - qulflanganlarida «qulfni ochish» mini-o‘yini bor;
  - harakatdagi mashina to‘xtaganda haydovchini tushirish mumkin, tez ketayotganida esa ruxsat berilmaydi;
  - mashina egalik holatlari: sizniki, begona, vaqtincha, avtosalon.
- **Qidiruv darajasi 0–3 va politsiya:** 2-darajada bitta, 3-darajada ikkita patrul mashinasi quvadi. Uzoqlashsangiz qidiruv sekin pasayadi, ushlansangiz jarima to‘laysiz.
- **Mashina boshqaruvi:** faralar (H), burilish chiroqlari (Q/R), signal (G), dvigatel (X), kamera (C/V); telefonda ham tugmalari bor.
- **Ob-havo:** tuman qo‘shildi.
- **Iqtisod va hayot:**
  - o‘yin kam pul bilan boshlanadi: 950 000 so‘m naqd, bankda 0;
  - kuch-quvvat (ochlik) va ovqatlanish qo‘shildi;
  - yangi ishlar: yuk tashish va ustaxona;
  - biznesni boshqarish: daromad, xarajat, sof foyda va kengaytirish;
  - begona mashinani garajda rasmiylashtirib, o‘zingizniki qilish mumkin.


# 0.8 — kengaytiriladigan mashinalar kolleksiyasi
- **Mashinalar katalogi:** `public/assets/vehicles/<kategoriya>/<id>/` papkasidagi `model.glb` + `vehicle.json` avtomatik ro‘yxatga olinadi.
  - Skaner litsenziyasi yo‘q yoki mos kelmaydigan modellarni rad etadi.
  - Kredit jadvali avtomatik tuziladi.
- **11 ta kategoriya** (sedan … avtobus): har biri o‘z fizika va o‘lcham shabloniga ega.
- **Transport:**
  - mashinalar tumanga qarab vaznli tasodif bilan tanlanadi;
  - bir xil model yaqin atrofda takrorlanmaydi;
  - modellar faqat kerak bo‘lganda yuklanadi, bir marta yuklangani keshda qoladi.
- **To‘xtab turgan mashinalar:** yaqinlashganda haqiqiy modelga almashadi.
- **Avtosalon:** kategoriya filtri va litsenziya ma’lumoti; tanlangan mashina 3D ko‘rinishda haqiqiy GLB bilan chiqadi.

# 0.9 — audit, litsenziya hujjatlari, logo
- **G‘ildiraklar:** GLB mashinalarda g‘ildirak nomi va shakli bo‘yicha aniqlanadi, har burchakdan bittadan olinadi. O‘lchash mashinaning o‘z koordinatalarida bajariladi.
- **Logo va ikonkalar:** favicon (SVG va ICO), iPhone ikonkasi, Android/PWA uchun ikonkalar va web manifest.
- **Yangi hujjatlar:** ASSET_LICENSES.md, ASSET_INVENTORY.md, THIRD_PARTY_NOTICES.md, KNOWN_LIMITATIONS.md.

# 0.10 — G‘uzor hududlari va joylar
- **Tasdiqlangan joylar:** Musofir ota jome masjidi va ziyoratgohi (Amir Temur MFY, Chinobod ko‘chasi 4), Mirijanda ota maqbarasi (Mardtepa).
- **Xotira maydoni:** stilizatsiya qilingan motamsaro ona va mangu olov; joylashuvi o‘ylab topilgan.
- **Yangi hududlar:**
  - zamonaviy turar-joy majmuasi (2 kvartal);
  - villalar (2 kvartal);
  - qurilish maydoni.
- **Takrorlanishni kamaytirish:**
  - mahalla yo‘llari eski asfaltda, sanoat zonasi yo‘llari beton plitada;
  - panel uylar, zamonaviy uylar va hovli uylarida rang variantlari;
  - mahalla devorlarida 4 xil rang.
- **Xaritada:** joylar va hudud yozuvlari.
- **Yangi hujjatlar:** LANDMARK_DISTRICT_INVENTORY.md, VEHICLE_INVENTORY.md, WORLD_ASSET_INVENTORY.md.


# 0.11 — uzluksiz G‘uzor dunyosi (kvadrat to‘r olib tashlandi)
- **Yangi dunyo modeli** (`src/game/world/guzor/network.ts`):
  - asosiy yo‘llar, daryo va joylar foydalanuvchi suratlaridan olingan;
  - mahalla ichidagi ko‘chalar har bir hudud yo‘nalishiga moslab generatsiya qilinadi;
  - yo‘llar kesishgan joylarda haqiqiy tarmoq hosil bo‘ladi.
- **Relyef:** adirlar, daryo o‘zani, rangli dalalar.
- **Bo‘laklab yuklash:** uchastkalar 160 m bo‘laklarda faqat atrofga yuklanadi va uzoqlashganda o‘chiriladi.
- **To‘qnashuv:** burilgan binolar uchun aylantirilgan to‘qnashuv qutilari; to‘qnashuvni olib tashlash imkoniyati.
- **Transport:** yo‘l tarmog‘i bo‘ylab harakat, svetoforlar, aylanma chorraha; politsiya va piyodalar ham tarmoqda.
- **Xarita va minixarita:** shu yo‘llar, daryo, uchastkalar va joylardan chiziladi.
- **Yangi joylar:** hokimiyat, stadion, to‘yxona, mehmonxona, ferma va maktablar.


# 0.12
- **Ko‘kalam:** binolar orasidagi bo‘sh yerlarga hududiga qarab bog‘, buta, maysa; yer rangi bo‘laklarga bo‘lindi.
- **Chorrahalar:** qoplama yo‘l rangiga moslandi.
- **Tezlik:** yer va daraxtlar faqat kerak bo‘lganda quriladi; menyu 20,4 s → 15,2 s (dasturiy GPU).
- **OpenStreetMap importeri:** `node scripts/import-osm.mjs map.osm`.
- **Hujjat:** TEST_REPORT.md.


# 0.13
- **Mahalla ko‘chalari:** har mahallaga o‘z yo‘nalishi, egri ko‘chalar, berk ko‘chalar.
- **3D modellar paneli:** Mulk muharriri va Dunyo muharriri (ishlab chiquvchi rejimi, siljitish, aylantirish, masshtab, yashirish, GLB bilan almashtirish, saqlash, orqaga qaytarish).
- **Yangi hujjatlar:** OSM_DATA_SOURCES, LANDMARK_VERIFICATION, WORLD_EDITOR_GUIDE, REMAINING_LIMITATIONS.


# 0.14
- **Dunyo muharriri:** daraxt, chiroq, skameyka va qutilarni tahrirlash; hudud va tur filtrlari; guruhlash; Undo/Redo. Bino ko‘chirilganda yer balandligi va collision yangilanadi.
- **Ko‘cha jihozlari:** piyodalar yo‘laklarida skameyka va chiqindi qutilari.
- **Ishga tushish:** GLB kutubxonasi fonda yuklanadi; katalog so‘roviga vaqt chegarasi qo‘yildi.
