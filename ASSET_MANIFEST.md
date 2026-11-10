# ASSET_MANIFEST — kerakli aktivlar va integratsiya holati (0.17)

| # | Aktiv | Format | Papka | Poligon chegarasi | Teksturalar | Litsenziya talabi | Holat |
|---|---|---|---|---|---|---|---|
| 1 | PBR materiallar: asfalt, beton, plitka, suvoq, tuproq, maysa, tom, g‘isht, parket, kafel | JPG (Color, NormalGL, Roughness) 1K | `public/assets/materials/<nom>/` + `materials.json` | — | 1K (2K: `--2k`) | CC0 (ambientCG) | **Integratsiya tayyor va sinalgan** (sinov teksturalari bilan). Bu muhitda yuklash hosti yopiq; `npm run assets:fetch` sizning kompyuteringizda yuklaydi |
| 2 | Sedan / hetchbek / krossover / furgon / avtobus / yuk mashinasi | GLB (Draco yoki Meshopt) | `public/assets/vehicles/<kategoriya>/<id>/model.glb` + `vehicle.json` | 30–80 ming uchburchak (+ 5–10 ming LOD) | ≤ 2K PBR, alohida g‘ildirak tugunlari (`wheel_fl` va h.k.) | CC0 / CC BY (tijorat + o‘zgartirish ruxsati) | **Pipeline tayyor** (katalog, lazy loading, g‘ildirak, avtosalon, transport). Model yo‘q — manbalar yopiq |
| 3 | Modulli personaj (erkak/ayol) + kiyimlar | GLB, umumiy Mixamo-mos skelet; tana, ko‘ylak, shim, poyabzal, soch — alohida skinned mesh | `src/assets/characters/` | Tana 20–30 ming, har kiyim 2–8 ming | 1–2K | CC0 / CC BY | **Yo‘q**. Kiyim tizimi faqat bosh kiyimi va ko‘zoynak uchun ishlaydi |
| 4 | Binolar: hovli uy, ko‘p qavatli uy, do‘kon, bank, maktab | GLB, oyoq izi ≤ uchastka o‘lchami | Dunyo muharriri slotlari (`building:world_a…d`) | 5–40 ming | 1–2K | CC0 / CC BY | **Pipeline tayyor** (Dunyo muharriri → «Model»). Model yo‘q |
| 5 | Mebel va interyer buyumlari | GLB | `src/assets/props/` (rejalashtirilgan) | 1–10 ming | 1K | CC0 (Poly Haven) | **Yo‘q**. Interyerlar protsedural mebel bilan ishlaydi |
| 6 | Daraxtlar (chinor, terak, mevali) | GLB + LOD | Mulk muharriri `tree:*` slotlari | 5–20 ming + billbord | 1K atlas | CC0 / CC BY | **Pipeline tayyor** (uy atrofi). Model yo‘q |
| 7 | Ko‘cha jihozlari: chiroq, skameyka, quti | GLB | `lamp:*`, `bench:*` slotlari | 0,5–3 ming | 512–1K | CC0 | **Pipeline tayyor**. Model yo‘q |
| 8 | Real tovushlar: dvigatel, shahar, yomg‘ir | OGG / MP3 | `src/assets/audio/` | — | — | CC0 / CC BY | **Yo‘q**. Sintez qilingan tovushlar ishlatiladi |
