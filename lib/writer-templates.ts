import { compileWriterProjectSections, createWriterProjectSection } from "@/lib/writer-project";

export type WriterTemplateCategory =
    | "research"
    | "article"
    | "teaching"
    | "thesis"
    | "book"
    | "laboratory";

export type WriterTemplateIcon =
    | "book-open"
    | "flask"
    | "newspaper"
    | "graduation-cap"
    | "scroll-text";

export type WriterTemplateAddOnIcon =
    | "sigma"
    | "newspaper"
    | "sparkles"
    | "scroll-text"
    | "briefcase"
    | "graduation-cap";

export type WriterTemplateAddOn = {
    id: string;
    title: string;
    description: string;
    icon: WriterTemplateAddOnIcon;
    snippet: string;
};

export type WriterTemplatePreset = {
    id: string;
    title: string;
    description: string;
    templateId: string;
    addOnIds: string[];
};

export type WriterTemplate = {
    id: string;
    title: string;
    shortDescription: string;
    description: string;
    category: WriterTemplateCategory;
    icon: WriterTemplateIcon;
    accentClassName: string;
    recommendedFor: string[];
    recommendedAddOnIds: string[];
    titleTemplate: string;
    abstractTemplate: string;
    contentTemplate: string;
    keywords: string;
};

export const DEFAULT_WRITER_TEMPLATE_ID = "research-paper";
export const DEFAULT_WRITER_PRESET_ID = "journal-ready";

const legacyTemplateIdMap: Record<string, string> = {
    research: "research-paper",
    article: "expository-article",
    book: "textbook-manuscript",
    simple: "expository-article",
    "proof-note": "research-paper",
    "magazine-feature": "expository-article",
    "project-report": "lab-report",
    "problem-book": "textbook-manuscript",
    "lecture-book": "lecture-note",
    "monograph-manuscript": "textbook-manuscript",
    "olympiad-book": "textbook-manuscript",
};

