# Keyingi sessiya uchun xulosa (0.24 dan keyin)

## Bajarilgan
- **Joshqin** — Rocketbox (MIT), 25 klip. Mashinaga o‘tirish va tushish, eshik animatsiyasi, rul o‘rindig‘ida ko‘rinadi.
- **Taksi yo‘lovchilari** — 7 ta NPC modeli: kutish, qo‘l silkitish, o‘tirish, tushish.
- **Hovli uylar** — darvoza, kalitka, shiypon, parkovka, bog‘, ayvon. Uyingizda mashina hovlida turadi. Darvoza oldi bo‘sh.
- **Balans** — 1 mlrd so‘m.

## Hali qilinmagan (haqiqiy ro‘yxat)
1. **Ko‘chadagi piyodalar** hali eski tizimda (`Pedestrians.ts`). Kun tartibi (uy → ish → do‘kon → uy) va yaqin masofada Rocketbox modellar keyingi qadam.
2. **Mashinalar** hali protsedural «Sarbon Motors».
   - Chevrolet (Cobalt, Gentra, Nexia 3, Spark, Damas) uchun litsenziyali model bu muhitda topilmadi va qidiruv tugallanmadi.
   - Sketchfab API token talab qiladi.
3. **Missiyalar:** kuryer, mexanik, do‘kon va biznes missiyalari yangilanmadi.
4. **Kiyim tanlash:** faqat bosh kiyimi va ko‘zoynak. Butun kiyimni almashtirish uchun boshqa Rocketbox modellarini ishlatish mumkin.
5. **Optimizatsiya:** LOD, NPC simulyatsiya masofasi, uchburchaklar soni (≈1,1 mln) qilinmadi.
6. **Hovli darvozalari:** statik, ya’ni E bilan ochilmaydi va yopilmaydi. Ochiq va yopiq darvozalar oldindan belgilangan.
7. **Avvalgi uy interyeri** kamerasi g‘alati burchakdan ko‘rsatadi (o‘zgartirilmagan).

## Asboblar
- `tools/blender/rocketbox_to_glb.py` — Blender 5.0 (pip `bpy`, Python 3.11).
- `tools/gltf/optimize-avatar.mjs` — `@gltf-transform`, `meshoptimizer`.
- `tools/avatar-test/` — `npm run dev` → `/tools/avatar-test/?npc=female_adult_05`.
