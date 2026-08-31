/* ============================================================
   منصة أمن المعلومات — مساعد المنصة (MODULE 33 · AI.Assistant)
   ------------------------------------------------------------
   Arabic-first assistant grounded ONLY in the platform's real
   content (subjects, quiz rules, tools, flashcard terms, labs).

   Architecture (GitHub Pages — static, no secrets):
   1) Optional LLM backend: set window.PLATFORM_AI = { endpoint:
      "/api/chat" } (any serverless proxy that holds the provider
      key server-side and answers { reply: string }).
      Never put an API key in frontend code or storage.
   2) Always-available fallback: a local rule-based knowledge
      engine (this file) answers from the platform's data, so the
      assistant works offline / without any backend at all.
   ============================================================ */
(function () {
  "use strict";

  const $id = (id) => document.getElementById(id);

  /** Escape HTML-significant characters. @param {string} s @returns {string} */
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const CONFIG = (window.PLATFORM_AI || {});
  const ENDPOINT = typeof CONFIG.endpoint === "string" ? CONFIG.endpoint : "";

  const root = $id("assistantRoot");
  const fab = $id("assistantFab");
  const panel = $id("assistantPanel");
  const log = $id("assistantLog");
  const form = $id("assistantForm");
  const input = $id("assistantInput");
  const chipsBox = $id("assistantChips");
  const closeBtn = $id("assistantClose");
  const statusEl = $id("assistantStatus");
  if (!root || !fab || !panel || !log || !form || !input) return;

  /* Reveal the widget immediately: show the FAB, keep the panel closed.
     (Matches the markup where assistantRoot is no longer hidden.) */
  setOpen(false);

  /* Chat persistence — remember the last MAX_MSGS messages in localStorage.
     loadHistory/renderHistory/clearHistory are hoisted function decls. */
  const STORE_KEY = "motmi-assistant-chat";
  const MAX_MSGS = 20;
  let history = loadHistory();
  renderHistory();

  /* Small "Trash" clear button added to the panel header (before the X). */
  const headEl = panel.querySelector(".assistant-head");
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "assistant-clear";
  clearBtn.title = "مسح المحادثة";
  clearBtn.setAttribute("aria-label", "مسح المحادثة");
  clearBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>';
  clearBtn.addEventListener("click", () => { clearHistory(); });
  if (headEl) {
    if (closeBtn && closeBtn.parentNode) headEl.insertBefore(clearBtn, closeBtn);
    else headEl.appendChild(clearBtn);
  }

  /* ------------------------------------------------------------
     Knowledge base — mirrored from the platform's real content.
     Subject/tool names are refreshed from the live DOM at init.
     ------------------------------------------------------------ */
  const TERMS = [
    { ar: "السرية", en: "Confidentiality", ex: "منع الكشف غير المصرّح به — وصول المعلومات لمن يُسمح لهم فقط." },
    { ar: "السلامة", en: "Integrity", ex: "ضمان عدم تغيير البيانات أو التلاعب بها إلا بشكل مصرّح به." },
    { ar: "التوافر", en: "Availability", ex: "إتاحة الأنظمة والبيانات عند الحاجة دون انقطاع." },
    { ar: "الجدار الناري", en: "Firewall", ex: "يراقب حركة الشبكة ويسمح أو يمنع الاتصالات وفق قواعد محددة." },
    { ar: "الشبكة الافتراضية الخاصة", en: "VPN", ex: "نفق مشفّر ينقل بياناتك بأمان عبر الشبكات العامة." },
    { ar: "التشفير المتماثل", en: "Symmetric Encryption", ex: "مفتاح واحد للتشفير وفكه — سريع لكن توزيع المفتاح تحدٍّ (AES)." },
    { ar: "التشفير غير المتماثل", en: "Asymmetric Encryption", ex: "مفتاح عام للتشفير وآخر خاص لفكه — أساس التوقيع الرقمي (RSA)." },
    { ar: "دالة التجزئة", en: "Hash Function", ex: "بصمة ثابتة الطول لأي مدخل ولا يمكن عكسها — مثل SHA-256." },
    { ar: "التصيّد الاحتيالي", en: "Phishing", ex: "خداع المستخدم برسائل أو مواقع مزيفة للحصول على بياناته." },
    { ar: "برمجيات الفدية", en: "Ransomware", ex: "تشفير ملفات الضحية وطلب فدية مقابل إعادتها." },
    { ar: "حقن SQL", en: "SQL Injection", ex: "إدخال استعلامات خبيثة عبر حقول الإدخال للوصول إلى قاعدة البيانات." },
    { ar: "حجب الخدمة الموزّع", en: "DDoS", ex: "إغراق الخادم بطلبات هائلة من مصادر متعددة حتى يتوقف عن الخدمة." },
    { ar: "الرجل في المنتصف", en: "Man-in-the-Middle", ex: "اعتراض الاتصال بين طرفين للتنصت أو التلاعب بالبيانات." },
    { ar: "الهندسة الاجتماعية", en: "Social Engineering", ex: "استغلال العامل البشري — الثقة أو الخوف — للحصول على معلومات." },
    { ar: "المصادقة الثنائية", en: "Two-Factor Authentication", ex: "عاملان مختلفان للتحقق — حتى لو سُرّبت كلمة المرور." },
    { ar: "الثغرة الأمنية", en: "Vulnerability", ex: "ضعف قابل للاستغلال في نظام أو تطبيق يهدد أمنه." },
    { ar: "الاستطلاع", en: "Reconnaissance", ex: "جمع معلومات عن الهدف قبل أي هجوم — أساس الاختراق الأخلاقي." },
    { ar: "برمجية خبيثة", en: "Malware", ex: "أي برنامج مصمم لإلحاق الضرر: فيروسات، طروادة، تجسس، وفدية." }
  ];

  /** Subject anchors resolved from the live subject cards. @type {Array<{name:string,key:string}>} */
  let subjects = [];
  /** Tool titles resolved from the live tool cards. @type {string[]} */
  let toolNames = [];

  function readPlatformDom() {
    try {
      subjects = Array.prototype.map.call(document.querySelectorAll("[data-quiz-jump]"), (a) => {
        const card = a.closest("article, .subject-card, .card");
        const h = card ? card.querySelector("h3") : null;
        return { key: a.getAttribute("data-quiz-jump"), name: h ? h.textContent.trim() : a.getAttribute("data-quiz-jump") };
      });
      toolNames = Array.prototype.map.call(
        document.querySelectorAll(".tool-card .tool-title"), (h) => h.textContent.trim());
    } catch {}
  }

  /** Best-saved quiz results from the quiz engine's store (global var). @returns {Object} */
  function readQuizResults() {
    try { return (window.quizCache && window.quizCache.results) || {}; } catch { return {}; }
  }

  /* ------------------------------------------------------------
     Local knowledge engine — pure function: question → answer.
     ------------------------------------------------------------ */
  function localAnswer(raw) {
    const q = String(raw).trim().toLowerCase();
    const has = (...ws) => ws.some((w) => q.indexOf(w) !== -1);

    /* Greetings */
    if (/^(السلام|سلام|مرحبا|اهلا|أهلا|هاي|هلا|hi|hello)/.test(q)) {
      return "أهلاً بك 👋 أنا **مساعد المنصة** — أساعدك في المواد، الاختبارات، البطاقات التعليمية، الأدوات الأمنية، ومختبر الاستجابة للحوادث. اسألني مثلًا: «كيف أبدأ اختبار شبكات؟» أو «اشرح لي الجدار الناري».";
    }

    /* How to use the platform / where to start */
    if (has("كيف استخدم", "كيف أستخدم", "من اين البدا", "من أين أبدأ", "وش اسوي", "ايش اسوي", "طريقة استخدام", "البداية")) {
      return "رحلتك المقترحة في المنصة:\n1) **المواد الدراسية** (#subjects) — اختر مادتك.\n2) **الاختبارات** (#quiz) — حل بنك الأسئلة بنتائج فورية وشرح لكل سؤال.\n3) **البطاقات التعليمية** (#flash) — راجع المصطلحات بسرعة.\n4) **الأدوات الأمنية** (#tools) — طبّق عمليًا (SHA-256، Caesar، JWT، CIDR…).\n5) **مختبر الاستجابة للحوادث و CTF** (#games) — طبّق ما تعلمته في سيناريو واقعي.\n6) راجع أدائك وأعد اختبار المادة الأقل حفظًا.";
    }

        /* Quiz usage & scoring (route on score/percentage/result words too,
       not only the literal "اختبار", so "كيف تُحسب النتيقة؟" is caught). */
    if (has("اختبار", "اختبارات", "quiz", "بنك الاسئلة", "بنك الأسئلة",
            "نتيقة", "نتيجة", "تُحسب", "احسب", "درجة", "نسبة", "نسبه")) {
      if (has("نتيقة", "نتيجة", "يحسب", "تُحسب", "احسب", "حساب", "الدرجة", "تصحيح", "score", "نسبه", "نسبة", "نسبتي", "أفضل")) {
        return "حساب نتائج الاختبار:\n• كل سؤال صحيح = درجة واحدة (لا خصم على الخطأ).\n• النسبة = (الإجابات الصحيحة ÷ عدد الأسئلة) × 100.\n• **أفضل نتيجة** تُحفظ تلقائيًا في متصفحك لكل مادة.\n• في **الوضع المؤقّت** (اختياري، 30 ثانية للسؤال) انتهاء الوقت يُحسب إجابة خاطئة.\n• شاشة النتيجة تعرض تفصيلًا: صحيحة / خاطئة / انتهى وقتها.";
      }
      if (has("ابدا", "أبدأ", "ابدأ", "افتح", "كيف", "طريقة", "استكمال", "استئناف")) {
        return "لبدء اختبار:\n1) انتقل إلى قسم **الاختبارات** (#quiz).\n2) اختر المادة من الأزرار — إن أوقفت محاولة سابقة سيظهر زر **استكمال**.\n3) فعّل **الوضع المؤقّت** من المفتاح إن أردت محاكاة ضغط الوقت (30 ثانية/سؤال).\n4) بعد كل سؤال يظهر الشرح فورًا، وفي النهاية النتيجة والتفصيل وزر **إعادة الاختبار**.";
      }
      return "قسم الاختبارات (#quiz) يوفر بنك أسئلة لكل مادة مع شرح فوري لكل إجابة، وضع مؤقّت اختياري، حفظ تلقائي لأفضل نتيجة، وإمكانية استكمال المحاولة. أشرح لك حساب النتائج أو طريقة البدء؟";
    }

    /* Subject lookup */
    for (const s of subjects) {
      if (s.name && s.name.length > 2 && q.indexOf(s.name.toLowerCase()) !== -1) {
        return "مادة **" + s.name + "** موجودة في قسم **المواد الدراسية** (#subjects) — ستجد فيها زر «بنك الأسئلة» في بطاقة المادة (ينقلك لاختبارها مباشرة). التجميعات والملخصات قيد الإعداد وستُضاف لاحقًا.";
      }
    }
    /* Study recommendation — grounded in the user's saved results.
       (Before the generic "مواد" branch so "أي مادة أدرس؟" routes here.) */
    if (has("اقترح", "التالي", "ادرس", "أدرس", "مراجعة", "ضعيف", "انهي", "أي مادة")) {
      const res = readQuizResults();
      const keys = Object.keys(res);
      if (!keys.length) return "لم تحل أي اختبار بعد — أفضل بداية: افتح **الاختبارات** (#quiz)، اختر مادة، وحل بنك أسئلتها. النتيجة ستخبرك أين تحتاج مراجعة، ثم استخدم البطاقات لتثبيت المصطلحات.";
      let worst = null;
      keys.forEach((k) => { if (!worst || res[k].pct < res[worst].pct) worst = k; });
      return "حسب نتائجك المحفوظة: أدنى نسبة لديك **" + res[worst].pct + "%** في «" + worst + "». اقتراحي: راجع أسئلة تلك المادة (الشرح يظهر بعد كل سؤال)، وأعد الاختبار حتى تتجاوز 80%، ثم انتقل للمادة التالية. نتائجك الأفضل ظاهرة في شاشة اختيار المادة.";
    }

    if (has("مواد", "مادة", "مقرر", "ترم")) {
      const names = subjects.map((s) => s.name).filter(Boolean).join("، ") || "المواد الست للترم";
      return "مواد الترم الثاني المتوفرة: " + names + ". كل بطاقة تحتوي زر «بنك الأسئلة» للانتقال لاختبار المادة مباشرة، وسيُضاف التجميعات والملخصات قريبًا.";
    }

    /* Tools */
    if (has("اداة", "أداة", "ادوات", "أدوات", "tool")) {
      for (const t of toolNames) {
        if (t.length > 2 && q.indexOf(t.toLowerCase()) !== -1) {
          return "أداة **" + t + "** متاحة في قسم الأدوات (#tools) — تعمل بالكامل داخل متصفحك ولا تُرسل بياناتك لأي خادم. افتح القسم، أدخل النص/القيمة، وستظهر النتيجة فورًا مع زر نسخ.";
        }
      }
      const list = toolNames.join("، ") || "SHA-256، Caesar، JWT، CIDR";
      if (has("sha", "بصمة", "هاش", "hash")) return "مولّد **SHA-256** (#tools): اكتب أي نص وستحصل على بصمة ثابتة الطول (256 بت) مع شبكة بصرية وزر نسخ. تغيير حرف واحد يغيّر البصمة كليًا — هذا مبدأ دوال التجزئة.";
      if (has("jwt", "توكن", "token")) return "محلّل **JWT** (#tools): الصق الرمز ليُفكّ الترويسة (Header) والحمولة (Payload) والتوقيع مع تحذير إن كان منتهيًا. تذكّر: فك JWT ليس تحققًا من التوقيع.";
      if (has("cidr", "شبكات", "subnet", "قناع")) return "حاسبة **CIDR** (#tools): أدخل العنوان مع القناع (مثل 192.168.1.0/24) لتعرف نطاق الشبكة والبث وعدد الأجهزة الممكنة.";
      if (has("caesar", "قيصر")) return "أداة **Caesar** (#tools): شفرة الإزاحة الكلاسيكية تدعم العربية واللاتينية — حرّك المؤشر لتغيير الإزاحة وانسخ النتيجة.";
      if (has("base64", "hex", "url")) return "الأدوات المتوفرة حاليًا: " + list + ". أدوات Base64/Hex/URL قد تُضاف لاحقًا — اقترحها من قسم التواصل (#contact).";
      return "الأدوات المتوفرة (" + toolNames.length + "): " + list + ". جميعها تعمل داخل متصفحك. أي أداة تريد شرحها؟";
    }

    /* Term explanations (before the flashcards branch so
       "اشرح مصطلح الجدار الناري" explains the term itself). */
    for (const t of TERMS) {
      const en = t.en.toLowerCase();
      if (q.indexOf(t.ar) !== -1 || (en.length > 2 && q.indexOf(en) !== -1)) {
        return "**" + t.ar + "** (" + t.en + "):\n" + t.ex + "\nراجعها في البطاقات التعليمية (#flash) بالبحث عن اسمها.";
      }
    }

    /* Flashcards */
    if (has("بطاق", "فلاش", "flashcard", "مصطلح")) {
      return "البطاقات التعليمية (#flash) تضم 18 مصطلحًا أمنيًا ثنائي اللغة: اضغط البطاقة لقلبها وترى المصطلح بالإنجليزية مع شرح موجز، مع بحث وخلط. اطلب مني شرح أي مصطلح أيضًا — مثل «اشرح الجدار الناري».";
    }

    /* CTF / Incident response */
    if (has("ctf", "حادث", "حوادث", "عَلَم", "فلاغ", "flag", "لعبة", "تحدي", "طرفية")) {
      return "مختبر **الاستجابة للحوادث و CTF** (#games): تتلقى تنبيهات هجمات (حقن SQL، فحص منافذ، DDoS، شفرة Caesar) وتتعامل معها عبر طرفية أوامر — حلّل (scan/status)، خفّف (block/ratelimit)، ثم استخرج العَلَم بأمر flag. اكتب help داخل الطرفية للأوامر، و hint للتلميح. إنجاز كل سيناريو يُحفظ تلقائيًا.";
    }

    /* Troubleshooting */
    if (has("مشكلة", "لا يعمل", "لا تظهر", "خطا", "خطأ", "بطيء", "offline", "بدون اتصال", "حفظ", "localStorage", "اختفى")) {
      return "حلول سريعة للمشكلات الشائعة:\n• **بيانات المواد لا تظهر**: حدّث الصفحة — تُحمّل من الشبكة أول مرة ثم تُخزَّن للعمل دون اتصال.\n• **النتائج/التقدم اختفى**: محفوظة في متصفحك فقط (IndexedDB) — لا تحذف بيانات الموقع من إعدادات المتصفح.\n• **العمل دون اتصال**: مدعوم — بعد أول زيارة تُخزَّن المنصة كاملة (PWA).\n• **الوضع المؤقّت**: يُفعّل من المفتاح في شاشة اختيار الاختبار.\nإذا استمرت المشكلة راسلنا من قسم التواصل (#contact).";
    }

    /* Contact */
    if (has("تواصل", "اقتراح", "مساهمة", "بريد", "email", "gmail")) {
      return "نسعد بمساهماتك! استخدم نموذج **التواصل** (#contact) — اختر نوع الرسالة (سؤال، اقتراح، تلخيص مادة، تصحيح خطأ) وأرسلها، أو راسلنا مباشرة: motmi757@gmail.com";
    }

    /* Fallback — stay honest about scope */
    return "أساعدك في: المواد الدراسية وبنوك الأسئلة، طريقة الاختبارات وحساب النتائج، شرح المصطلحات الأمنية، الأدوات التفاعلية، مختبر الاستجابة للحوادث/CTF، والتنقل في المنصة. جرّب: «كيف أبدأ اختبار؟» أو «اشرح التصيّد الاحتيالي».";
  }

  /* ------------------------------------------------------------
     Optional LLM backend — provider-agnostic, key never in front.
     ------------------------------------------------------------ */
  /**
   * Ask the configured endpoint (if any). Resolves null when absent/failed.
   * @param {string} question @param {Array<{role:string,content:string}>} history
   * @returns {Promise<string|null>}
   */
  async function askEndpoint(question, history) {
    if (!ENDPOINT) return null;
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-8).concat([{ role: "user", content: question }]),
          locale: document.documentElement.lang || "ar"
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      const reply = typeof data === "string" ? data : (data.reply || data.answer || data.message);
      return (typeof reply === "string" && reply.trim()) ? reply.trim() : null;
    } catch { return null; }
  }

  /* ------------------------------------------------------------
     Rendering & wiring
     ------------------------------------------------------------ */
  const CHIPS = [
    "كيف أستخدم المنصة؟",
    "كيف أبدأ اختبار؟",
    "كيف تُحسب النتيجة؟",
    "اشرح لي الجدار الناري",
    "ما الأدوات المتوفرة؟",
    "ماذا يوجد في مختبر CTF؟"
  ];

  /** Markdown-lite: fenced ```code``` blocks, inline `code`, **bold**,
      newlines, (#anchor) -> in-page links. Fenced code is captured verbatim
      first (kept opaque); the non-code text is then HTML-escaped (XSS-safe). */
  function mdLite(text) {
    const blocks = [];
    const stripped = String(text).replace(/```(?:\w+)?(\n)?([\s\S]*?)```/g, (_m, _nl, code) => {
      blocks.push('<pre class="a-code"><code>' + code + '</code></pre>');
      return "\u0000" + (blocks.length - 1) + "\u0000";
    });
    let h = esc(stripped)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\(#([a-zA-Z]+)\)/g, '<a href="#$1">اذهب</a>')
      .replace(/\n/g, "<br>");
    return h.replace(/\u0000(\d+)\u0000/g, (_m, i) => blocks[+i]);
  }

  function bubble(role, html) {
    const b = document.createElement("div");
    b.className = "a-msg a-" + role;
    const p = document.createElement("p");
    p.innerHTML = html;
    b.appendChild(p);
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function typing() {
    const b = bubble("bot", '<span class="a-typing" role="status"><span class="a-typing-label">يكتب…</span><i></i><i></i><i></i></span>');
    return b;
  }

  /* ---- Chat persistence (last MAX_MSGS messages, localStorage) ---- */
  function loadHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      if (!Array.isArray(arr)) return [];
      return arr.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"));
    } catch { return []; }
  }
  function saveHistory() {
    history = history.slice(-MAX_MSGS);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(history)); } catch {}
  }
  function clearHistory() {
    history = [];
    try { localStorage.removeItem(STORE_KEY); } catch {}
    log.innerHTML = "";
    if (panel.classList.contains("is-open")) setOpen(true); /* re-add the welcome bubble */
  }
  function renderHistory() {
    history.forEach((m) => bubble(m.role, m.role === "assistant" ? mdLite(m.content) : esc(m.content)));
    log.scrollTop = log.scrollHeight;
  }

  let busy = false;

  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true;
    input.value = "";
    bubble("user", esc(question));
    history.push({ role: "user", content: question });
    const t = typing();
    let reply = await askEndpoint(question, history);
    if (reply !== null) {
      statusEl.textContent = "متصل بمساعد ذكي";
    } else {
      /* Local grounded engine (also the automatic fallback). */
      await new Promise((r) => setTimeout(r, 350));
      reply = localAnswer(question);
    }
    history.push({ role: "assistant", content: reply });
    saveHistory();
    t.remove();
    bubble("bot", mdLite(reply));
    busy = false;
  }

  /** Open/close the panel with focus management. @param {boolean} open @returns {void} */
  function setOpen(open) {
    root.hidden = false;
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    fab.setAttribute("aria-expanded", String(open));
    fab.setAttribute("aria-label", open ? "إغلاق مساعد المنصة" : "افتح مساعد المنصة");
    if (open) {
      if (!log.children.length) {
        bubble("bot", mdLite("أهلاً! أنا **مساعد المنصة** 🤖\nاسألني عن المواد، الاختبارات، المصطلحات الأمنية، الأدوات، أو مختبر CTF — أو اختر سؤالًا من الأسفل."));
      }
      setTimeout(() => input.focus({ preventScroll: true }), 60);
    }
  }

  fab.addEventListener("click", () => setOpen(!panel.classList.contains("is-open")));
  closeBtn.addEventListener("click", () => { setOpen(false); fab.focus({ preventScroll: true }); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("is-open")) { setOpen(false); fab.focus({ preventScroll: true }); }
  });
  /* Close when clicking outside the open panel (FAB & panel live inside #assistantRoot). */
  document.addEventListener("click", (e) => {
    if (panel.classList.contains("is-open") && !root.contains(e.target)) setOpen(false);
  });

  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  CHIPS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "a-chip";
    b.textContent = c;
    b.addEventListener("click", () => ask(c));
    chipsBox.appendChild(b);
  });

  /* Draggable panel (desktop, fine-pointer only). Header drag moves the
     panel; position is session-only and stays where the user drops it. */
  if (headEl && window.matchMedia) {
    const canDrag = () => window.matchMedia("(pointer:fine) and (min-width: 769px)").matches;
    const drag = { active: false, startX: 0, startY: 0, baseLeft: 0, baseTop: 0 };
    headEl.addEventListener("dragstart", (e) => e.preventDefault());
    headEl.addEventListener("pointerdown", (e) => {
      if (!canDrag() || e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest("button")) return; /* not from buttons */
      let r = null;
      try { r = panel.getBoundingClientRect(); } catch {}
      if (!r) return;
      panel.style.position = "fixed";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = Math.round(r.left) + "px";
      panel.style.top = Math.round(r.top) + "px";
      drag.active = true; drag.startX = e.clientX; drag.startY = e.clientY;
      drag.baseLeft = r.left; drag.baseTop = r.top;
      panel.classList.add("is-dragging");
      try { headEl.setPointerCapture(e.pointerId); } catch {}
    });
    headEl.addEventListener("pointermove", (e) => {
      if (!drag.active) return;
      const pw = panel.offsetWidth || 320;
      const ph = panel.offsetHeight || 400;
      const nx = Math.max(0, Math.min(window.innerWidth - pw, drag.baseLeft + (e.clientX - drag.startX)));
      const ny = Math.max(0, Math.min(window.innerHeight - ph, drag.baseTop + (e.clientY - drag.startY)));
      panel.style.left = Math.round(nx) + "px";
      panel.style.top = Math.round(ny) + "px";
    });
    const endDrag = () => { if (drag.active) { drag.active = false; panel.classList.remove("is-dragging"); } };
    headEl.addEventListener("pointerup", endDrag);
    headEl.addEventListener("pointercancel", endDrag);
  }

  /* Resolve subject/tool names from the live DOM (grounded answers). */
  readPlatformDom();
})();