export const writerTemplates: WriterTemplate[] = [
    {
        id: "research-paper",
        title: "Research Paper",
        shortDescription: "Formal ilmiy maqola uchun IMRAD uslubidagi qat'iy skelet.",
        description: "Kirish, metod, natija, muhokama va xulosa bilan jurnal yoki konferensiya maqolasini professional boshlash uchun.",
        category: "research",
        icon: "book-open",
        accentClassName: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        recommendedFor: ["Journal article", "Conference submission", "Formal mathematical analysis"],
        recommendedAddOnIds: ["citation-guide", "theorem-pack", "appendix-pack"],
        titleTemplate: "Tadqiqot maqolasi sarlavhasi",
        abstractTemplate: "Ushbu maqola [mavzu] bo'yicha [metod] asosida olingan natijalarni tahlil qiladi va [asosiy xulosa]ni ko'rsatadi.",
        contentTemplate: `# Kirish

Mavzuning dolzarbligi, tadqiqot savoli va maqsadini aniq bayon qiling.

## Muammo qo'yilishi

Asosiy muammo, belgilashlar va ishlatiladigan obyektlarni kiriting.

## Metodologiya

Qo'llangan nazariy apparat, hisoblash usuli yoki isbot strategiyasini yozing.

## Asosiy natijalar

> **Teorema 1.**

> **Isbot.** Bosqichma-bosqich isbot shu yerga yoziladi.

## Muhokama

Natijalarni oldingi ishlar yoki intuitiv talqin bilan taqqoslang.

## Xulosa

Yakuniy xulosalar va keyingi tadqiqot yo'nalishlarini yozing.

## Ishlatilgan adabiyotlar

1. Muallif, *Asar nomi*, jurnal yoki nashr, yil.
`,
        keywords: "research, mathematics, analysis",
    },
    {
        id: "expository-article",
        title: "Article",
        shortDescription: "Tushuntiruvchi yoki ilmiy-ommabop maqola uchun toza professional format.",
        description: "Intuitiv kirish, asosiy g'oya, vizual blok va yakuniy xulosalar bilan o'qilishi yengil maqola andozasi.",
        category: "article",
        icon: "newspaper",
        accentClassName: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
        recommendedFor: ["Public article", "Concept explainer", "Magazine-style mathematics writing"],
        recommendedAddOnIds: ["visualization-pack", "example-bank"],
        titleTemplate: "Maqola sarlavhasi",
        abstractTemplate: "Ushbu maqola [mavzu]ni intuitiv misollar, grafiklar va sodda izohlar orqali tushuntiradi.",
        contentTemplate: `# Asosiy g'oya

O'quvchini mavzuga olib kiruvchi qisqa kirish yozing.

## Muammo nimada?

Mavzuning nega qiziq ekanini sodda tilda tushuntiring.

## Intuitiv tushuntirish

Asosiy fikrni obrazli yoki oddiy misol bilan bering.

## Grafik yoki tajriba

\`\`\`plot2d
{
  "f": "x^2",
  "domain": [-10, 10],
  "title": "Namunaviy grafik"
}
\`\`\`

## Chuqurroq qarash

Formalroq tushuntirish yoki formula shu yerda beriladi.

## Xulosa

Maqoladan chiqadigan asosiy fikrlar va keyingi o'qish yo'nalishi.
`,
        keywords: "article, exposition, visualization",
    },
    {
        id: "lecture-note",
        title: "Lecture Note",
        shortDescription: "Dars, seminar va qo'llanma uchun strukturali ta'lim andozasi.",
        description: "Ta'riflar, teoremalar, misollar va mashqlar bilan o'quvchi uchun tushunarli lecture note formati.",
        category: "teaching",
        icon: "graduation-cap",
        accentClassName: "text-teal-500 bg-teal-500/10 border-teal-500/20",
        recommendedFor: ["University lecture", "Workshop handout", "Self-study material"],
        recommendedAddOnIds: ["example-bank", "citation-guide"],
        titleTemplate: "Mavzu nomi",
        abstractTemplate: "Ushbu lecture note [mavzu]ning asosiy g'oyalari, ta'riflari va tipik misollarini jamlaydi.",
        contentTemplate: `# Kirish

Mavzuga intuitiv kirish va asosiy motivatsiyani yozing.

## Muhim ta'riflar

> **Ta'rif.** Asosiy tushuncha shu yerda beriladi.

## Asosiy teoremalar

> **Teorema.** Bayonot.

> **Isbot g'oyasi.** To'liq yoki qisqa tushuntirish.

## Misollar

1. Birinchi misol.
2. Ikkinchi misol.

## Mashqlar

1. Mustaqil ishlash topshirig'i.
2. Qo'shimcha savol.
`,
        keywords: "lecture, notes, teaching",
    },
    {
        id: "thesis-chapter",
        title: "Thesis Chapter",
        shortDescription: "Bitiruv ishi yoki dissertatsiya bobi uchun formal akademik tuzilma.",
        description: "Nazariy asoslar, related work, asosiy tahlil va natijalarni bir bob ichida toza joylash uchun.",
        category: "thesis",
        icon: "scroll-text",
        accentClassName: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
        recommendedFor: ["Bachelor thesis", "Master thesis", "Dissertation chapter"],
        recommendedAddOnIds: ["citation-guide", "appendix-pack"],
        titleTemplate: "Bob sarlavhasi",
        abstractTemplate: "Ushbu bob [mavzu]ning nazariy asoslari, tegishli ishlar va asosiy natijalarini tizimli ravishda ko'rib chiqadi.",
        contentTemplate: `# Bobga kirish

Bobning umumiy maqsadi va kontekstini yozing.

## 1. Nazariy asoslar

Tushunchalar, belgilashlar va zarur old bilimlar.

## 2. Tegishli ishlar

Oldingi tadqiqotlar yoki manbalarni qisqacha ko'rib chiqing.

## 3. Asosiy tahlil

Matematik model, isbot yoki asosiy derivatsiyalar.

## 4. Natijalar

Bob doirasida olingan yangi xulosalar.

## 5. Yakuniy eslatmalar

Keyingi bob bilan bog'lanish va o'tish.
`,
        keywords: "thesis, chapter, academic writing",
    },
    {
        id: "textbook-manuscript",
        title: "Book Manuscript",
        shortDescription: "Kitob yoki darslik yozish uchun chapter-based professional andoza.",
        description: "Bo'lim maqsadlari, asosiy mavzu, misollar, mashqlar va yakuniy xulosalar bilan kitob yozishni tartibli boshlaydi.",
        category: "book",
        icon: "scroll-text",
        accentClassName: "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20",
        recommendedFor: ["Course book", "Textbook", "Chapter-based manuscript"],
        recommendedAddOnIds: ["theorem-pack", "example-bank", "citation-guide"],
        titleTemplate: "Kitob nomi",
        abstractTemplate: "Ushbu qo'lyozma [mavzu] bo'yicha bosqichma-bosqich tushuntirish, misollar va mashqlar orqali to'liq o'quv yo'lini taklif qiladi.",
        contentTemplate: `# 1-bob. Kirish

Bu bobda kitobning umumiy maqsadi, auditoriyasi va o'quvchi bu yerda nimani o'rganishi kutilayotgani yoziladi.

## O'quv maqsadlari

1. Bob oxirida o'quvchi nimalarni tushunishi kerak?
2. Qaysi formulalar yoki metodlar egallanadi?
3. Keyingi boblar uchun qanday tayanch quriladi?

## Asosiy tushunchalar

> **Ta'rif.** Darslikdagi birinchi fundamental tushuncha.

## Tushuntiruvchi misol

O'quvchiga mavzuni ochib beradigan aniq, sodda va bosqichma-bosqich misol yozing.

## Teorema yoki qoida

> **Teorema.** Asosiy natija.
>
> **Isbot g'oyasi.** O'quvchi uchun yengil, didaktik izoh.

## Mashqlar

1. Kirish darajasidagi savol.
2. O'rta darajadagi mashq.
3. Chuqurroq fikrlashni talab qiladigan topshiriq.

## Bob yakuni

Bobdan olinadigan asosiy xulosalarni qisqa va aniq jamlang.
`,
        keywords: "book, textbook, mathematics education",
    },
    {
        id: "lab-report",
        title: "Lab Report",
        shortDescription: "Laboratoriya natijalarini writer bilan toza birlashtirish uchun maxsus format.",
        description: "Hisoblash tajribasi, observation va vizual natijalarni maqola yoki hisobotga aylantirish uchun mo'ljallangan.",
        category: "laboratory",
        icon: "flask",
        accentClassName: "text-rose-500 bg-rose-500/10 border-rose-500/20",
        recommendedFor: ["Laboratory export", "Computation session", "Experiment summary"],
        recommendedAddOnIds: ["lab-observation-pack", "visualization-pack", "delivery-checklist"],
        titleTemplate: "Laboratoriya hisobot sarlavhasi",
        abstractTemplate: "Mazkur hisobot laboratoriyada bajarilgan [hisoblash/tajriba] jarayoni, kuzatuvlar va olingan natijalarni umumlashtiradi.",
        contentTemplate: `# Vazifa

Laboratoriyada ko'rilgan masala yoki tajribani yozing.

## Berilganlar

Ishlatilgan parametrlar, ifodalar yoki boshlang'ich shartlar.

## Hisoblash jarayoni

Laboratoriya modulidan olingan asosiy bosqichlar va izohlar.

## Natijalar

Grafik, jadval yoki live blok natijalari shu yerda sharhlanadi.

## Tahlil

Natijalar nimani ko'rsatishini izohlang.

## Xulosa

Yakuniy baho va keyingi tekshirishlar.
`,
        keywords: "laboratory, report, computation",
    },
];

