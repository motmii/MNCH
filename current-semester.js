"use strict";
/* ============================================================
   CURRENT_SEMESTER — centralized semester configuration
   (دبلوم أمن المعلومات — تجسير مهني · الترم الحالي)
   ------------------------------------------------------------
   Single source of truth for the CURRENT SEMESTER as a
   curriculum object: bilingual (AR/EN) title + description and
   one clean record per OFFICIAL study-plan subject.

   Rules honored by this file:
   - ONLY subjects that already exist in the platform's SUBJECTS
     registry (script.js MODULE 00b) are listed here — exactly
     the 5 official current-semester courses, keyed by their
     official course codes (stable ids, never array indexes).
   - Every text field is bilingual: { ar: "...", en: "..." }.
   - `quizzes` references real question banks in
     data/quizzes.json (keys = course codes — the same keys the
     quiz engine and SUBJECTS.quizKey already use).
   - `relatedTools` / `relatedLabs` reference EXISTING platform
     assets only (TOOLS_META tool-card ids and lab view ids),
     following the authored links in script.js MODULE 42.
   - `lessons` is honestly empty for now: authored lessons for
     the current-semester subjects are not published yet
     (MODULE 40 LESSONS is empty). The dashboard treats a
     subject with no lessons with an honest empty state, and
     future lessons are added here in the same shape without
     touching the rendering code.

   Exposed on `window` as PLATFORM_CURRENT_SEMESTER so the
   semester dashboard (script.js MODULE 43) can consume it.
   ============================================================ */

