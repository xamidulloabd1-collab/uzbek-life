# Test hisoboti (0.7)

Avtomatik test: Playwright + Chromium (SwiftShader dasturiy GPU), production single-file build.
Dasturiy GPU sekin bo‘lgani uchun simulyatsiya real vaqtdan sekinroq; FPS haqiqiy qurilma natijasi emas.

| # | Tekshiruv | Natija |
|---|---|---|
| 1 | startup+money | {"cash":950000,"bank":0,"cars":1,"parked":88,"locked":46} |
| 2 | walking | moved |
| 3 | owned car drive+controls | reached 12.0 km/h, braked <3 km/h, controls {"lights":"on","signal":"left"}, engine on after X: false, exited OK — topilgan xato tuzatilgandan keyin (o‘z mashinasiga o‘tirish yo‘qolgan edi) |
| 4 | parked NPC car | prompt='None', entered NPC car, taken=True |
| 5 | locked car mini-game | mini-game solved, entered locked car; wanted=1 |
| 6 | moving-traffic car + wanted + police | prompt='Zarafshon — haydovchini tushirish', wanted=3, police units=1 |
| 7 | busted (called directly) | wanted=0, police=0, cash 950000->455000 |
| 8 | dealership purchase | vehicles 1->2, bank=2872000000 |
| 9 | save/load | before vehicles=2 cash=455000; after vehicles=2 cash=455000 |
| 10 | day/night + fog | night=1.00, fog far=179m |
| 11 | console errors | [] |
| 12 | mobile | {"touch":true,"mobile":true,"buttons":2} |

Qo‘lda tekshirilmagan / cheklovlar:
- Politsiya ushlashi (7) funksiya to‘g‘ridan-to‘g‘ri chaqirilib sinaldi; quvish va ushlash vaziyati o‘zi yuzaga kelishi alohida kuzatilmadi.
- Haqiqiy telefon va haqiqiy GPU’da tezlik o‘lchanmagan.
- TypeScript tekshiruvi va `npm run build` xatosiz.

## 0.8 — mashinalar katalogi testi

Sinov loyihaga **qo‘shilmagan** uchta test GLB bilan o‘tkazildi: three.js Ferrari, Khronos ToyCar va CarConcept. Ular faqat sinov uchun ishlatildi va keyin o‘chirildi.

| # | Tekshiruv | Natija |
|---|---|---|
| 1 | Papka skaneri → catalog.json → o‘yinda ro‘yxatga olish | 3 ta mashina qo‘shildi; to‘xtab turgan 19 ta mashina katalogdan tanlandi |
| 2 | Transport, modellar faqat kerak bo‘lganda yuklanadi | Ko‘chada katalog mashinasi paydo bo‘ldi; faqat kerakli bitta model yuklandi |
| 3 | Avtosalondan sotib olish → GLB mashina → haydash | Sotib olindi, GLB qo‘llandi, 13,1 km/soat; g‘ildiraklar aylandi (7 ta tugun topildi — ba’zilari g‘ildirak bo‘lmasligi mumkin) |
| 4 | To‘xtab turgan mashinaning almashinuvi (LOD) | Yaqinlashganda 2 ta mashina haqiqiy modelga almashdi |
| 5 | Konsol xatolari | yo‘q |

Ko‘rib tasdiqlanmagan: avtosalondagi 3D ko‘rinish (GLB) skrinshotda hali yuklanmagan holatda chiqdi.

## 0.9 — audit va maqsadli tekshiruvlar

- **Audit:** 51 ta manba fayl, ~11 100 qator TypeScript; `tsc --noEmit` xatosiz; TODO/FIXME yo‘q; ikkala build xatosiz.
- **Asset manbalari:** Sketchfab, Poly Haven, Kenney, CGTrader va chevrolet.com bu muhitdan ochilmadi (HTTP 000). GitHub API’da ruxsat beruvchi litsenziyali real mashina glTF qidiruvi 0 natija berdi.
- **G‘ildiraklarni GLB modelga ulash (yangilangan algoritm):** vaqtinchalik test modelida (three.js Ferrari, buildga kiritilmagan) roppa-rosa 4 ta g‘ildirak topildi, 2 tasi oldingi. Avvalgi versiyada 7 ta tugun topilgan edi. Avtosalonda model tanlanganda 3D ko‘rinish chiqdi, konsolda xato bo‘lmadi.
- **Qayta ishga tushirilmagan:** to‘liq QA to‘plami (0.7 va 0.8 natijalari yuqorida). 0.9 dagi o‘zgarishlar faqat g‘ildirak ulash algoritmi, hujjatlar va logo.

## 0.10 — G‘uzor hududlari
- Tip tekshiruvi va ikkala build xatosiz.
- O‘yinda ko‘rib chiqildi (dasturiy GPU, skrinshot bilan):
  - Musofir ota masjidi (yozuvi va minorasi bilan);
  - qurilish maydoni (beton karkas);
  - Mirijanda ota maqbarasi;
  - Xotira maydoni.
- HUD hudud nomlarini to‘g‘ri ko‘rsatdi: «Yangi hayot» majmuasi, Amir Temur mahallasi, Yangi uylar dahasi, Mardtepa qishlog‘i.
- Konsolda xato yo‘q.
- Ko‘rib tasdiqlanmagan: zamonaviy majmua va villalar — kamera daraxt va devor ichida qolib ketdi; hududlar quriladi, lekin ko‘rinishi skrinshotda chiqmadi.


## 0.11 — uzluksiz G‘uzor dunyosi (Playwright, dasturiy GPU — SwiftShader)
| Tekshiruv | Natija |
|---|---|
| Tip tekshiruvi, ikkala build | xatosiz |
| Dunyo generatsiyasi (Node’da) | 0,7 s; 1 676 yo‘l bo‘lagi, 3 376 uchastka, 22 joy |
| O‘yinni ishga tushirish | ishladi; dasturiy GPU’da ≈ 20 s |
| Konsol xatolari | yo‘q (uch marta ishga tushirildi) |
| O‘yinchining uyi va mashinasi | mahalla ko‘chasida hovli oldida paydo bo‘ldi |
| Haydash | mahalla ko‘chasida 24 km/soatgacha; balandlik yo‘l bilan mos |
| Transport | 20 ta mashina; 5 soniyada 17 tasi harakatlandi |
| Bo‘laklab yuklash | 170 bo‘lak qurildi, 149 tasi uzoqlashganda o‘chirildi |
| Hudud nomlari | G‘uzor markazi, Gulshan mahallasi, Jarariq qishlog‘i, A380 yo‘li, Markaziy ko‘cha |
| Skrinshotlar | markaz tepadan: yo‘llar to‘rtburchak emas; mahalla ko‘chasi; daryo; qishloq fermasi; aylanma chorraha |
| Xarita oynasi | ochildi, xato yo‘q |

Sinalmagan:
- haqiqiy GPU’da tezlik;
- uzoq masofaga haydash (bir tumandan ikkinchisiga to‘liq);
- politsiya quvishi va missiyalar yangi xaritada to‘liq o‘ynab ko‘rilmadi.