export const writerTemplateAddOns: WriterTemplateAddOn[] = [
    {
        id: "theorem-pack",
        title: "Theorem Pack",
        description: "Teorema, lemma va isbot uchun tayyor formal bloklar.",
        icon: "sigma",
        snippet: `## Qo'shimcha teorema bloki

> **Lemma.** Yordamchi natija shu yerda yoziladi.
>
> **Isbot.** Lemma isboti.

> **Teorema.** Asosiy bayonot.
>
> **Isbot.** Teorema isboti shu yerga yoziladi.
`,
    },
    {
        id: "citation-guide",
        title: "Citation Guide",
        description: "Manbalar bilan ishlash va bibliografiya uchun tayyor bo'lim.",
        icon: "scroll-text",
        snippet: `## Citation Notes

Matn ichida manbani \`[1]\` yoki \`[Muallif, yil]\` formatida belgilang.

## Ishlatilgan adabiyotlar

1. Muallif, *Asar nomi*, jurnal yoki nashr, yil.
2. Muallif, *Asar nomi*, nashriyot, yil.
`,
    },
    {
        id: "visualization-pack",
        title: "Visualization Pack",
        description: "Grafik va vizual tushuntirish uchun tayyor blok.",
        icon: "newspaper",
        snippet: `## Vizual tahlil

\`\`\`plot2d
{
  "f": "sin(x)",
  "domain": [-10, 10],
  "title": "Vizual tahlil grafigi"
}
\`\`\`

Grafikdan olingan kuzatuvlar shu yerda yoziladi.
`,
    },
    {
        id: "example-bank",
        title: "Example Bank",
        description: "Misollar va mashqlarni tez qo'shish uchun blok.",
        icon: "graduation-cap",
        snippet: `## Misollar

1. Birinchi misol.
2. Ikkinchi misol.

## Mashqlar

1. Mustaqil yechish uchun topshiriq.
2. Qo'shimcha savol.
`,
    },
    {
        id: "lab-observation-pack",
        title: "Lab Observation Pack",
        description: "Kuzatuv, parametr va experiment log uchun blok.",
        icon: "sparkles",
        snippet: `## Observation Log

- Ishlatilgan parametrlar:
- Kuzatilgan xatti-harakat:
- Kutilmagan natija:

## Experiment Notes

- Qadam 1:
- Qadam 2:
- Qadam 3:
`,
    },
    {
        id: "appendix-pack",
        title: "Appendix Pack",
        description: "Appendix va texnik detallar uchun tayyor bo'lim.",
        icon: "briefcase",
        snippet: `## Appendix

Bu yerda qo'shimcha hisoblash, texnik tafsilot yoki yordamchi jadval beriladi.
`,
    },
    {
        id: "delivery-checklist",
        title: "Delivery Checklist",
        description: "Maqola topshirishdan oldingi tekshiruv ro'yxati.",
        icon: "scroll-text",
        snippet: `## Submission Checklist

- [ ] Sarlavha yakuniy tekshirildi
- [ ] Abstract tozalandi
- [ ] Formulalar tekshirildi
- [ ] Grafik va bloklar ko'rib chiqildi
- [ ] Adabiyotlar moslashtirildi
`,
    },
];

