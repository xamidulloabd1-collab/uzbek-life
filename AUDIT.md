# Audit (versiya 0.2)

## 1. Arxitektura
- **Render.** Three.js r170, `WebGLRenderer` (WebGL 2). O‘yin dvigateli React’dan tashqarida ishlaydi (`Game.ts`).
  React faqat interfeysni chizadi, HUD holati sekundiga 10 marta yangilanadi.
- **Nima uchun WebGPU emas.** Osmon shaderi va post-processing zanjiri WebGL’ga bog‘liq. WebGPU uchun ular TSL (node materials) asosida qayta yozilishi kerak.
  WebGL 2 iOS Safari’da ham barqaror ishlaydi. WebGPU yo‘li keyingi bosqichga qoldirildi.
- **Fizika.** O‘zimizning yengil moduli. Rapier ishlatilmadi, chunki WASM ayrim hostlar va mobil brauzerlarda ishlamay qolishi mumkin.
  Shahar statik va to‘r ko‘rinishida, shuning uchun 2.5D to‘qnashuv (spatial hash) bilan haydash modeli (bicycle model) yetarli.
- **Tizimlar.** Iqtisod, ishlar, mulk, mashinalar va saqlash `src/systems` ichida, UI komponentlaridan alohida.

## 2. Grafika tahlili — vaqtinchalik (placeholder) assetlar
| Asset | Holati | Izoh |
|---|---|---|
| Binolar | **Protsedural, yakuniy emas** | Kodda yasalgan bloklar. Teksturalar va normal map’lar bor, lekin GLB modellar yo‘q |
| Mashinalar (8 ta) | **Protsedural, yakuniy emas** | Kuzov profilidan yasalgan. Avtosalonda «yakuniy emas» deb belgilangan |
| Personaj | Litsenziyali, **vaqtinchalik** | Mixamo «Vanguard» (harbiy kiyimda). Original o‘zbek personaji bilan almashtiriladi |
| Daraxtlar | Protsedural, yaxshilangan | Barg kartochkalari va shoxli tanalar. Daraxt GLB modellari keyinroq |
| Yo‘l va yo‘laklar | Protsedural | Normal map bor. Yo‘l chetidagi jihozlar hali kam |
| Yorug‘lik (IBL) | **Yakuniy** | Poly Haven HDRI (CC0) |
| Osmon, bulut, yomg‘ir | Protsedural | Hajmli bulutlar yo‘q |

## 3. Assetlarni almashtirish rejasi
1. Mashinalar: litsenziyali GLB (Meshopt va KTX2 bilan siqilgan) → `VEHICLE_MODELS`. Tafsilot `ASSETS.md` da.
2. Personaj: Blender’da yasalgan original model, Mixamo skeleti bilan mos (mavjud animatsiyalar ishlayveradi).
3. Binolar: modulli GLB kit (devor, deraza, eshik, tom bo‘laklari) → instancing. Birinchi navbatda mahalla hovlisi va panel uy.
4. Daraxtlar: chinor, terak, o‘rik GLB modellari, LOD bilan.
5. Ko‘cha jihozlari: chiroq, svetofor, skameyka, ariq bo‘laklari.

## 4. Tezlik
O‘lchov dasturiy GPU (SwiftShader) bilan qilindi, haqiqiy qurilmani ko‘rsatmaydi:
eng past darajada 640×360 ekranda ≈21 FPS, 264–276 draw call, ≈300 ming uchburchak.

Asosiy og‘ir joylar:
- barg kartochkalarining ustma-ust chizilishi (alpha test overdraw);
- har bir kvartal uchun alohida materiallar (draw call soni);
- Ultra’da GTAO (sahna ikki marta chiziladi).

Kamaytirish yo‘llari:
- grafika darajalari;
- ko‘rish masofasi va kvartal bo‘yicha chunk’lar;
- uzoq detallarni o‘chiradigan LOD;
- instancing;
- moslashuvchan aniqlik.

Real qurilmada o‘lchash hali qilinmagan: FPS sozlamalar panelida ko‘rinadi.

## 5. Yo‘l xaritasi
- **1-bosqich.** Bitta tuman (Mahalla): GLB uylar, yangi personaj, litsenziyali bitta mashina, salon kamerasi.
- **2-bosqich.** Mashinalar, garaj ichki ko‘rinishlari, transport oqimini yaxshilash.
- **3-bosqich.** NPC xulq-atvori, ishlar, iqtisodni kengaytirish.
- **4-bosqich.** Qolgan tumanlar, ko‘priklar, chunk streaming.
- **5-bosqich.** Haqiqiy telefonlarda sinov va optimallash.
