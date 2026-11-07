# Yetishmayotgan tashqi assetlar

Quyidagi fayllar loyihada **yo‘q**. Kod ularni ulashga tayyor, lekin hozircha protsedural o‘rinbosarlar ishlatiladi.
Barcha fayllar uchun umumiy talablar:
- format: GLB, glTF 2.0, metr birligida, Y yuqoriga, oldi +Z tomonga;
- PBR teksturalar (baseColor, normal, ORM): KTX2 yoki 2K gacha WebP/JPG;
- litsenziya web-o‘yinda tijorat maqsadida ishlatishga ruxsat berishi kerak;
- manba va litsenziya `src/assets/manifest.ts` fayliga yoziladi.

## 1. Mashinalar → `src/assets/vehicles/`
| Fayl | Model | Poligon (LOD0 / LOD1 / LOD2) |
|---|---|---|
| cobalt.glb | sedan (Cobalt) | ≤ 120k / 40k / 10k |
| gentra.glb | sedan (Gentra) | shu |
| nexia3.glb | sedan (Nexia 3) | shu |
| malibu2.glb | biznes sedan (Malibu 2) | shu |
| damas.glb | mikroavtobus (Damas) | shu |
| spark.glb | hetchbek (Spark) | shu |
| tracker.glb | krossover (Tracker) | shu |

Tugunlar:
- `body` — bo‘yoq materiali, garajdagi rangni oladi;
- `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr` — markazi g‘ildirak o‘qida, aylanish X o‘qi atrofida;
- `steering_wheel`, `glass`, `headlight_L/R`, `taillight_L/R` (emissive), `interior`.

Kerakli ruxsatlar: 3D model litsenziyasi **va** GM / UzAuto Motors brend nomi va dizayni uchun ruxsat.
Ulash: manifestdagi `VEHICLE_MODELS` ga yoziladi (masalan, `zarafshon: { url, license }`). Yo‘riqnoma `ASSETS.md` da.

## 2. Binolar uchun modul kit → `src/assets/buildings/`
`mahalla_house_1floor_A/B/C.glb`, `mahalla_house_2floor_A/B.glb`, `darvoza_gate_A/B.glb`, `ayvon_veranda.glb`,
`panel_5floor_section.glb`, `panel_9floor_section.glb`, `podezd_entrance.glb`, `balcony_glazed.glb`,
`shop_ground_floor_A/B.glb`, `choyxona.glb`, `fuel_station.glb`, `workshop_bay.glb`, `garage_box.glb`.

Talablar:
- har biri ≤ 15k uchburchak, LOD1 50%;
- umumiy trim-sheet teksturalari (atlas), shunda instancing va kam draw call bilan chiziladi.

## 3. Personaj → `src/assets/characters/`
`player_male_uz.glb` — original zamonaviy kiyimdagi o‘zbek personaji.
- Talablar: Mixamo-mos skelet (`mixamorig:*`), ≤ 40k uchburchak, 2K teksturalar.
- Kerakli kliplar: Idle, Walk, Run, Sprint, Jump_Start/Loop/Land, Car_Enter_L, Car_Exit_L, Sit_Drive.

## 4. O‘simliklar → `src/assets/vegetation/`
`chinor_lod0-2.glb`, `terak_lod0-2.glb`, `orik_apricot_lod0-2.glb`, `bush_A/B.glb`, `grass_clumps.glb`, `rose_bed.glb`.
LOD0 ≤ 8k uchburchak.

## 5. Yo‘l va jihozlar → `src/assets/roads/`, `src/assets/props/`
Yo‘l uchun: `curb_segment.glb`, `aryk_channel_segment.glb`, `manhole.glb`.
Jihozlar uchun: `street_lamp_uz.glb`, `traffic_light.glb`, `bench.glb`, `bus_stop.glb`, `trash_bin.glb`, `road_sign_set.glb`.

## 6. Teksturalar → `src/assets/textures/`
CC0 PBR to‘plamlari (ambientCG yoki Poly Haven), har biri baseColor, normal va ORM bilan, 2K:
asfalt, ho‘l asfalt, trotuar plitkasi, g‘isht, suvoq, beton, bordyur, oddiy tunuka tom.
Bu muhitdan ushbu saytlarga kirish imkoni yo‘q.