export const writerTemplatePresets: WriterTemplatePreset[] = [
    {
        id: "journal-ready",
        title: "Journal Ready",
        description: "Formal research maqola va topshirish uchun kerakli bloklar.",
        templateId: "research-paper",
        addOnIds: ["citation-guide", "theorem-pack", "appendix-pack", "delivery-checklist"],
    },
    {
        id: "article-ready",
        title: "Article Ready",
        description: "Vizual blok va misollar bilan toza maqola starti.",
        templateId: "expository-article",
        addOnIds: ["visualization-pack", "example-bank"],
    },
    {
        id: "book-ready",
        title: "Book Ready",
        description: "Kitob yoki darslik yozishni chapter-based skelet bilan boshlaydi.",
        templateId: "textbook-manuscript",
        addOnIds: ["theorem-pack", "example-bank", "citation-guide", "appendix-pack"],
    },
    {
        id: "lab-ready",
        title: "Lab Ready",
        description: "Laboratoriya eksportlari va observation bloklari bilan tayyor draft.",
        templateId: "lab-report",
        addOnIds: ["lab-observation-pack", "visualization-pack", "delivery-checklist"],
    },
];

export function getWriterTemplate(templateId: string | null | undefined) {
    const normalizedId = templateId ? legacyTemplateIdMap[templateId] ?? templateId : templateId;
    return writerTemplates.find((template) => template.id === normalizedId) ?? null;
}

export function getDefaultWriterTemplate() {
    return getWriterTemplate(DEFAULT_WRITER_TEMPLATE_ID) ?? writerTemplates[0];
}

export function getWriterTemplatePreset(presetId: string | null | undefined) {
    return writerTemplatePresets.find((preset) => preset.id === presetId) ?? null;
}

export function getDefaultWriterTemplatePreset() {
    return getWriterTemplatePreset(DEFAULT_WRITER_PRESET_ID) ?? writerTemplatePresets[0];
}

export function resolveWriterTemplateAddOns(addOnIds: string[] = []) {
    return addOnIds
        .map((addOnId) => writerTemplateAddOns.find((addOn) => addOn.id === addOnId) ?? null)
        .filter((addOn): addOn is WriterTemplateAddOn => Boolean(addOn));
}

export function createDraftFromTemplate(template: WriterTemplate, addOnIds: string[] = []) {
    const resolvedAddOns = resolveWriterTemplateAddOns(addOnIds);
    const addOnContent = resolvedAddOns.map((addOn) => addOn.snippet.trim()).join("\n\n");
    const content = addOnContent
        ? `${template.contentTemplate.trim()}\n\n---\n\n${addOnContent}\n`
        : template.contentTemplate;
    const sections = [
        createWriterProjectSection({
            title: template.title,
            kind: template.category === "thesis" || template.category === "book" ? "chapter" : "section",
            content,
            order: 1,
        }),
    ];

    return {
        title: template.titleTemplate,
        abstract: template.abstractTemplate,
        content: compileWriterProjectSections(sections),
        authors: "",
        keywords: template.keywords,
        status: "draft",
        document_kind: template.category === "thesis" || template.category === "book" ? "book" : "paper",
        branding_enabled: true,
        branding_label: "Powered by MathSphere Writer",
        sections,
    };
}
