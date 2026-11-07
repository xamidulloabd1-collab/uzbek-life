# Assetlar va litsenziyalar

| Fayl | Manba | Litsenziya | Holati |
|---|---|---|---|
| `src/assets/environment/pedestrian_overpass_1k.hdr` | Poly Haven (three.js misollari orqali) | CC0 1.0 | yakuniy |
| `src/assets/characters/civilian-michelle.glb` | Adobe Mixamo «Michelle» (three.js misollari orqali), o‘zgartirilmagan | Mixamo shartlari: loyihalarda bepul ishlatiladi, alohida fayl sifatida tarqatib bo‘lmaydi | vaqtinchalik |
| `src/assets/characters/mixamo-locomotion.glb` | Mixamo Idle / Walk / Run kliplari (faqat skelet, glTF-Transform bilan meshlari olib tashlangan) | Mixamo shartlari | vaqtinchalik |

Qolgan barcha teksturalar, binolar, mashinalar va tovushlar kod orqali yaratilgan original assetlar.

## Litsenziyali mashina modelini ulash
1. Litsenziyasi o‘yinda ishlatishga ruxsat beradigan GLB oling. Brend nomi, logotip va kuzov dizayni uchun ishlab chiqaruvchidan alohida ruxsat kerak bo‘lishi mumkin.
2. Faylni `src/assets/vehicles/` papkasiga qo‘ying. Iloji bo‘lsa siqing: `gltfpack -cc -tc`.
3. `src/assets/manifest.ts` fayliga yozing:
   ```ts
   import cobaltUrl from './vehicles/cobalt.glb?url';
   export const VEHICLE_MODELS = { zarafshon: { url: cobaltUrl, license: '…' } };
   ```
4. Tugun nomlari:
   - g‘ildiraklar `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr` bo‘lsa, aylanish va rul avtomatik ishlaydi;
   - nomida `body` yoki `paint` bo‘lgan material garajdagi rangni oladi.
   - Model o‘lchami avtomatik ravishda mashinaning haqiqiy uzunligiga moslanadi.

## KTX2 teksturalar
Basis transcoder fayllarini `public/basis/` papkasiga qo‘ying va `.env` ga `VITE_BASIS_PATH=/basis/` yozing.

## GLB qo‘shishning ikki yo‘li (0.4)

### A) O‘yin ichida: «3D modellar» (Asset Lab)
Pauza yoki telefon menyusida **3D modellar** bo‘limini oching.
1. Kerakli joyni (slot) tanlang: mashina, mahalla uyi, darvoza, daraxt, buta, chiroq yoki skameyka.
2. GLB faylni tanlang.
3. Muallif, litsenziya va manba havolasini kiriting — bular majburiy.
4. Kerak bo‘lsa, modelning old tomonini 0/90/180/270° ga burang.

Natija:
- Fayl brauzer xotirasida (IndexedDB) saqlanadi va darhol o‘yinga ulanadi.
- Mashinalar shahar bo‘ylab ishlatiladi. Kamida bitta mashina GLB modeli bo‘lsa, protsedural mashinalar ko‘chaga chiqmaydi.
- Uylar, darvozalar, daraxtlar, butalar va chiroqlar namunaviy mahallada (ijaradagi uyingiz joylashgan 1,1-kvartal) protsedural qismlarning o‘rnini egallaydi.

### B) Loyihaga doimiy qo‘shish (kod yozmasdan)
Faylni papkaga qo‘ying va yoniga `<nom>.license.json` yozing:
```
src/assets/vehicles/damas.glb          + damas.license.json   → Karvon
src/assets/vehicles/spark.glb          + spark.license.json   → Chumchuq
src/assets/buildings/house_a.glb …     (bir nechta variant aralashtiriladi)
src/assets/buildings/gate_a.glb
src/assets/props/lamp_a.glb, bench_a.glb
src/assets/vegetation/tree_a.glb, bush_a.glb
```
`license.json` namunasi:
```json
{ "author": "…", "license": "CC BY 4.0", "source": "https://…", "rotateY": 0 }
```
Mashina nomlari: `nexia3`, `spark`, `cobalt`, `gentra`, `malibu2`, `damas`, `tracker` yoki o‘yindagi nomlar (`lola`, `karvon`, …).

### Model talablari
- **G‘ildiraklar.** Nomida `wheel`, `tire`, `tyre` yoki `rim` bo‘lgan tugunlar topiladi. Old yoki orqa, chap yoki o‘ng ekani joylashuvidan aniqlanadi. Ular aylanadi, old g‘ildiraklar esa rul bilan buriladi.
- **Bo‘yoq.** Nomida `body` yoki `paint` bo‘lgan material garajdagi rangni oladi.
- **O‘lcham** avtomatik moslanadi: mashina haqiqiy uzunligiga, uy esa hovli o‘lchamiga. Santimetrda eksport qilingan fayllar ham ishlaydi.
- **Siqish:**
  - Meshopt va KHR_mesh_quantization qo‘llab-quvvatlanadi.
  - Draco faqat oddiy buildda (`npm run build`) ishlaydi: dekoder `public/draco/` papkasida turadi. Bitta HTML faylli buildda Draco fayllar aniq xato xabari bilan rad etiladi.
