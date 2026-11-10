# NAVIGATION_AND_ROADS — 0.18

## GPS navigatsiyasi (`src/game/nav/Navigator.ts`)
- **Bitta umumiy servis** barcha ishlar (taksi, yetkazish, kuryer, yuk, mexanik, ferma) va o‘yinchi o‘zi qo‘ygan GPS nuqtasi uchun.
- **Yo‘l topish:** yo‘l tarmog‘i bo‘yicha A* algoritmi. Boshlanishi va oxiri eng yaqin yo‘l nuqtasiga ulanadi. Tor berk ko‘chalar uch barobar «qimmatroq» hisoblanadi, shuning uchun marshrut ularni iloji boricha chetlab o‘tadi.
- **Ko‘rinishi:** yo‘l ustida firuza chiziq, minixarita va katta xaritada ham marshrut chizig‘i.
- **HUD:** qolgan masofa (marshrut bo‘yicha), taxminiy yetib borish vaqti va keyingi burilish («O‘ngga buriling · 120 m»).
- **Qayta hisoblash:** marshrutdan 24 m chetga chiqilsa darhol, aks holda har 4 soniyada.

## Yo‘llar
- **Takroriy ko‘chalar olib tashlandi:** asosiy yo‘l bilan yonma-yon parallel ketgan 107 ta generatsiya qilingan ko‘cha.
- **Svetoforlar:** faqat ikkita asosiy yo‘l kesishgan chorrahalarda (129 ta).
  - Ustun chorraha chegarasidan tashqarida, yaqinlashayotgan polosaning o‘ng tomonida, mashinalarga qarab turadi.
  - Har bir chorrahada ikki faza: bir yo‘nalish yashil bo‘lsa, ikkinchisi qizil, keyin sariq; to‘qnashadigan harakatlar bir vaqtda yonmaydi.
- **Yo‘l chiziqlari:** svetoforli har bir yo‘nalishda «zebra» piyodalar o‘tish joyi va to‘xtash chizig‘i.
- **Transport:** svetofor qizil bo‘lsa, mashinalar to‘xtash chizig‘i orqasida to‘xtaydi.
- **Hali yo‘q:**
  - piyodalar svetofori;
  - yo‘l belgilari;
  - parkovka chiziqlari;
  - mahalla ko‘chalarining haqiqiy (OSM) geometriyasi.
