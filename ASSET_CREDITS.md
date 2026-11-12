# Asset credits

| Asset | Fayl | Muallif / manba | Litsenziya | Holati | O‘zgarishlar |
|---|---|---|---|---|---|
| HDRI yoritish | `src/assets/environment/pedestrian_overpass_1k.hdr` | Poly Haven, «Pedestrian Overpass» (three.js examples orqali) | CC0 1.0 | yakuniy | yo‘q |
| Fuqaro personaj | `src/assets/characters/civilian-michelle.glb` | Adobe Mixamo «Michelle» (three.js examples orqali) | Mixamo shartlari: loyihalarda bepul, alohida tarqatish mumkin emas | vaqtinchalik | yo‘q |
| Yurish kliplari | `src/assets/characters/mixamo-locomotion.glb` | Adobe Mixamo Idle / Walk / Run | Mixamo shartlari | vaqtinchalik | glTF-Transform bilan meshlar olib tashlangan; suyak nomi bo‘yicha retarget |
| Draco dekoder | `public/draco/*` | Google Draco (three.js orqali) | Apache-2.0 | yakuniy | yo‘q |

**Mashina modellari:** litsenziyali tashqi GLB modellar hali qo‘shilmagan. Barcha mashinalar kodda yasalgan original modellar (brend dizayni nusxa olinmagan).
Shahar, binolar, teksturalar va tovushlar ham kodda yaratilgan original assetlar.


## Xarita ma’lumotlari
- Joylar va asosiy yo‘llar: foydalanuvchi suratlari (Google Maps) faqat namuna sifatida ishlatilgan, hech qanday tasvir o‘yinga qo‘shilmagan.
- Musofir ota masjidi joylashuvi: © OpenStreetMap contributors (ODbL 1.0).


## 0.15 — vaqtga qarab yorug‘lik va bulutlar (CC0)
| Asset | Fayl | Manba | Litsenziya |
|---|---|---|---|
| «sunrise», «sunset», «night» HDRI (512 px, EXR DWAB) | src/assets/environment/{sunrise,sunset,night}.exr | npm `@pmndrs/assets` 1.7.0 (asli Poly Haven HDRI’lari) | CC0 1.0 |
| Bulut teksturasi | src/assets/environment/cloud.webp | npm `@pmndrs/assets` 1.7.0 | CC0 1.0 |


## 0.19 — ambientCG PBR materiallari (yuklangan va o‘yinga ulangan)
Litsenziya: CC0 1.0. Manba: https://ambientcg.com. Yuklangan sana: 2026-11-12. O‘zgartirish: 1024 px ga keltirildi, AO kartalari olib tashlandi.

| O‘yindagi material | ambientCG ID |
|---|---|
| asfalt | Asphalt031 |
| beton | Concrete034 |
| plitka | PavingStones138 |
| suvoq | Plaster001 |
| tuproq | Ground109 |
| maysa | Grass004 |
| tom | CorrugatedSteel005 |
| g‘isht | Bricks105 |
| parket | WoodFloor051 |
| kafel | Tiles139 |

Fayllar `public/assets/materials/` papkasida. Ular ko‘p faylli buildda ishlaydi (`npm run dev`, Netlify, Vercel).
