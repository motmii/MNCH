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

   Exposed on `window` as PLATFORM_CURRENT_SEMESTER; it is consumed
   by the live semester dashboard (script.js MODULE 43 · #semester).
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
        ar: "مفاهيم الخوارزمية ومعطياتها، تمثيل الحل بالكود الكاذب والمخططات الانسيابية، الهياكل الشرطية والتكرارية، خوارزميات البحث والترتيب، المصفوفات والقوائم، السلاسل النصية، ومقدمة في التشفير.",
        en: "Algorithm concepts and data, representing solutions with pseudocode and flowcharts, conditional and iterative structures, searching and sorting algorithms, arrays and lists, strings, and an introduction to cryptography."
      },

      whyItMatters: {
        ar: "الخوارزميات هي لغة التفكير الحاسوبي: بها تختار البنية والأسلوب الأنسب لكل مشكلة وتقيس كفاءة الحل قبل كتابته — وهي الأساس الذي تُبنى عليه أغلب مقررات الأمن المتقدمة.",
        en: "Algorithms are the language of computational thinking: they let you pick the right structure and strategy for each problem and measure a solution's efficiency before writing it — the foundation most advanced security courses build on."
      },

      difficulty: "intermediate",
      estimatedHours: 18,
      prerequisites: [],

      learningOutcomes: [
        { ar: "تعريف الخوارزمية ومعطياتها وتمييز الحسابية من غير الحسابية وموضع البرنامج منها.", en: "Define an algorithm, its data, computational vs non-computational kinds and the program's place." },
        { ar: "تمثيل الحل بالكود الكاذب والمخططات الانسيابية وتوظيف الهياكل الشرطية والتكرارية.", en: "Represent solutions with pseudocode and flowcharts and apply conditional and iterative structures." },
        { ar: "تطبيق خوارزميات البحث الخطي والثنائي والترتيب بالفقاعات والاختيار والإدراج وتتبع أثرها خطوة بخطوة.", en: "Apply linear and binary search and bubble, selection and insertion sorting, tracing their steps." },
        { ar: "تنفيذ عمليات القوائم على المصفوفات ومعالجة السلاسل النصية ومقارنة كفاءة الخوارزميات بالتعقيد الزمني.", en: "Implement array-based list operations and string processing, and compare algorithm efficiency via time complexity." },
        { ar: "شرح خدمات الأمن الأساسية ودور المفتاح ودوال التجزئة والتشفير المتماثل وغير المتماثل.", en: "Explain core security services and the roles of keys, hash functions and symmetric/asymmetric encryption." }
      ],

      commonMistakes: [
        { ar: "نسيان تحديث متغير التحكم داخل حلقة التكرار فيدخل البرنامج في تكرار لا نهائي.", en: "Forgetting the control variable's update inside a loop, causing an infinite loop." },
        { ar: "تشغيل البحث الثنائي على قائمة غير مرتبة فيُستبعد النصف الذي يحوي الهدف دون رسالة خطأ.", en: "Running binary search on an unsorted list, so the half holding the target is discarded silently." },
        { ar: "الخلط بين سعة المصفوفة وطول القائمة فيُكتب عنصر جديد في موضع لا وجود له.", en: "Confusing an array's capacity with the list's length, writing a new element into a nonexistent slot." },
        { ar: "الاعتماد على سرية الخوارزمية لحماية البيانات مع أن الأمان في سرية المفتاح.", en: "Relying on the algorithm's secrecy while security actually rests on the key's secrecy." }
      ],

      keyTerms: [
        { ar: "الخوارزمية", en: "Algorithm" },
        { ar: "الكود الكاذب", en: "Pseudocode" },
        { ar: "المخطط الانسيابي", en: "Flowchart" },
        { ar: "البحث الثنائي", en: "Binary Search" },
        { ar: "الترتيب", en: "Sorting" },
        { ar: "التعقيد الزمني", en: "Time Complexity" },
        { ar: "المصفوفة", en: "Array" },
        { ar: "السلسلة النصية", en: "String" },
        { ar: "التشفير", en: "Encryption" }
      ],

      lessons: [
        { ar: "الفصل 1 · مقدمة في الخوارزميات", en: "Chapter 1 · Introduction to Algorithms" },
        { ar: "الفصل 2 · الوصف الطبيعي والكود الكاذب والمخططات الانسيابية", en: "Chapter 2 · Natural Description, Pseudocode & Flowcharts" },
        { ar: "الفصل 3 · الهياكل الشرطية والتكرارية", en: "Chapter 3 · Conditional & Iterative Structures" },
        { ar: "الفصل 4 · خوارزميات البحث", en: "Chapter 4 · Searching Algorithms" },
        { ar: "الفصل 5 · خوارزميات الترتيب", en: "Chapter 5 · Sorting Algorithms" },
        { ar: "الفصل 6 · المصفوفات والقوائم", en: "Chapter 6 · Arrays & Lists" },
        { ar: "الفصل 7 · السلاسل النصية", en: "Chapter 7 · Strings" },
        { ar: "الفصل 8 · مقدمة في التشفير", en: "Chapter 8 · Introduction to Cryptography" }
      ],
      materials: [
        {
          title: { ar: "الفصل 1: مدخل إلى الخوارزميات", en: "Chapter 1: Introduction to Algorithms" },
          type: "lecture",
          path: "materials/algorithms/chapter-01-introduction.pdf"
        },
        {
          title: { ar: "الفصل 2: تمثيل الخوارزميات", en: "Chapter 2: Algorithm Representation" },
          type: "lecture",
          path: "materials/algorithms/chapter-02-algorithm-representation.pdf"
        },
        {
          title: { ar: "الفصل 4: خوارزميات البحث", en: "Chapter 4: Searching Algorithms" },
          type: "lecture",
          path: "materials/algorithms/chapter-04-searching-algorithms.pdf"
        },
        {
          title: { ar: "الفصل 7: خوارزميات التعامل مع السلاسل النصية", en: "Chapter 7: String Algorithms" },
          type: "lecture",
          path: "materials/algorithms/chapter-07-string-algorithms.pdf"
        }
      ],
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
        hue: 210,
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
        ar: "وظائف نظام التشغيل، النواة والواجهات، الأجهزة الافتراضية، العمليات والخيوط، الجدولة والمقاطعات، إدارة الذاكرة والترحيل، نظم الملفات، وأساسيات سطر أوامر Linux.",
        en: "Operating-system functions, kernel and interfaces, virtual machines, processes and threads, scheduling and interrupts, memory management and paging, file systems, and Linux command-line fundamentals."
      },

      whyItMatters: {
        ar: "نظام التشغيل هو الوسيط بين أي برنامج والعتاد: من يفهم العمليات والصلاحيات والذاكرة يفهم أين تُهاجم الأنظمة وكيف تُحصَّن — وهذا جوهر تأمين النظم وتحليل البرمجيات الخبيثة.",
        en: "The OS is the layer between every program and the hardware: understanding processes, privileges and memory means understanding where systems are attacked and how they are hardened — the core of system security and malware analysis."
      },

      difficulty: "beginner",
      estimatedHours: 14,
      prerequisites: [],

      learningOutcomes: [
        { ar: "شرح وظائف نظام التشغيل وتطوره وأنواعه ومعايير اختياره.", en: "Explain OS functions, evolution, types and selection criteria." },
        { ar: "تمييز مهام النواة والواجهات وأوضاع التشغيل واستدعاءات النظام.", en: "Distinguish kernel tasks, interfaces, execution modes and system calls." },
        { ar: "إنشاء الأجهزة الافتراضية وتوزيع مواردها وإدارتها باللقطات وضبط شبكاتها.", en: "Create virtual machines, allocate resources, manage snapshots and configure their networks." },
        { ar: "تحليل العمليات والخيوط وحالاتها وضبط التزامن وتشخيص حالات النظام.", en: "Analyze processes, threads and states, tame concurrency and diagnose system states." },
        { ar: "تتبع الجدولة وإدارة الذاكرة والترحيل ونظم الملفات وأوامر الطرفية.", en: "Trace scheduling, memory management and paging, file systems and terminal commands." }
      ],

      commonMistakes: [
        { ar: "الاعتقاد أن خيوط العملية الواحدة محمية من بعضها كالعمليات المنفصلة مع أن الذاكرة مشتركة.", en: "Believing sibling threads are protected like separate processes while their memory is shared." },
        { ar: "تجاهل أن لكل عملية فضاء عناوين خاصًا وأن العناوين الافتراضية تترجم قبل الوصول إلى الذاكرة.", en: "Ignoring that each process owns an address space and virtual addresses translate before memory is reached." },
        { ar: "علاج اختناق مورد مشبع بترقية مورد آخر غير مشبع، كما في مثال الطابعة المنشغلة 133%.", en: "Treating a saturated-resource bottleneck by upgrading a different resource, as in the 133% printer example." },
        { ar: "توجيه إشارة القتل الفوري قبل تجربة الإنهاء اللطيف، ومحاولة قتل العمليات الزومبي.", en: "Sending instant kills before gentle exits, and trying to kill zombie processes." },
        { ar: "تنفيذ أوامر الحذف من غير التحقق من الموقع الحالي وعرض المحتوى أولًا.", en: "Running deletion commands without verifying the current location and listing the target first." }
      ],

      keyTerms: [
        { ar: "النواة", en: "Kernel" },
        { ar: "الجهاز الافتراضي", en: "Virtual Machine" },
        { ar: "العملية", en: "Process" },
        { ar: "الخيط", en: "Thread" },
        { ar: "الجدولة", en: "Scheduling" },
        { ar: "المقاطعة", en: "Interrupt" },
        { ar: "الذاكرة الافتراضية", en: "Virtual Memory" },
        { ar: "نظام الملفات", en: "File System" },
        { ar: "الطرفية", en: "Terminal" }
      ],

      lessons: [
        { ar: "الفصل 1 · مقدمة في نظم التشغيل", en: "Chapter 1 · Introduction to Operating Systems" },
        { ar: "الفصل 2 · مهام نظام التشغيل: النواة والواجهات", en: "Chapter 2 · OS Tasks: Kernel & Interfaces" },
        { ar: "الفصل 3 · الأجهزة الافتراضية", en: "Chapter 3 · Virtual Machines" },
        { ar: "الفصل 4 · إدارة العمليات والخيوط", en: "Chapter 4 · Process & Thread Management" },
        { ar: "الفصل 5 · جدولة المعالج والمقاطعات", en: "Chapter 5 · CPU Scheduling & Interrupts" },
        { ar: "الفصل 6 · إدارة الذاكرة", en: "Chapter 6 · Memory Management" },
        { ar: "الفصل 7 · نظم الملفات", en: "Chapter 7 · File Systems" },
        { ar: "الفصل 8 · الطرفية: سطر أوامر Linux", en: "Chapter 8 · The Linux Terminal" }
      ],
      materials: [
        {
          title: { ar: "الفصل 1: مقدمة في نظم التشغيل", en: "Chapter 1: Introduction to Operating Systems" },
          type: "lecture",
          path: "materials/operating-systems/chapter-01-introduction-to-operating-systems.pdf"
        },
        {
          title: { ar: "الفصل 3: إدارة العمليات", en: "Chapter 3: Process Management" },
          type: "lecture",
          path: "materials/operating-systems/chapter-03-process-management.pdf"
        },
        {
          title: { ar: "الفصل 4: إدارة الذاكرة", en: "Chapter 4: Memory Management" },
          type: "lecture",
          path: "materials/operating-systems/chapter-04-memory-management.pdf"
        },
        {
          title: { ar: "الفصل 6: إدارة الإدخال والإخراج", en: "Chapter 6: Input/Output Management" },
          type: "lecture",
          path: "materials/operating-systems/chapter-06-input-output-management.pdf"
        },
        {
          title: { ar: "الفصل 7: الأمان في نظم التشغيل", en: "Chapter 7: Operating System Security" },
          type: "lecture",
          path: "materials/operating-systems/chapter-07-operating-system-security.pdf"
        },
        {
          title: { ar: "الفصل 8: نظم تشغيل شائعة ومقارنة بينها", en: "Chapter 8: Common Operating Systems and Comparison" },
          type: "lecture",
          path: "materials/operating-systems/chapter-08-common-operating-systems-comparison.pdf"
        },
        {
          title: { ar: "الفصل 9: تطبيقات عملية في نظم التشغيل", en: "Chapter 9: Practical Applications of Operating Systems" },
          type: "lecture",
          path: "materials/operating-systems/chapter-09-practical-operating-system-applications.pdf"
        }
      ],
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
        hue: 42,
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
        ar: "مفاهيم السياسة الأمنية وهيكلها وأهدافها، والتشريعات المرتبطة بأمن المعلومات والتحكم في الوصول والتشفير وتكامل البيانات، والأخلاقيات المهنية وسرية المعلومات وتعارض المصالح وحدود الصلاحيات والإبلاغ عن الحوادث، والامتثال التنظيمي وتقييم المخاطر القانونية والأخلاقية، والثقافة التنظيمية وبرامج التوعية الأمنية.",
        en: "Security policy concepts, structure and goals; information-security legislation, access control, cryptography and data integrity; professional ethics, confidentiality, conflicts of interest, authority limits and incident reporting; regulatory compliance and legal/ethical risk assessment; and organizational culture and security-awareness programs."
      },

      whyItMatters: {
        ar: "أقوى تقنية أمنية تسقط بلا سياسة واضحة أو إذن قانوني: هذه المادة تمنحك الإطار الذي يحدد ما يجوز وما يُمنع، وتحميك وتحمي مؤسستك — وهي لغة أي وظيفة حوكمة وامتثال في الأمن.",
        en: "The strongest security control falls without a clear policy or legal authorization: this subject gives you the framework that defines what is allowed and what is not, protecting you and your organization — the language of every security GRC role."
      },

      difficulty: "beginner",
      estimatedHours: 10,
      prerequisites: [],

      learningOutcomes: [
        { ar: "تعريف السياسة الأمنية ومكوناتها وهرم وثائقها من السياسة إلى البرامج والمعايير والإجراءات.", en: "Define a security policy, its components and the document hierarchy from policy to programs, standards and procedures." },
        { ar: "تمييز التشريعات المرتبطة بأمن المعلومات ومفاهيم التحكم في الوصول والتشفير وتكامل البيانات.", en: "Distinguish information-security legislation and the concepts of access control, cryptography and data integrity." },
        { ar: "تطبيق الأخلاقيات المهنية في سرية المعلومات وتعارض المصالح وحدود الصلاحيات والإبلاغ عن الحوادث.", en: "Apply professional ethics in confidentiality, conflicts of interest, authority limits and incident reporting." },
        { ar: "تفسير الامتثال التنظيمي وتقييم المخاطر القانونية والأخلاقية وبناء برنامج توعية أمنية وثقافة تنظيمية.", en: "Interpret regulatory compliance and legal/ethical risk assessment and build a security-awareness program and organizational culture." }
      ],

      commonMistakes: [
        { ar: "الاعتماد على سياسة شفوية أو منح استثناء للسياسة الأمنية دون تصريح رسمي مسبق.", en: "Relying on an unwritten policy or granting late policy exceptions without prior formal authorization." },
        { ar: "الافتراض أن وحدة الالتزام وحدها كافية لمعالجة المخالفات دون دور للتدقيق الداخلي أو الإدارة.", en: "Assuming the compliance unit alone can handle violations without internal audit or management involvement." },
        { ar: "قياس نجاح برنامج التوعية فقط بحضور الموظفين للمحاضرات دون تقييم التغيير السلوكي.", en: "Measuring awareness-program success only by attendance rather than behavioral change." }
      ],

      keyTerms: [
        { ar: "السياسة الأمنية", en: "Security Policy" },
        { ar: "التشريعات المرتبطة بأمن المعلومات", en: "Information-Security Legislation" },
        { ar: "الأخلاقيات المهنية", en: "Professional Ethics" },
        { ar: "الالتزام التنظيمي", en: "Regulatory Compliance" },
        { ar: "تقييم المخاطر", en: "Risk Assessment" },
        { ar: "برنامج التوعية الأمنية", en: "Security Awareness Program" }
      ],

      lessons: [
        { ar: "الفصل 1 · مقدمة في السياسات الأمنية", en: "Chapter 1 · Introduction to Security Policies" },
        { ar: "الفصل 2 · التشريعات والقوانين المرتبطة بأمن المعلومات", en: "Chapter 2 · Legislation and Laws Related to Information Security" },
        { ar: "الفصل 3 · الأخلاقيات المهنية في أمن المعلومات", en: "Chapter 3 · Professional Ethics in Information Security" },
        { ar: "الفصل 4 · الامتثال والالتزام التنظيمي", en: "Chapter 4 · Compliance and Regulatory Adherence" },
        { ar: "الفصل 5 · تقييم المخاطر القانونية والأخلاقية", en: "Chapter 5 · Legal and Ethical Risk Assessment" },
        { ar: "الفصل 6 · الثقافة التنظيمية والتوعية الأمنية", en: "Chapter 6 · Organizational Culture and Security Awareness" }
      ],
      materials: [
        {
          title: { ar: "الفصل 1: مقدمة في السياسات الأمنية", en: "Chapter 1: Introduction to Security Policies" },
          type: "lecture",
          path: "materials/policies-ethics/chapter-01-introduction-to-security-policies.pdf"
        },
        {
          title: { ar: "الفصل 2: التشريعات والقوانين المرتبطة بأمن المعلومات", en: "Chapter 2: Information Security Legislation" },
          type: "lecture",
          path: "materials/policies-ethics/chapter-02-information-security-legislation.pdf"
        },
        {
          title: { ar: "الفصل 3: الأخلاقيات المهنية في أمن المعلومات", en: "Chapter 3: Professional Ethics in Information Security" },
          type: "lecture",
          path: "materials/policies-ethics/chapter-03-professional-ethics.pdf"
        },
        {
          title: { ar: "الفصل 4: الامتثال والالتزام التنظيمي", en: "Chapter 4: Compliance and Regulatory Adherence" },
          type: "lecture",
          path: "materials/policies-ethics/chapter-04-regulatory-compliance.pdf"
        },
        {
          title: { ar: "الفصل 5: تقييم المخاطر القانونية والأخلاقية", en: "Chapter 5: Legal and Ethical Risk Assessment" },
          type: "lecture",
          path: "materials/policies-ethics/chapter-05-legal-and-ethical-risk-assessment.pdf"
        },
        {
          title: { ar: "الفصل 6: الثقافة التنظيمية والتوعية الأمنية", en: "Chapter 6: Organizational Culture and Security Awareness" },
          type: "lecture",
          path: "materials/policies-ethics/chapter-06-organizational-culture-and-security-awareness.pdf"
        }
      ],
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
        hue: 288,
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
        { ar: "الحوسبة السحابية", en: "Cloud Computing" },
        { ar: "أمن الشبكات", en: "Network Security" },
        { ar: "قواعد البيانات", en: "Databases" },
        { ar: "تحليل الأنظمة وتصميمها", en: "Systems Analysis and Design" }
      ],

      lessons: [
        { ar: "الفصل 1 · نظم المعلومات ومكوناتها", en: "Chapter 1 · Information Systems and Their Components" },
        { ar: "الفصل 2 · مكونات الأجهزة والبرمجيات", en: "Chapter 2 · Hardware and Software Components" },
        { ar: "الفصل 3 · الحوسبة السحابية", en: "Chapter 3 · Cloud Computing" },
        { ar: "الفصل 4 · أمن المعلومات والشبكات", en: "Chapter 4 · Information and Network Security" },
        { ar: "الفصل 5 · قواعد البيانات", en: "Chapter 5 · Databases" },
        { ar: "الفصل 6 · أمن الشبكات وحمايتها", en: "Chapter 6 · Network Security and Protection" },
        { ar: "الفصل 7 · تحليل الأنظمة وتصميمها", en: "Chapter 7 · Systems Analysis and Design" }
      ],
      materials: [
        {
          title: { ar: "الفصل 1: نظم المعلومات ومكوناتها", en: "Chapter 1: Information Systems and Their Components" },
          type: "lecture",
          path: "materials/it-components/chapter-01-information-systems-and-their-components.pdf"
        },
        {
          title: { ar: "الفصل 2: مكونات الأجهزة والبرمجيات", en: "Chapter 2: Hardware and Software Components" },
          type: "lecture",
          path: "materials/it-components/chapter-02-hardware-and-software-components.pdf"
        },
        {
          title: { ar: "الفصل 3: الحوسبة السحابية", en: "Chapter 3: Cloud Computing" },
          type: "lecture",
          path: "materials/it-components/chapter-03-cloud-computing.pdf"
        },
        {
          title: { ar: "الفصل 4: أمن المعلومات والشبكات", en: "Chapter 4: Information and Network Security" },
          type: "lecture",
          path: "materials/it-components/chapter-04-information-and-network-security.pdf"
        },
        {
          title: { ar: "الفصل 5: قواعد البيانات", en: "Chapter 5: Databases" },
          type: "lecture",
          path: "materials/it-components/chapter-05-databases.pdf"
        },
        {
          title: { ar: "الفصل 6: أمن الشبكات وحمايتها", en: "Chapter 6: Network Security and Protection" },
          type: "lecture",
          path: "materials/it-components/chapter-06-network-security-and-protection.pdf"
        },
        {
          title: { ar: "الفصل 7: تحليل الأنظمة وتصميمها", en: "Chapter 7: Systems Analysis and Design" },
          type: "lecture",
          path: "materials/it-components/chapter-07-systems-analysis-and-design.pdf"
        }
      ],
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
        hue: 168,
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

      lessons: [
        { ar: "الفصل 1 · مقدمة في مبادئ التصميم الأمني", en: "Chapter 1 · Introduction to Security Design Principles" },
        { ar: "الفصل 2 · مكونات التصميم الأمني", en: "Chapter 2 · Security Design Components" },
        { ar: "الفصل 3 · نماذج التهديد وتحليل المخاطر وصمود النظم", en: "Chapter 3 · Threat Modeling, Risk Analysis and System Resilience" },
        { ar: "الفصل 4 · مبادئ التصميم المقاومة للهجمات السيبرانية", en: "Chapter 4 · Attack-Resistant Design Principles" },
        { ar: "الفصل 5 · أمان البرمجيات وواجهات المستخدم وإدارة الأخطاء", en: "Chapter 5 · Software Security, User Interfaces and Error Handling" },
        { ar: "الفصل 6 · الاختبار الآمن والامتثال وتحسين التصميم", en: "Chapter 6 · Security Testing, Compliance and Design Improvement" },
        { ar: "الفصل 7 · مبادئ التصميم في بيئات الحوسبة الحديثة", en: "Chapter 7 · Design Principles in Modern Computing Environments" }
      ],
      materials: [
        {
          title: { ar: "الفصل 1: مقدمة في مبادئ التصميم الأمني", en: "Chapter 1: Introduction to Security Design Principles" },
          type: "lecture",
          path: "materials/security-design/chapter-01-introduction-to-security-design.pdf"
        },
        {
          title: { ar: "الفصل 2: مكونات التصميم الأمني", en: "Chapter 2: Security Design Components" },
          type: "lecture",
          path: "materials/security-design/chapter-02-security-design-components.pdf"
        },
        {
          title: { ar: "الفصل 3: نماذج التهديد وتحليل المخاطر", en: "Chapter 3: Threat Modeling and Risk Analysis" },
          type: "lecture",
          path: "materials/security-design/chapter-03-threat-modeling-and-risk-analysis.pdf"
        },
        {
          title: { ar: "الفصل 4: تصميم الأنظمة المقاومة للهجمات", en: "Chapter 4: Designing Attack-Resistant Systems" },
          type: "lecture",
          path: "materials/security-design/chapter-04-attack-resistant-system-design.pdf"
        },
        {
          title: { ar: "الفصل 5: أمان البرمجيات والتطبيقات", en: "Chapter 5: Software and Application Security" },
          type: "lecture",
          path: "materials/security-design/chapter-05-software-and-application-security.pdf"
        },
        {
          title: { ar: "الفصل 6: تقييم واختبار أمان الأنظمة", en: "Chapter 6: Security Assessment and Testing" },
          type: "lecture",
          path: "materials/security-design/chapter-06-security-assessment-and-testing.pdf"
        },
        {
          title: { ar: "الفصل 7: الاتجاهات الحديثة في التصميم الأمني", en: "Chapter 7: Modern Security Design Trends" },
          type: "lecture",
          path: "materials/security-design/chapter-07-modern-security-design-trends.pdf"
        }
      ],
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
        hue: 20,
        tag: "design",
        schedule: {
          day: { ar: "الثلاثاء", en: "Tuesday" },
          startTime: "09:00 AM",
          endTime: "12:00 PM"
        }
      }
    }
  ],

  /* ------------------------------------------------------------
     LECTURE ACCESS GUIDE — the official "how do I get into today's
     live class" walkthrough, rendered by script.js MODULE 61 both
     inline in the Current Semester dashboard (#semesterGuide) and
     as the standalone shareable view (#guide).

     Rules honored here (same as the rest of this file):
     - Everything is bilingual { ar, en } — the renderer never mixes.
     - Only REAL, publicly known Microsoft endpoints are listed:
       no invented meeting URLs and no fake deep links. The meeting
       link itself is published by the department inside each course
       team, which is stated honestly in `note`.
     - The weekly timetable shown in the guide is DERIVED from the
       `meta.schedule` of the official subjects above — never
       duplicated here.
     ------------------------------------------------------------ */
  lectureGuide: {
    id: "lecture-access-guide",

    warning: {
      ar: "انتبه: رابط المحاضرة يُنشر فقط داخل قنوات القسم الرسمية (فرق Teams أو منصة الجامعة). لا تفتح روابط المحاضرات من رسائل مجهولة، ولا تُدخل بريدك الجامعي وكلمة مرورك في أي صفحة خارج Teams — من يطلب كلمة مرورك أو رمز التحقق يقوم بعملية احتيال.",
      en: "Heads-up: lecture links are published only inside the department's official channels (Microsoft Teams or the university portal). Never open lecture links from unknown messages, and never type your student e-mail and password on any page outside Teams — anyone asking for your password or one-time code is phishing you."
    },

    steps: [
      {
        t: { ar: "اعرف موعد حصتك", en: "Know your class slot" },
        d: {
          ar: "راجع جدولك الأسبوعي في «لوحة الترم الحالي» أو شريط «الآن» في الصفحة الرئيسية: يوم المحاضرة ووقتها الرسمي لكل مادة كما ورد في الخطة المعتمدة.",
          en: "Check your weekly timetable in the Current Semester board or the \"Now\" strip on the home page: the day and official time of every class exactly as listed in the approved plan."
        }
      },
      {
        t: { ar: "افتح Teams بحسابك الجامعي", en: "Open Teams with your student account" },
        d: {
          ar: "سجّل الدخول ببريدك الجامعي فقط، وفعّل التحقق بخطوتين إن كان متاحًا في حسابك. لا تنشئ حسابًا شخصيًا للمحاضرات ولا تشارك حسابك مع أي شخص.",
          en: "Sign in with your university e-mail only, and turn on two-step verification if your account offers it. Never create a personal account for lectures and never share your account with anyone."
        }
      },
      {
        t: { ar: "ادخل فريق المادة", en: "Enter the course team" },
        d: {
          ar: "من قائمة الفرق في Teams اختر فريق المادة باسمها أو برمز المقرر، ثم افتح القناة المخصصة للمحاضرة (غالبًا General أو قناة بعنوان الأسبوع/الفصل).",
          en: "From the Teams list pick the course team by name or course code, then open the channel used for the lecture (usually General or a week/chapter-named channel)."
        }
      },
      {
        t: { ar: "انضم من القناة أو التقويم", en: "Join from the channel or the calendar" },
        d: {
          ar: "اضغط Join الآن داخل مشاركة الاجتماع في القناة، أو افتح تبويب Calendar وحدّد موعد الحصة ثم Join. زر الانضمام يتفعّل قبل الموعد بدقائق.",
          en: "Press Join inside the meeting post in the channel, or open the Calendar tab, pick the class occurrence and press Join. The Join button becomes active a few minutes before the start."
        }
      },
      {
        t: { ar: "اضبط الصوت والميكروفون قبل البدء", en: "Set audio and mic before you start" },
        d: {
          ar: "في شاشة الدخول اختر السماعة والميكروفون الصحيحين، وأبقِ ميكروفونك مغلقًا حتى يتحدث المحاضر، واكتب أسئلتك في محادثة القناة.",
          en: "On the pre-join screen pick the right speaker and microphone, keep your mic muted until the instructor speaks, and write your questions in the channel conversation."
        }
      },
      {
        t: { ar: "بعد المحاضرة: راجّع وسجّل", en: "After class: review and log it" },
        d: {
          ar: "التسجيل وملفات المحاضرة تبقى في قناة المادة نفسها (Recordings و Files). حمّلها، ثم راجع بنك الأسئلة الخاص بالمادة في المنصة وحدّد نقاط ضعفك قبل الاختبار.",
          en: "The recording and the class files stay in the same channel (Recordings and Files). Download them, then run the subject's question bank here on the platform and mark your weak points before the exam."
        }
      }
    ],

    links: [
      {
        id: "teams-web",
        title: { ar: "فتح Microsoft Teams في المتصفح", en: "Open Microsoft Teams in the browser" },
        desc: {
          ar: "الدخول المباشر لواجهة Teams — سجّل الدخول ببريدك الجامعي ثم اختر فريق المادة.",
          en: "Direct access to Teams — sign in with your university e-mail, then open the course team."
        },
        url: "https://teams.microsoft.com/",
        host: "teams.microsoft.com"
      },
      {
        id: "teams-app",
        title: { ar: "تنزيل تطبيق Microsoft Teams", en: "Download the Microsoft Teams app" },
        desc: {
          ar: "تطبيق سطح المكتب والجوال من موقع Microsoft الرسمي — أكثر استقرارًا للمحاضرات الطويلة.",
          en: "The desktop and mobile app from the official Microsoft site — more stable for long lectures."
        },
        url: "https://www.microsoft.com/en-us/microsoft-teams/download-app",
        host: "microsoft.com"
      },
      {
        id: "teams-support",
        title: { ar: "مركز مساعدة Microsoft Teams", en: "Microsoft Teams help centre" },
        desc: {
          ar: "حلول رسمية لمشاكل تسجيل الدخول والصوت والانضمام بالاجتماع.",
          en: "Official fixes for sign-in, audio and meeting-join problems."
        },
        url: "https://support.microsoft.com/",
        host: "support.microsoft.com"
      }
    ],

    problems: [
      {
        q: { ar: "الرابط لا يفتح، أو طلب تسجيل الدخول ثم رفض الحساب", en: "The link will not open, or it rejects my sign-in" },
        a: {
          ar: "افتح Teams من الرابط الرسمي أعلاه وسجّل الدخول ببريدك الجامعي. إذا قُبل الحساب ولم يظهر فريق المادة فحسابك لم يُضَف إلى الفريق بعد — راجع إعلان القسم أو تواصل مع أستاذ المادة من البريد الجامعي.",
          en: "Open Teams from the official link above and sign in with your university e-mail. If the account is accepted but the course team is missing, you have not been added to the team yet — check the department announcement or contact the instructor from your university e-mail."
        }
      },
      {
        q: { ar: "ظهرت لي شاشة «قاعة الانتظار» ولم يُدخلني المحاضر", en: "I am stuck in the \"waiting room\"" },
        a: {
          ar: "هذه إعدادات يتحكم فيها المحاضر: انتظر داخل قاعة الانتظار ولا تُغلق النافذة، وإن تأخر الدخول اكتب رسالة في قناة الفريق أو راسل المحاضر من داخل Teams.",
          en: "This is an instructor-controlled setting: stay in the waiting room instead of closing the window, and if access is delayed post in the team channel or message the instructor inside Teams."
        }
      },
      {
        q: { ar: "لا أسمع الصوت أو الميكروفون لا يعمل", en: "No audio, or my microphone does not work" },
        a: {
          ar: "من داخل Teams: الإعدادات ثم Device settings واختر السماعة والميكروفون الصحيحين، وأغلق أي تطبيق آخر يستخدم الميكروفون، ثم حدّث المتصفح أو استخدم التطبيق بدل الموقع.",
          en: "Inside Teams open Settings then Device settings and pick the correct speaker and microphone, close every other app using the mic, then refresh the browser or use the desktop app instead of the web one."
        }
      },
      {
        q: { ar: "فاتتني الحصة أو انقطع عني الاتصال", en: "I missed the class or got disconnected" },
        a: {
          ar: "شاهد تسجيل المحاضرة وملفاتها في قناة المادة، وأبلغ أستاذ المادة بالاعتذار في نفس اليوم عبر البريد الجامعي، وسجّل المهام أو الاختبارات القصيرة التي فاتتك فورًا.",
          en: "Watch the lecture recording and its files in the course channel, send the instructor a same-day excuse by university e-mail, and immediately log any assignment or short quiz you missed."
        }
      },
      {
        q: { ar: "كيف أتأكد أن الرابط أو الطلب رسمي؟", en: "How do I verify a link or request is official?" },
        a: {
          ar: "تأكد من عنوان الصفحة (نطاق الجامعة أو teams.microsoft.com) ومن أن الرسالة وصلت داخل قنوات القسم. لا تُرسل كلمة مرورك أو رمز التحقق لأي شخص مهما ادّعى — هذا هو التطبيق العملي لما تدرسه في مادتي السياسات والتصميم الأمني.",
          en: "Check the address bar (the university domain or teams.microsoft.com) and confirm the message arrived inside the department channels. Never send your password or one-time code to anyone, whatever they claim — that is the practical side of what you study in the Policies and Security Design courses."
        }
      }
    ],

    note: {
      ar: "الجدول أعلاه مأخوذ من خطة الترم الحالية المعتمدة في المنصة؛ أي تغيير في المواعيد أو الروابط يعلنه القسم رسميًا — راجع إعلان المادة قبل الحصة بدقائق.",
      en: "The timetable above comes from the approved current-semester plan on this platform; any change to times or links is announced officially by the department — read the course announcement a few minutes before class."
    }
  }
};

/* Expose as a plain data registry (window.PLATFORM_CURRENT_SEMESTER).
   CONSUMED by the live Current Semester dashboard: index.html loads
   this file before script.js, and script.js MODULE 43
   (SemesterDashboard) renders the #semester view from it — the
   subject cards, summary counters and quiz/tool/lab links on the
   dashboard all come from this object (single source of truth). */
if (typeof window !== "undefined") {
  window.PLATFORM_CURRENT_SEMESTER = CURRENT_SEMESTER;
}

/* Lightweight CommonJS export used by the smoke tests (Node without DOM).
   In the browser `module` is undefined so this is a harmless no-op. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = CURRENT_SEMESTER;
}