# REMAINING_LIMITATIONS — 0.17

**0.17 holati:**
- Asset saytlari ochiladi, lekin yuklash va API hostlari yopiq (NETWORK_ACCESS.md).
- Foto materiallar `npm run assets:fetch` bilan sizning kompyuteringizda yuklanadi.
- Interyerlar 7 ta: uy, bozor do‘koni, bank, osh markazi, idora, avtoservis, avtosalon.
- NPC shaxsiy kun tartibi va modulli personaj hali yo‘q.

## 0.15 dagi ro‘yxat

1. **Fotorealizm yo‘q.**
   - Mashinalar, binolar, daraxtlar va personaj protsedural yoki vaqtinchalik.
   - GTA V darajasidagi ko‘rinish litsenziyali fotogrammetriya teksturalari va professional modellarsiz bo‘lmaydi.
   - TurboSquid va boshqa model saytlari bu ish muhitida ochilmaydi.
2. **Real mashina modellari yo‘q.** Litsenziyali GLB ulansa, katalog ularni qabul qilishga tayyor.
3. **Haqiqiy G‘uzor mahalla ko‘chalari yo‘q.** OSM ma’lumoti olinmadi.
4. **Yo‘q funksiyalar:**
   - bino interyerlari;
   - kiyim tanlash;
   - NPC kun tartibi;
   - svetofor va belgilarni muharrirda tahrirlash.
5. **Arxitektura o‘zgarmadi.** React Three Fiber va Rapier’ga ko‘chirilmadi: mavjud Three.js tizimi ishlayapti.
6. **Haqiqiy qurilmada FPS o‘lchanmagan** (i7-1165G7 + MX350).
7. **Motamsaro ona haykali va markaziy favvora** tasdiqlanmagan.

## Avvalgi versiyalar (0.14 dagi ro‘yxat)

# REMAINING_LIMITATIONS — 0.14

1. **Real mashina modellari yo‘q (Blocked).** Model saytlari bu muhitning tarmog‘ida ochilmaydi. O‘yindagi 8 ta mashina original va vaqtinchalik; Chevrolet deb ko‘rsatilmaydi. Litsenziyali GLB ulansa, katalog va «Mashina modellari» bo‘limi ishlaydi (test modeli bilan sinalgan).
2. **Mahalla ko‘chalari haqiqiy emas (Blocked).** OSM ma’lumoti olinmadi. Asosiy yo‘llar suratdan chizilgan, mahalla ko‘chalari generatsiya qilingan. Har bir yo‘lda manba belgisi bor (`osm=false`, `major`, `alley`).
3. **Motamsaro ona haykali va markaziy favvora** tasdiqlanmagan, qo‘yilmagan.
4. **Dunyo muharriri:**
   - svetofor va yo‘l belgilari tahrirlanmaydi;
   - landmarklar himoyalangan;
   - hovlilar ichidagi daraxtlar alohida tahrirlanmaydi;
   - bino masshtabi faqat GLB model bilan ishlaydi;
   - o‘zgarishlar dunyoning joriy versiyasiga bog‘langan.
5. **Ishga tushish.** Dasturiy GPU’da menyu ≈ 20 s. Asosiy qismlar:
   - 8 MB bitta HTML faylni o‘qish (≈ 6,6 s);
   - teksturalar yaratish (≈ 2,7 s);
   - birinchi kadrdagi shader kompilyatsiyasi (≈ 7 s).

   Haqiqiy GPU’da qancha bo‘lishi o‘lchanmagan. Ko‘p faylli build (Vercel/Netlify) bitta HTML’dan tezroq yuklanishi kutiladi, lekin bu ham o‘lchanmagan.
6. **Haqiqiy qurilmada test yo‘q:** i5-4590 + RX550 va telefon.
