import type { PropertyDef, PropertyType } from '@/types';

export const PROPERTY_TYPE_NAMES: Record<PropertyType, string> = {
  apartment: 'Kvartira',
  house: 'Hovli uy',
  luxury: 'Hashamatli uy',
  commercial: 'Tijorat binosi',
  garage: 'Garaj',
};

export const PROPERTIES: PropertyDef[] = [
  { id: 'apt-yunusobod', name: '2 xonali kvartira, 4-qavat', type: 'apartment', price: 318_000_000, income: 0, block: [4, 0], side: 's', description: 'Panel uyda ta’mirlangan kvartira. Hovlisida bolalar maydonchasi bor.', hasGarage: false },
  { id: 'apt-yangi', name: '3 xonali kvartira, yangi uy', type: 'apartment', price: 476_000_000, income: 0, block: [5, 2], side: 'n', description: 'Yangi qurilgan 12 qavatli uyda keng kvartira, yer osti avtoturargohi bilan.', hasGarage: true },
  { id: 'hovli-bogbon', name: 'Mahalladagi hovli uy', type: 'house', price: 640_000_000, income: 0, block: [0, 2], side: 'e', description: 'Uzum ishkomi, so‘ri va ikki mashinalik hovlisi bor uy.', hasGarage: true },
  { id: 'hovli-katta', name: 'Katta hovli, mevali bog‘ bilan', type: 'house', price: 910_000_000, income: 0, block: [2, 4], side: 'w', description: 'Olti xonali, ikki qavatli uy. Orqa tomonda mevali bog‘.', hasGarage: true },
  { id: 'villa-qishloq', name: 'Hashamatli villa', type: 'luxury', price: 2_350_000_000, income: 0, block: [5, 7], side: 'n', description: 'Qishloq chetida, tog‘ manzarali villa: hovuz, bog‘ va uch o‘rinli garaj.', hasGarage: true },
  { id: 'biz-choyxona', name: 'Markazdagi choyxona', type: 'commercial', price: 1_150_000_000, income: 1_250_000, block: [3, 3], side: 's', description: 'Doimiy mijozlari bor choyxona. Har kuni bank hisobingizga daromad tushadi.', hasGarage: false },
  { id: 'biz-avtoyuvish', name: 'Avtoyuvish shoxobchasi', type: 'commercial', price: 1_580_000_000, income: 1_800_000, block: [6, 1], side: 's', description: 'Sanoat zonasidagi uch postli avtoyuvish.', hasGarage: false },
  { id: 'biz-supermarket', name: 'Supermarket', type: 'commercial', price: 2_800_000_000, income: 3_300_000, block: [5, 5], side: 's', description: 'Markaziy ko‘chadagi oziq-ovqat supermarketi.', hasGarage: false },
  { id: 'garaj-ikki', name: 'Garaj, 2 o‘rin', type: 'garage', price: 118_000_000, income: 0, block: [6, 4], side: 'w', description: 'Mashinalaringizni saqlash, ta’mirlash va sozlash uchun shaxsiy garaj.', hasGarage: true },
];

export const PROPERTY_MAP: Record<string, PropertyDef> = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));
