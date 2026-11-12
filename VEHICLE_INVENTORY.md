# Mashinalar ro‘yxati

| ID | Nomi | Kategoriya | Model | Litsenziya | Holati |
|---|---|---|---|---|---|
| lola, chumchuq, zarafshon, bahor, amir, karvon, qoya, burgut | o‘yin nomlari | sedan, hetchbek, van, krossover, SUV | kodda yaratilgan original model | loyiha muallifiniki | ishlaydi; **vaqtinchalik, real mashina emas** |

**Real mashinalar (Chevrolet, Toyota, Kia, Hyundai, Mercedes-Benz, BMW, BYD, VW): 0 ta qo‘shilgan.**
- Sketchfab, Poly Haven, Kenney, CGTrader va ishlab chiqaruvchilar saytlariga bu muhitdan ulanish yo‘q.
- GitHub qidiruvida mos litsenziyali model topilmadi.

Litsenziyali GLB fayllar `public/assets/vehicles/<kategoriya>/<id>/` papkasiga qo‘yilsa, katalog ularni avtomatik ulaydi: avtosalon, transport oqimi, to‘xtab turgan mashinalar, garaj va haydash. Bu tizim test modellari bilan sinalgan.


## 0.13 holati
- Model saytlariga (Sketchfab, BlenderKit, CGTrader, Kenney, Poly Haven) ish muhitidan DNS orqali ulanib bo‘lmaydi.
- GitHub’da «chevrolet cobalt 3d», «daewoo matiz glb», «car models glb cc0», «lada gltf» so‘rovlari bo‘yicha 0 natija.
- Brend mashinalar dizaynini nusxalab modellashtirish qilinmadi. O‘yindagi mashinalar original va shunday belgilangan.
- Litsenziyali GLB ulanganda katalog va «Mashina modellari» bo‘limi ishlaydi. Bu test modellar bilan sinalgan.


## 0.14
- Model saytlari qayta tekshirildi: tarmoq ruxsati yo‘q (HTTP 000).
- GitHub’da «chevrolet gltf» bo‘yicha 0 natija.
- Real model qo‘shilmadi. Original mashinalar vaqtinchalik model sifatida qoldi.


## 0.18 — o‘yindagi nomlar

O‘yin uchun o‘ylab topilgan brend: **Sarbon Motors** (2025).

| ID | Nomi |
|---|---|
| lola | Sarbon S3 |
| chumchuq | Sarbon City |
| zarafshon | Sarbon S5 |
| bahor | Sarbon S4 Classic |
| amir | Sarbon S7 |
| karvon | Sarbon Van |
| qoya | Sarbon X3 |
| burgut | Sarbon X5 |

Rasmiy litsenziyali modellar bo‘lmagani uchun Chevrolet va boshqa real brend nomlari ishlatilmagan. ID’lar o‘zgarmagan, shuning uchun eski saqlangan o‘yinlar ishlaydi.


## 0.19 — Sketchfab nomzodlari (API orqali tekshirildi, 2026-11-12)

Sketchfab API qidiruvi va model ma’lumotlari ochiq, lekin **yuklab olish uchun sizning API tokeningiz kerak** (`/download` tokensiz HTTP 401 qaytaradi).

| Mashina | Sketchfab modeli (UID) | Muallif | Litsenziya | Uchburchaklar | Izoh | Yuklangan | O‘yinga qo‘shilgan | Haydab sinalgan |
|---|---|---|---|---|---|---|---|---|
| Chevrolet Cobalt | chevrolet Cobalt ltz (6bbacfcb…) | uzbek_supra | CC BY 4.0 | 1,05 mln | og‘ir — soddalashtirish kerak | yo‘q (token) | yo‘q | yo‘q |
| Chevrolet Gentra | Gentra (99f15833…) | uzbek_supra | CC BY 4.0 | 367 ming | | yo‘q (token) | yo‘q | yo‘q |
| Chevrolet Lacetti | Chevrolet Lacetti (a40da89d…) | zapkolenko07 | CC BY 4.0 | 63 ming | o‘yin uchun yengil | yo‘q (token) | yo‘q | yo‘q |
| Daewoo/Chevrolet Nexia | 2012 Daewoo Nexia (1383812b…) | niev | CC BY 4.0 | 912 ming | xuddi shu model boshqa foydalanuvchida ham bor — asl muallifligi aniq emas | yo‘q | yo‘q | yo‘q |
| Chevrolet Damas | Chevrolet Damas (70f8556e…) | own.guest | CC BY 4.0 | 135 ming | «First model in Blender» — muallifning o‘z ishi | yo‘q (token) | yo‘q | yo‘q |
| Chevrolet Spark | Chevrolet Spark (0fcbd3af…) | niev | CC BY 4.0 | 858 ming | asl muallifligi aniq emas | yo‘q | yo‘q | yo‘q |
| Daewoo Matiz | Matiz M100/M150 (7913b880…) | szymonpasterczyk | CC BY 4.0 | 849 ming | | yo‘q (token) | yo‘q | yo‘q |
| Chevrolet Tracker | TRACKER 2 PREMIER (4e2799e1…) | Uzbek3D | CC BY 4.0 | 563 ming | | yo‘q (token) | yo‘q | yo‘q |
| Chevrolet Onix | Onix sedan 2012 (1a535cb0…) | teenlin3 | CC BY 4.0 | 500 ming | | yo‘q (token) | yo‘q | yo‘q |
| Chevrolet Captiva | 3 xil yuklovchida bir xil model (1 317 226 uchburchak) | — | CC BY 4.0 | 1,3 mln | **qayta yuklangan — ishlatilmaydi** | yo‘q | yo‘q | yo‘q |
| Chevrolet Malibu | 2013 Chevrolet Malibu (d9be46c4…) | roverterex | CC BY 4.0 | 1,85 mln | **tavsifda «Credits to Hum3D» — tijoriy model qayta yuklangan, rad etildi** | yo‘q | yo‘q | yo‘q |
| Hyundai Elantra | 2005 Hyundai Elantra (668cc735…) | 5spokehubcap | CC BY 4.0 | 839 ming | **«from beam» — BeamNG’dan olingan, rad etildi** | yo‘q | yo‘q | yo‘q |

**Brend haqida.** CC BY faqat model muallifining huquqini qamraydi. Chevrolet, Toyota va boshqa nom hamda dizaynlar ishlab chiqaruvchilarga tegishli. Tijorat relizidan oldin buni hisobga oling.

**Sizning kompyuteringizda yuklab olish:**
```
npm run vehicles:fetch -- <UID> --token <TOKEN> --category sedan --id cobalt --name "Chevrolet Cobalt" --length 4.48
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b -P tools/blender/prepare_vehicle.py -- public/assets/vehicles/sedan/cobalt/model.glb public/assets/vehicles/sedan/cobalt/model.glb 4.48 150000
npm run dev
```
