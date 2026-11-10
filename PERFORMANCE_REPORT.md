# PERFORMANCE_REPORT — 0.15

Barcha o‘lchovlar shu ish muhitida, **dasturiy GPU (SwiftShader, headless Chromium)** bilan qilingan. Sizning noutbukingizda (i7-1165G7, 8 GB RAM, MX350 2 GB / Iris Xe) **o‘lchanmagan**.

| Ko‘rsatkich | Natija (dasturiy GPU) |
|---|---|
| Menyu paydo bo‘lishi | 18,9 s (bitta HTML fayl, 8,9 MB) |
| Init bosqichlari | shahar ≈ 3,5 s · osmon ≈ 0,3 s · personaj ≈ 0,26 s · GLB kutubxonasi fonda |
| Qo‘shimcha HDRI va bulutlar | menyudan keyin fonda yuklanadi (jami ≈ 520 KB) |
| JS xotirasi | ≈ 95–115 MB |
| FPS | dasturiy GPU’da 3–5; haqiqiy GPU uchun ma’lumot emas |

## Noutbukingiz uchun sozlamalar (0.15)
- **GPU aniqlash.** MX-seriya (MX250/MX350/MX450) va Iris Xe endi «O‘rta» darajaga tushadi. Avval MX350 «Yuqori» deb aniqlanardi.
- **O‘rta preset:**
  - 512 px teksturalar;
  - soyalar 2-daraja;
  - GTAO (ambient occlusion) o‘chiq;
  - SMAA yoqilgan;
  - bloom yoqilgan.
- **Yuqori va Ultra:** teksturalar 1024 px (avval 512 px).
- **Muhim: Chrome’ni NVIDIA kartasida ishga tushiring.** Optimus noutbuklarda brauzer ko‘pincha Iris Xe’da ishlaydi. Yo‘li: Windows → Sozlamalar → Tizim → Displey → Grafika → Chrome → «Yuqori unumdorlik».
