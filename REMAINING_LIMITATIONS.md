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
