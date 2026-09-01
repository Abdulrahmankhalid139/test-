/**
 * bags.js — مقاسات شنط الكابينة المعلنة من شركات الطيران.
 *
 * ⚠️ الشركات بتغيّر حدودها، والحدود بتختلف حسب الدرجة ونوع التذكرة.
 * الأرقام دي للاسترشاد — راجع موقع شركتك قبل السفر.
 * وفيه دايماً خيار "مقاس مخصص" تكتب فيه أي مقاس بنفسك.
 */
export const CABIN_BAGS = [
  { id:'qr',      nameAr:'القطرية (اقتصادي)',   w:50, d:37, h:25, kg:7,  note:'شنطة واحدة' },
  { id:'ek',      nameAr:'طيران الإمارات',       w:55, d:38, h:20, kg:7,  note:'اقتصادي' },
  { id:'fz',      nameAr:'فلاي دبي',             w:55, d:38, h:20, kg:7,  note:'' },
  { id:'ey',      nameAr:'الاتحاد',              w:56, d:40, h:25, kg:7,  note:'' },
  { id:'sv',      nameAr:'السعودية',             w:56, d:45, h:25, kg:7,  note:'' },
  { id:'ms',      nameAr:'مصر للطيران',          w:55, d:40, h:20, kg:8,  note:'' },
  { id:'tk',      nameAr:'الخطوط التركية',       w:55, d:40, h:23, kg:8,  note:'' },
  { id:'iata',    nameAr:'المقاس الدولي الشائع', w:56, d:45, h:25, kg:0,  note:'IATA — مقبول في أغلب الشركات' },
  { id:'backpack',nameAr:'شنطة ضهر متوسطة',      w:45, d:30, h:20, kg:0,  note:'مقاس تقريبي' },
  { id:'custom',  nameAr:'مقاس مخصص',            w:0,  d:0,  h:0,  kg:0,  note:'اكتب مقاسك بنفسك' },
];

/** فئات الحاجات في وضع الشنطة — بتحدد الدوران والهشاشة والكبس. */
export const BAG_CATEGORIES = {
  laptop:     { labelAr:'لابتوب / تابلت',   keepUpright:true,  fragile:true },
  electronics:{ labelAr:'إلكترونيات',        keepUpright:false, fragile:true },
  camera:     { labelAr:'كاميرا / عدسة',     keepUpright:true,  fragile:true },
  glass:      { labelAr:'حاجة قابلة للكسر',  keepUpright:true,  fragile:true },
  shoes:      { labelAr:'جزم',               keepUpright:false, fragile:false },
  clothes:    { labelAr:'هدوم',              keepUpright:false, fragile:false, compressible:true },
  toiletries: { labelAr:'أدوات نظافة',       keepUpright:true,  fragile:false },
  book:       { labelAr:'كتاب / ورق',        keepUpright:false, fragile:false },
  food:       { labelAr:'أكل',               keepUpright:true,  fragile:false },
  other:      { labelAr:'حاجة تانية',        keepUpright:false, fragile:false },
};
