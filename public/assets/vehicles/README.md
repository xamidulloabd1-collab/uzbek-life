# Mashina modellari kolleksiyasi

Har bir mashina o‘z papkasida turadi:

```
public/assets/vehicles/<kategoriya>/<id>/model.glb
public/assets/vehicles/<kategoriya>/<id>/vehicle.json
```

**Kategoriyalar:** sedan, hatchback, suv, pickup, van, truck, bus, service, emergency, sports, classic.

`vehicle.json` namunasi (`license` bo‘limi majburiy):

```json
{
  "name": "Damas (CC BY, muallif …)",
  "price": 90000000,
  "weight": 2,
  "rotateY": 0,
  "dims": { "length": 3.5, "width": 1.4, "height": 1.9, "wheelbase": 1.85, "wheelRadius": 0.26 },
  "perf": { "maxSpeedKmh": 120 },
  "license": {
    "title": "Model nomi Sketchfab’dagidek",
    "author": "muallif username",
    "license": "CC BY 4.0",
    "source": "https://sketchfab.com/3d-models/…",
    "downloaded": "2026-11-08",
    "modifications": "o‘lcham va yo‘nalish moslandi"
  }
}
```

`npm run dev` yoki `npm run build` ishga tushganda `scripts/scan-vehicles.mjs` papkalarni avtomatik tekshiradi:
- `catalog.json` va `CREDITS.generated.md` fayllarini yozadi;
- litsenziyasi yo‘q yoki NC / ND / editorial litsenziyali modellarni rad etadi va sababini ko‘rsatadi.

O‘yinda mashinalar faqat kerak bo‘lganda yuklanadi:
- ko‘chada paydo bo‘lganda;
- yaqinda to‘xtab turganda;
- avtosalonda tanlanganda;
- o‘yinchi unga o‘tirganda.

Bu yerdagi modellar faqat oddiy buildda (`dist/`) ishlaydi, bitta HTML faylli versiyaga kirmaydi.
