const ayat = [
  { text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا", reference: "سورة الشرح · الآية ٥" },
  { text: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا", reference: "سورة البقرة · الآية ٢٨٦" },
  { text: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ", reference: "سورة الرعد · الآية ٢٨" },
  { text: "وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنْتُمُ الْأَعْلَوْنَ إِنْ كُنْتُمْ مُؤْمِنِينَ", reference: "سورة آل عمران · الآية ١٣٩" },
  { text: "لَا تَقْنَطُوا مِنْ رَحْمَةِ اللَّهِ", reference: "سورة الزمر · الآية ٥٣" },
  { text: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", reference: "سورة البقرة · الآية ١٥٣" },
  { text: "وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ", reference: "سورة الطلاق · الآية ٣" },
];

// UTC date keeps the displayed ayah identical for every signed-in user.
function getDailyAyahIndex() {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const epoch = Date.UTC(2026, 0, 1);
  const day = Math.floor((today - epoch) / 86_400_000);
  return ((day % ayat.length) + ayat.length) % ayat.length;
}

export function DailyAyah() {
  const ayah = ayat[getDailyAyahIndex()];

  return (
    <section
      dir="rtl"
      aria-label="آية اليوم"
      className="daily-ayah-card relative mx-3 mb-4 overflow-hidden rounded-2xl border px-4 py-4 shadow-sm sm:mx-5 sm:px-5"
    >
      <div className="relative z-10 flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
          <span className="text-xl">۞</span>
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-xs font-bold tracking-wide text-primary">آية اليوم · تذكرة طيبة</div>
          <p className="text-base font-semibold leading-8 text-foreground sm:text-lg">{ayah.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ayah.reference}</p>
        </div>
      </div>
    </section>
  );
}