const CURRENT_SEMESTER = {
  id: "current-semester",

  title: {
    ar: "الترم الحالي",
    en: "Current Semester"
  },

  description: {
    ar: "خطة تعليمية مبسطة لمتابعة مواد الترم الحالي.",
    en: "A guided learning plan for the current semester."
  },

  meta: {
    program: {
      ar: "دبلوم أمن المعلومات — تجسير مهني",
      en: "Information Security Diploma — Professional Bridging"
    }
  },

  subjects: [
    /* ---- 01 · الخوارزميات (الأحد 9:00–12:00) ---- */
    {
      id: "260210030702",
      code: "260210030702",

      name: {
        ar: "الخوارزميات",
        en: "Algorithms"
      },

      shortDescription: {
        ar: "تحليل الخوارزميات وتعقيدها الزمني، هياكل البيانات، استراتيجيات التصميم (فرّق تسُد، الجشع، البرمجة الديناميكية)، والرسوم البيانية.",
        en: "Algorithm analysis and time complexity, data structures, design strategies (divide & conquer, greedy, dynamic programming) and graphs."
      },

      whyItMatters: {
        ar: "الخوارزميات هي لغة التفكير الحاسوبي: بها تختار البنية والأسلوب الأنسب لكل مشكلة وتقيس كفاءة الحل قبل كتابته — وهي الأساس الذي تُبنى عليه أغلب مقررات الأمن المتقدمة.",
        en: "Algorithms are the language of computational thinking: they let you pick the right structure and strategy for each problem and measure a solution's efficiency before writing it — the foundation most advanced security courses build on."
      },

      difficulty: "intermediate",
      estimatedHours: 18,
      prerequisites: [],

      learningOutcomes: [
        { ar: "قياس كفاءة الخوارزمية بتدوين Big-O زمنيًا ومكانيًا.", en: "Measure algorithm efficiency with Big-O in time and space." },
        { ar: "اختيار هيكل البيانات المناسب (مصفوفة، مكدس، طابور، شجرة، رسم).", en: "Choose the right data structure (array, stack, queue, tree, graph)." },
        { ar: "تطبيق استراتيجيات فرّق تسُد والجشع والبرمجة الديناميكية.", en: "Apply divide & conquer, greedy and dynamic-programming strategies." },
        { ar: "تنقّل الرسوم البيانية بـ BFS وDFS وتقييم أقصر المسارات.", en: "Traverse graphs with BFS/DFS and evaluate shortest paths." }
      ],

      commonMistakes: [
        { ar: "الخلط بين التعقيد الزمني وعدد أسطر الكود أو سرعة الجهاز.", en: "Confusing time complexity with lines of code or hardware speed." },
        { ar: "حفظ الخوارزميات دون تتبّع تنفيذها خطوة بخطوة على أمثلة.", en: "Memorizing algorithms without tracing them step by step on examples." },
        { ar: "نسيان حالة الأساس في العودية فيسلك الاستدعاء بلا نهاية.", en: "Forgetting the recursion base case, so calls never terminate." }
      ],

      keyTerms: [
        { ar: "الخوارزمية", en: "Algorithm" },
        { ar: "التعقيد الزمني", en: "Time Complexity" },
        { ar: "هياكل البيانات", en: "Data Structures" },
        { ar: "فرّق تسُد", en: "Divide & Conquer" },
        { ar: "البرمجة الديناميكية", en: "Dynamic Programming" },
        { ar: "الرسوم البيانية", en: "Graphs" }
      ],

      lessons: [],
      quizzes: ["260210030702"],
      relatedTools: [],
      relatedLabs: [],

      careerConnections: [
        { ar: "تطوير أدوات ومنظومات أمنية بكفاءة عالية.", en: "Building efficient security tooling and systems." },
        { ar: "أتمتة مهام مركز العمليات الأمنية (SOC).", en: "Automating SOC (Security Operations) tasks." },
        { ar: "البحث الأمني وتحليل السلوكيات على نطاق واسع.", en: "Security research and large-scale behavior analysis." }
      ],

      meta: {
        creditHours: 3,
        icon: "images/algorithms.svg",
        hue: 190,
        tag: "algorithms",
        schedule: {
          day: { ar: "الأحد", en: "Sunday" },
          startTime: "09:00 AM",
          endTime: "12:00 PM"
        }
      }
    },
    /* ---- 02 · مفاهيم نظم التشغيل (الأحد 12:00–3:00) ---- */
    {
      id: "260210030802",
      code: "260210030802",

      name: {
        ar: "مفاهيم نظم التشغيل",
        en: "Operating Systems Concepts"
      },

      shortDescription: {
        ar: "وظائف نظام التشغيل، العمليات والخيوط والجدولة، إدارة الذاكرة والترحيل، المزامنة والأقفال الميتة، ونظم الملفات.",
        en: "Operating-system functions, processes, threads and scheduling, memory management and paging, synchronization and deadlocks, and file systems."
      },

      whyItMatters: {
        ar: "نظام التشغيل هو الوسيط بين أي برنامج والعتاد: من يفهم العمليات والصلاحيات والذاكرة يفهم أين تُهاجم الأنظمة وكيف تُحصَّن — وهذا جوهر تأمين النظم وتحليل البرمجيات الخبيثة.",
        en: "The OS is the layer between every program and the hardware: understanding processes, privileges and memory means understanding where systems are attacked and how they are hardened — the core of system security and malware analysis."
      },

      difficulty: "beginner",
      estimatedHours: 14,
      prerequisites: [],

      learningOutcomes: [
        { ar: "شرح وظائف نظام التشغيل وعلاقته بالعتاد والتطبيقات.", en: "Explain OS functions and their relation to hardware and apps." },
        { ar: "التمييز بين العمليات والخيوط وكيفية عمل الجدولة.", en: "Distinguish processes from threads and how scheduling works." },
        { ar: "وصف إدارة الذاكرة والترحيل والذاكرة الافتراضية.", en: "Describe memory management, paging and virtual memory." },
        { ar: "تحليل حالات المزامنة والأقفال الميتة ونظم الملفات.", en: "Analyze synchronization, deadlocks and file systems." }
      ],

      commonMistakes: [
        { ar: "الاعتقاد أن خيوط العملية الواحدة تعمل بذاكرة مستقلة تمامًا.", en: "Assuming threads of one process run with fully separate memory." },
        { ar: "الخلط بين ذاكرة RAM المؤقتة والتخزين الدائم للبيانات.", en: "Mixing up volatile RAM with permanent storage." },
        { ar: "نسيان أن القفل الميت يحتاج شروطًا متزامنة ليقع.", en: "Forgetting that a deadlock needs several conditions at once." }
      ],

      keyTerms: [
        { ar: "العملية", en: "Process" },
        { ar: "الخيط", en: "Thread" },
        { ar: "الجدولة", en: "Scheduling" },
        { ar: "الترحيل", en: "Paging" },
        { ar: "القفل الميت", en: "Deadlock" },
        { ar: "نظام الملفات", en: "File System" }
      ],

      lessons: [],
      quizzes: ["260210030802"],
      relatedTools: [],
      relatedLabs: ["redteam"],

      careerConnections: [
        { ar: "إدارة الأنظمة وتأمينها (System Administration).", en: "System administration and hardening." },
        { ar: "تحليل البرمجيات الخبيثة وسلوكها داخل النظام.", en: "Malware analysis and in-OS behavior analysis." },
        { ar: "مهام DevSecOps وتأمين بيئات الاستضافة.", en: "DevSecOps and hosted-environment security." }
      ],

      meta: {
        creditHours: 3,
        icon: "images/os-concepts.svg",
        hue: 205,
        tag: "osconcepts",
        schedule: {
          day: { ar: "الأحد", en: "Sunday" },
          startTime: "12:00 PM",
          endTime: "03:00 PM"
        }
      }
    },
    /* ---- 03 · السياسات والتشريعات والأخلاقيات والالتزام بها (الاثنين 9:00–12:00) ---- */
    {
      id: "260210030902",
      code: "260210030902",

      name: {
        ar: "السياسات والتشريعات والأخلاقيات والالتزام بها",
        en: "Policies, Legislation, Ethics & Compliance"
      },

      shortDescription: {
        ar: "سياسات الأمن وأنواعها، التشريعات والخصوصية والملكية الفكرية، الأخلاقيات المهنية والإذن القانوني، والامتثال.",
        en: "Security policies and their types, legislation, privacy and intellectual property, professional ethics and legal authorization, and compliance."
      },

      whyItMatters: {
        ar: "أقوى تقنية أمنية تسقط بلا سياسة واضحة أو إذن قانوني: هذه المادة تمنحك الإطار الذي يحدد ما يجوز وما يُمنع، وتحميك وتحمي مؤسستك — وهي لغة أي وظيفة حوكمة وامتثال في الأمن.",
        en: "The strongest security control falls without a clear policy or legal authorization: this subject gives you the framework that defines what is allowed and what is not, protecting you and your organization — the language of every security GRC role."
      },

      difficulty: "beginner",
      estimatedHours: 10,
      prerequisites: [],

      learningOutcomes: [
        { ar: "صياغة سياسة أمنية وتمييز أنواعها ومكوناتها.", en: "Draft a security policy and distinguish its types and parts." },
        { ar: "التعرف على التشريعات والخصوصية والملكية الفكرية.", en: "Recognize legislation, privacy and intellectual-property concepts." },
        { ar: "التطبيق الأخلاقي المهني وحدود الإذن القانوني.", en: "Apply professional ethics and the limits of legal authorization." },
        { ar: "فهم متطلبات الامتثال وكيفية التحقق منها.", en: "Understand compliance requirements and how they are verified." }
      ],

      commonMistakes: [
        { ar: "الخلط بين السياسة (قرار داخلي) والتشريع (قانون ملزم).", en: "Mixing policy (an internal decision) with legislation (binding law)." },
        { ar: "افتراض أن الفعل القانوني هو تلقائيًا فعل أخلاقي والعكس.", en: "Assuming anything legal is automatically ethical — or the reverse." },
        { ar: "التعامل مع الامتثال كمهمة لمرة واحدة لا دورة مستمرة.", en: "Treating compliance as a one-time task instead of a continuous cycle." }
      ],

      keyTerms: [
        { ar: "سياسة الأمن", en: "Security Policy" },
        { ar: "التشريع", en: "Legislation" },
        { ar: "الخصوصية", en: "Privacy" },
        { ar: "الملكية الفكرية", en: "Intellectual Property" },
        { ar: "الإذن القانوني", en: "Legal Authorization" },
        { ar: "الامتثال", en: "Compliance" }
      ],

      lessons: [],
      quizzes: ["260210030902"],
      relatedTools: ["tool-vuln", "tool-portscan"],
      relatedLabs: [],

      careerConnections: [
        { ar: "محلل حوكمة ومخاطر وامتثال (GRC).", en: "GRC (Governance, Risk & Compliance) analyst." },
        { ar: "تدقيق الامتثال الأمني للمؤسسات.", en: "Security-compliance auditing for organizations." },
        { ar: "الاختبار الأخلاقي المرخص ضمن فريق رسمي.", en: "Licensed, authorized penetration-testing teams." }
      ],

      meta: {
        creditHours: 3,
        icon: "images/policies-ethics.svg",
        hue: 265,
        tag: "policy",
        schedule: {
          day: { ar: "الاثنين", en: "Monday" },
          startTime: "09:00 AM",
          endTime: "12:00 PM"
        }
      }
    },
    /* ---- 04 · مكونات أنظمة تقنية المعلومات (الاثنين 12:00–3:00) ---- */
    {
      id: "260210031002",
      code: "260210031002",

      name: {
        ar: "مكونات أنظمة تقنية المعلومات",
        en: "IT Systems Components"
      },

      shortDescription: {
        ar: "مكونات أنظمة تقنية المعلومات من عتاد وبرمجيات وشبكات ومرافق، والمحاكاة الافتراضية والسحابة، وعلاقتها بتأمين البيئة.",
        en: "IT-system components across hardware, software, networks and facilities, virtualization and the cloud, and how they relate to securing the environment."
      },

      whyItMatters: {
        ar: "لا يمكن تأمين ما لا تفهم مكوناته: هذه المادة ترسم خريطة البيئة التقنية كاملة — من المعالج والذاكرة إلى الشبكة والمرفق والسحابة — فتعرف أين تسكن البيانات وأين توجد الثغرات قبل أن يخبرك بها المهاجم.",
        en: "You cannot secure what you don't understand: this subject maps the whole technical environment — from CPU and memory to networks, facilities and the cloud — so you know where data lives and where weaknesses exist before an attacker shows you."
      },

      difficulty: "beginner",
      estimatedHours: 12,
      prerequisites: [],

      learningOutcomes: [
        { ar: "تحديد مكونات العتاد والبرمجيات ووظيفة كل منها.", en: "Identify hardware and software components and their roles." },
        { ar: "وصف عناصر الشبكات والمرافق في بيئة المعلومات.", en: "Describe network and facility elements of an IT environment." },
        { ar: "شرح المحاكاة الافتراضية والحوسبة السحابية ونماذجها.", en: "Explain virtualization, cloud computing and its service models." },
        { ar: "ربط كل مكون بمسؤوليات تأمينه العملية.", en: "Connect every component to its practical security responsibilities." }
      ],

      commonMistakes: [
        { ar: "ظن أن ذاكرة RAM تحفظ البيانات بعد إطفاء الجهاز.", en: "Believing RAM keeps data after power-off." },
        { ar: "إهمال العنصر البشري عند تعداد مكونات النظام.", en: "Forgetting the human element when listing system components." },
        { ar: "الاعتقاد أن السحابة أو الافتراضية آمنة تلقائيًا.", en: "Assuming the cloud or virtualization is secure by default." }
      ],

      keyTerms: [
        { ar: "العتاد", en: "Hardware" },
        { ar: "البرمجيات", en: "Software" },
        { ar: "المحاكاة الافتراضية", en: "Virtualization" },
        { ar: "الحوسبة السحابية", en: "Cloud Computing" },
        { ar: "الشبكات", en: "Networks" },
        { ar: "المرافق", en: "Facilities" }
      ],

      lessons: [],
      quizzes: ["260210031002"],
      relatedTools: ["tool-cidr", "tool-sniffer"],
      relatedLabs: [],

      careerConnections: [
        { ar: "دعم ومهارات تقنية المعلومات (IT Support).", en: "IT support and field technician roles." },
        { ar: "إدارة الشبكات والبنية التحتية.", en: "Network and infrastructure administration." },
        { ar: "عمليات السحابة وتأمين بيئات الاستضافة.", en: "Cloud operations and hosting-environment security." }
      ],

      meta: {
        creditHours: 3,
        icon: "images/it-components.svg",
        hue: 130,
        tag: "components",
        schedule: {
          day: { ar: "الاثنين", en: "Monday" },
          startTime: "12:00 PM",
          endTime: "03:00 PM"
        }
      }
    },
    /* ---- 05 · مبادئ التصميم في الأمن السيبراني (الثلاثاء 9:00–12:00) ---- */
    {
      id: "260210031102",
      code: "260210031102",

      name: {
        ar: "مبادئ التصميم في الأمن السيبراني",
        en: "Cybersecurity Design Principles"
      },

      shortDescription: {
        ar: "مبادئ تصميم الأمن: الدفاع في العمق، أقل الصلاحيات، الفصل بين المهام، الثقة الصفرية، والتحكم في الوصول.",
        en: "Security design principles: defense in depth, least privilege, separation of duties, zero trust and access control."
      },

      whyItMatters: {
        ar: "الأمن ليس منتجًا يُشترى بل تصميم يُبنى: هذه المادة تمنحك المبادئ التي يفكر بها المهندسون عند بناء أي نظام آمن — بها تفهم لماذا وُضع كل ضابط في مكانه وتقدّر التصميمات الأمنية بدلًا من حفظها.",
        en: "Security is not a product you buy but a design you build: this subject gives you the principles engineers think with when constructing any secure system — so you understand why every control sits where it sits and can evaluate security designs instead of memorizing them."
      },

      difficulty: "beginner",
      estimatedHours: 12,
      prerequisites: [],

      learningOutcomes: [
        { ar: "شرح مبدأ الدفاع في العمق وتصميم طبقات متعددة.", en: "Explain defense in depth and design multiple layers." },
        { ar: "تطبيق مبدأ أقل الصلاحيات والفصل بين المهام.", en: "Apply least privilege and separation of duties." },
        { ar: "تفسير نموذج الثقة الصفرية ومكوناته.", en: "Interpret the zero-trust model and its components." },
        { ar: "تصميم تحكم بالوصول مناسب لسيناريو معين.", en: "Design suitable access control for a given scenario." }
      ],

      commonMistakes: [
        { ar: "الاعتماد على ضابط واحد قوي بدل طبقات مترابطة.", en: "Relying on one strong control instead of layered controls." },
        { ar: "فهم أقل الصلاحيات كمنع كامل للوصول لا كحد أدنى كافٍ.", en: "Reading least privilege as blocking all access, not the sufficient minimum." },
        { ar: "ظن أن الثقة الصفرية أداة تُركب لا نهج يُطبق على كل طلب.", en: "Treating zero trust as a single product instead of verifying every request." }
      ],

      keyTerms: [
        { ar: "الدفاع في العمق", en: "Defense in Depth" },
        { ar: "أقل الصلاحيات", en: "Least Privilege" },
        { ar: "الفصل بين المهام", en: "Separation of Duties" },
        { ar: "الثقة الصفرية", en: "Zero Trust" },
        { ar: "التحكم في الوصول", en: "Access Control" },
        { ar: "سطح الهجوم", en: "Attack Surface" }
      ],

      lessons: [],
      quizzes: ["260210031102"],
      relatedTools: ["tool-hash", "tool-caesar", "tool-playground"],
      relatedLabs: ["cryptolab"],

      careerConnections: [
        { ar: "مهندس/مستشار أمن المعلومات (مدخل).", en: "Junior security architect / consultant." },
        { ar: "محلل في مركز العمليات الأمنية (SOC).", en: "SOC (Security Operations) analyst." },
        { ar: "مراجعة وتقييم التصميمات الأمنية.", en: "Security-design review and assessment." }
      ],

             meta: {
        creditHours: 3,
        icon: "images/security-design.svg",
        hue: 300,
        tag: "design",
        schedule: {
          day: { ar: "الثلاثاء", en: "Tuesday" },
          startTime: "09:00 AM",
          endTime: "12:00 PM"
        }
      }
    }
  ]
};

/* Expose as a plain data registry (window.PLATFORM_CURRENT_SEMESTER).
   NOTE: no view consumes it yet — the UI renders its own SUBJECTS
   registry (script.js MODULE 00b) and there is no semester-dashboard
   module. Kept as the single-source curriculum object for future UI. */
window.PLATFORM_CURRENT_SEMESTER = CURRENT_SEMESTER;

/* Lightweight CommonJS export used by the smoke tests (Node without DOM).
   In the browser `module` is undefined so this is a harmless no-op. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = CURRENT_SEMESTER;
}