# WORLD_EDITOR_GUIDE — 3D modellar paneli

Pauza menyusi → **3D modellar**. Panelda uchta bo‘lim bor.

## 1. Mulk muharriri (Player Property Editor)
- Faqat sizning uyingiz va hovlingiz uchun: uy, darvoza, daraxt, buta, chiroq va skameyka GLB modellari.
- Shahar binolariga ta’sir qilmaydi.

## 2. Dunyo muharriri (World Environment Editor)
- **Himoya.** Ishlab chiquvchi rejimida ochiladi: tasdiqlash so‘raladi, «Rejimni o‘chirish» tugmasi bilan yopiladi.
- **Hudud.** Joriy hudud nomi ko‘rinadi. Radius 60, 90 yoki 150 m tanlanadi, atrofdagi uchastkalar ro‘yxati chiqadi: hovli, villa, do‘kon, ko‘p qavatli uy, ombor, ferma, bog‘.
- **Tanlash.** Ro‘yxatdan bosilgan uchastka 3D dunyoda firuza ramka bilan belgilanadi.
- **Amallar:**
  - siljitish (1 m qadam);
  - aylantirish (15°);
  - masshtab (0,5–2, faqat GLB model bilan);
  - «O‘chirish» (yashirish) va «Qaytarish»;
  - modelni almashtirish: asl protsedural bino yoki «Dunyo binosi A–D» GLB modellari;
  - «Asl holat».
- **Saqlash va bekor qilish.**
  - «Saqlash» o‘zgarishlarni brauzerga yozadi.
  - «Orqaga qaytarish» oxirgi 50 ta amalni bekor qiladi.
  - «Hammasini tiklash» barcha o‘zgarishlarni o‘chiradi.
- **Ikki muharrir bir-biriga xalaqit bermaydi.** Mulk muharriri `house:*` slotlarini ishlatadi, dunyo muharriri `building:world_*` slotlarini va alohida saqlash kalitini (`uzbek-life:world-edits`).
- **Cheklovlar:**
  - Landmark binolari (masjid, hokimiyat va boshqalar) himoyalangan, muharrirda ko‘rinmaydi.
  - Daraxt va chiroqlarni alohida tahrirlash hali yo‘q.
  - Bino siljitilganda yurish balandligi uchastkaning eski o‘rni bo‘yicha qoladi.
  - O‘zgarishlar dunyoning shu versiyasiga bog‘langan: dunyo generatori o‘zgarsa, eski o‘zgarishlar qo‘llanmaydi.

## 3. Mashina modellari
- Litsenziyali GLB tanlangan mashinaning hamma nusxalariga qo‘llanadi.


## 0.14 yangiliklari
- **Ikki rejim:** «Binolar» va «Daraxt, chiroq, skameyka, quti».
- **Filtrlar:** hudud (markaz, mahalla, yangi uylar, sanoat, qishloq, dalalar) va tur (masalan, faqat chinorlar yoki faqat skameykalar). Radius 40, 90 yoki 150 m.
- **Guruhlash:** ro‘yxatdan bir nechta obyektni bosing yoki «Hammasini guruhga» tugmasini ishlating. Siljitish, aylantirish, masshtab, yashirish va «Asl holat» butun guruhga qo‘llanadi.
- **Undo / Redo:** oxirgi 50 ta amal.
- **Bino ko‘chirilganda:** yurish balandligi va collision ham yangi joyga o‘tadi. Yashirilgan binoning collision qutilari o‘chadi.
- **Obyekt ko‘chirilganda:** daraxt, chiroq, skameyka va quti joyida yangilanadi, collision ham birga ko‘chadi.
- **Saqlash:** bino va obyekt o‘zgarishlari bitta kalitda saqlanadi (`uzbek-life:world-edits`).
