# Test hisoboti (0.7)

Avtomatik test: Playwright + Chromium (SwiftShader dasturiy GPU), production single-file build.
Dasturiy GPU sekin bo‘lgani uchun simulyatsiya real vaqtdan sekinroq; FPS haqiqiy qurilma natijasi emas.

| # | Tekshiruv | Natija |
|---|---|---|
| 1 | startup+money | {"cash":500000000,"bank":0,"cars":1,"parked":88,"locked":46} |
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
