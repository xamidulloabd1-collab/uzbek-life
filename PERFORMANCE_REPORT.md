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


## 0.22 — unumdorlik o‘tkazmasi (bir xil kamera pozitsiyasi: uy oldidagi ko‘cha, O‘rta preset)

| O‘lchov | Oldin | Keyin | O‘zgarish |
|---|---|---|---|
| Bir kadrdagi uchburchaklar | 4 498 931 | **1 245 773** | **−72 %** |
| Draw call’lar | 759 | 799 | +5 % (mintaqa guruhlari sababli) |
| Kadr vaqti (dasturiy GPU) | 2 812 ms | 1 467 ms | −48 % |

**Asosiy sabab topildi.** Butun shahar bo‘ylab to‘xtab turgan mashinalar har kadrda chizilardi va soya o‘tkazmasida ham ikki marta chizilardi. Endi ular daraxt va chiroqlar kabi 240 m mintaqalar bo‘yicha yashiriladi.

**Boshqa o‘zgarishlar:**
- bog‘lardagi daraxtlar taxminan ikki barobar kam;
- bo‘sh joylardagi o‘t to‘plamlari olib tashlandi (yashil rangni yer qoplamasi beradi);
- O‘rta preset: ko‘rinish masofasi 450 → 360 m, daraxt bargi zichligi 0,8 → 0,6;
- Past preset ham yengillashtirildi;
- daraxtlar 300 m dan keyin ko‘rinmaydi.

**Sizning kompyuteringizdagi o‘lchov:** o‘zgarishlardan oldin skrinshotingizda 20 FPS edi. Yangi versiyada FPS’ni o‘lchab ko‘ring — taxmin qilib yozmayman.
