# Asset litsenziyalari

| Asset | Litsenziya | Tijorat maqsadida | O‘zgartirish | Muallifni ko‘rsatish | Holati |
|---|---|---|---|---|---|
| Poly Haven «Pedestrian Overpass» HDRI | CC0 1.0 | ruxsat | ruxsat | shart emas (ixtiyoriy) | yakuniy buildga kiritiladi |
| Mixamo «Michelle» personaj | Adobe Mixamo shartlari | o‘yin ichida ruxsat | ruxsat | shart emas | **vaqtinchalik**; fayl sifatida alohida tarqatish mumkin emas — original personaj bilan almashtirish rejalashtirilgan |
| Mixamo Idle / Walk / Run kliplari | Adobe Mixamo shartlari | o‘yin ichida ruxsat | ruxsat (meshlar olib tashlangan) | shart emas | **vaqtinchalik** |
| Kodda yaratilgan barcha modellar, teksturalar, tovushlar | loyiha muallifiga tegishli original ish | — | — | — | o‘yinda ishlatiladi; mashinalar **yakuniy emas** |

**Uchinchi tomon mashina modellari: yo‘q.** Hech bir mashina modeli yuklab olinmagan. Sabablari:
- Sketchfab, Poly Haven, Kenney, CGTrader va ishlab chiqaruvchi saytlariga bu muhitdan ulanib bo‘lmadi;
- GitHub’da ruxsat beruvchi litsenziyali real mashina glTF modeli topilmadi.

Litsenziyasi tasdiqlanmagan asset buildga kiritilmaydi. `scripts/scan-vehicles.mjs` litsenziya maydonlari bo‘lmagan modellarni va NC / ND / editorial litsenziyali modellarni avtomatik rad etadi.

**Brendlar haqida.** CC BY yoki Royalty-Free litsenziya faqat 3D modelning mualliflik huquqini qamraydi. Chevrolet, Toyota, BMW va boshqa brendlarning nomi, logotipi va dizayni ularning egalariga tegishli. Bunday modellarni rasmiy, ishlab chiqaruvchi litsenziyalagan asset sifatida ko‘rsatmang. Tijorat relizidan oldin yurist bilan maslahatlashing.

| OpenStreetMap ma’lumotlari (bitta joy koordinatasi; importer orqali kelajakdagi ko‘chalar) | ODbL 1.0 | ruxsat | ruxsat (umumiy ma’lumotlar bazasi share-alike) | «© OpenStreetMap contributors» shart | ishlatilmoqda / importer tayyor |
| @pmndrs/assets: sunrise/sunset/night HDRI, bulut teksturasi | CC0 1.0 | ruxsat | ruxsat | shart emas | ishlatilmoqda (0.15) |
| ambientCG: 10 ta PBR material (1K) | CC0 1.0 | ruxsat | ruxsat | shart emas | **ishlatilmoqda (ko‘p faylli build)** |

## Personajlar (0.24)
| Fayl | Manba | Litsenziya |
|---|---|---|
| `src/assets/characters/joshqin.glb` | Microsoft Rocketbox Avatar Library — `Male_Adult_10` + 25 animatsiya (`Assets/Animations`) | MIT, © 2020 Microsoft |
| `src/assets/characters/npc/*.glb` | Rocketbox `Male_Adult_02/07/14/20`, `Female_Adult_01/05/09` | MIT, © 2020 Microsoft |

Manba: https://github.com/microsoft/Microsoft-Rocketbox (LICENSE.md — MIT). Modellar Blender 5.0’da qayta ishlandi: teksturalar 1024/512 px, specular → roughness, animatsiyalar retarget va bake qilindi, meshopt bilan siqildi. Mixamo fayllari loyihadan olib tashlandi.
