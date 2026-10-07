/* MODULE 24 · Flashcard card bank — InfoSec term/definition pairs for the
   timed review mode (T01).

   Authoring format (extend by adding a category entry):
     "<key>": { "name": "<Arabic category title>",
                "cards": [ { "id", "term", "topic", "definition" }, ... ] }
   "term" is the acronym or term, "definition" an Arabic-first explanation.

   At load the bank is flattened into window.FLASHCARDS_TERMS — the shape
   the review engine consumes — and invalid cards are REJECTED at load:
     - a card whose term or definition is missing / whitespace-only;
     - a card whose term duplicates an already-accepted term (first
       occurrence wins, so nothing is silently overwritten).
   window.FLASHCARDS_BUILD_TERMS exposes the same validator so tests and
   future author tooling can re-run it against any catalog.
   Bundled + precached by the service worker: zero network at runtime. */

window.FLASHCARDS = {
  "crypto": {
    "name": "التشفير",
    "cards": [
      { "id": "aes-001", "term": "AES", "topic": "التشفير", "definition": "خوارزمية تشفير متماثلة (Advanced Encryption Standard) على 128 بت، بمفاتيح 128/192/256 بت؛ المعيار القياسي لتشفير البيانات الرقمية." },
      { "id": "rsa-001", "term": "RSA", "topic": "التشفير", "definition": "خوارزمية مفتاح هائل تعتمد على تعقيد ضرب الأعداد الأولية؛ تُستخدم للتوقيع الرقمي وتبادل المفاتيح الآمنة." },
      { "id": "sha-001", "term": "SHA", "topic": "التشفير", "definition": "عائلة دوال تجزئة تشفيرية (مثلاً SHA-256) تُحوّل المدخل إلى تجزئة ثابتة الطول، لا ترجع وحيدة وآمنة من التصادم؛ لتوقيع المحتوى والتحقق من السلامة." },
      { "id": "pki-001", "term": "PKI", "topic": "التشفير", "definition": "بنية مفتاح عام تُنظم الشهادات الرقمية للمصادقة والتوقيع، فتسمح بالمفاتيح السرية بدون تبادل مسبق." },
      { "id": "pbkdf-001", "term": "PBKDF2", "topic": "التشفير", "definition": "وظيفة مشتقة من التجزئة لاستخلاص مفتاح من كلمة مرور، مع ملء (salt) وعدد تكرارات تبطئ هجمات القوة الغامضة." }
    ]
  },
  "web": {
    "name": "الأمن السيبراني للويب",
    "cards": [
      { "id": "xss-001", "term": "XSS", "topic": "الويب", "definition": "ثغرة حجز/تزوير مواقع (Cross-Site Scripting): تنفيذ نصوص ضارة (جافا سكريبت) في متصفح ضحية، لسرقة الجلسات أو تنفيذ أوعمليات بين المستخدمين." },
      { "id": "csrf-001", "term": "CSRF", "topic": "الويب", "definition": "تزوير طلب من الموقع (Cross-Site Request Forgery): إجبار مستخدم مصرق على إرسال طلب خبيث إلى موقع موثوق دون علمه." },
      { "id": "sqli-001", "term": "SQLi", "topic": "الويب", "definition": "حقن طلبات SQL لاستخراج البيانات من قاعدة البيانات عبر حقول إدخال غير مهيكلة، بأوامر ضارة مدمجة." },
      { "id": "ssrf-001", "term": "SSRF", "topic": "الويب", "definition": "استغلال طلبات الخادم للموارد الداخلية (Server-Side Request Forgery): يصيب الخبيث خوادم التطبيق لضرب الشبكات الداخلية والخدمات الخفية." }
    ]
  },
  "network": {
    "name": "الشبكات",
    "cards": [
      { "id": "tcp-001", "term": "TCP", "topic": "الشبكات", "definition": "بروتوكول الاتصال بالتوصيل (Transmission Control Protocol): توصيل موثوق ومفصل، مع التأكد من وصول البيانات وترتيبها." },
      { "id": "ip-001", "term": "IP", "topic": "الشبكات", "definition": "بروتوكول الإنترنت (Internet Protocol): المسؤول عن تحديده وتسليم حزم البيانات بين العقد في الشبكة." },
      { "id": "dns-001", "term": "DNS", "topic": "الشبكات", "definition": "نظام أسماء النطاقات (Domain Name System): يحوّل الأسماء القابلة للقراءة للبشر إلى عناوين IP، أي تحويل الاسم إلى رقم." },
      { "id": "tls-001", "term": "TLS", "topic": "الشبكات", "definition": "طبقة ربط المواقع (Transport Layer Security): تُورّد التشفير والتوثيق والتكامل للبيانات على الشبكة لنقل آمن." }
    ]
  },
  "malware": {
    "name": "البرمجيات الخبيثة",
    "cards": [
      { "id": "virus-001", "term": "فيروس", "topic": "البرمجيات الخبيثة", "definition": "برمجيات تُنفذ كرمز مستقل ترفق بنفسه بملف سليم، وتنفذ عند تشغيله مع الملف المصاب." },
      { "id": "worm-001", "term": "دودة", "topic": "البرمجيات الخبيثة", "definition": "برمجية مستقل تنتشر عبر الشبكة بذاتها، دون الحاجة لملف مضيف أو تفاعل المستخدم." },
      { "id": "trojan-001", "term": "ختر", "topic": "البرمجيات الخبيثة", "definition": "برمجية يزيّف نفسه كأداة أو برنامج مشروع لخداع المستخدم، ثم ينفذ إجراءات سرية خلف كذبه." },
      { "id": "ransom-001", "term": "فدية", "topic": "البرمجيات الخبيثة", "definition": "برمجية تشفّر ملفات الضحية وتطالب بدفع فدية (غالباً في عملة رقمية) لفك التشفير، دون ضمان إتمام الفك." }
    ]
  },
  "social": {
    "name": "هندسة اجتماعية",
    "cards": [
      { "id": "phishing-001", "term": "phishing", "topic": "هندسة اجتماعية", "definition": "محاولة إقناع ضحية بقدام البيانات أو الملفات أو التمعن في روابط ضارة، عبر بريد أو رسالة تبدو مشروعة." },
      { "id": "pretexting-001", "term": "pretexting", "topic": "هندسة اجتماعية", "definition": "إقناع ضحية من خلال سرد قصة مصدقة (pretend) وتجميع معلومات سرية عبر محادثة موجهة." },
      { "id": "baiting-001", "term": "baiting", "topic": "هندسة اجتماعية", "definition": "إغراء ضحية بشيء جذاب (مثلاً وسائط تخزين خبيثة)، لتركيب برمجية خبيث أو تسريب بيانات." },
      { "id": "tailgating-001", "term": "tailgating", "topic": "هندسة اجتماعية", "definition": "دخول غير مرخّص لمبنى عن طريق متابعة موظف شرعي، أو طلب التحمل لفتح الباب." }
    ]
  },
  "access": {
    "name": "المصادقة والوصول",
    "cards": [
      { "id": "mfa-001", "term": "MFA", "topic": "المصادقة والوصول", "definition": "المصادقة المتعددة العوامل (Multi-Factor Authentication): مصادقة بخلط من طرق (شيء تعرفه، شيء تملكه، شيء أنت) لتعزيز الأمان." },
      { "id": "credential-001", "term": "credential", "topic": "المصادقة والوصول", "definition": "أدلة التحقق: كلمة مرور، مفتاح، بصمة، أو رمز مصادقة تثبت هوية المستخدم." },
      { "id": "session-001", "term": "session", "topic": "المصادقة والوصول", "definition": "جلسة نشطة تربط المستخدم بالخدمة خلالها تتم المعاملات، ويحمي معرف الجلسة (session id)." },
      { "id": "sso-001", "term": "SSO", "topic": "المصادقة والوصول", "definition": "ابدأ واحد (Single Sign-On): تسجيل دخول واحد يسمح بالوصول إلى عدة خدمات دون تسجيل دخول متكرر، بأذونات صريحة." }
    ]
  }
};

/* T01 · validation at load — build the flat terms list the review engine
   consumes, rejecting empty values and duplicate terms (see header). */
(function buildFlashcardTerms() {
  "use strict";
  /** Validate + flatten a keyed catalog. @param {object} bank @returns {Array<{id:string,term:string,topic:string,category:string,definition:string}>} */
  function buildTerms(bank) {
    var seen = Object.create(null);
    var terms = [];
    if (!bank || typeof bank !== "object") return terms;
    Object.keys(bank).forEach(function (key) {
      var cat = bank[key];
      if (!cat || !Array.isArray(cat.cards)) return;
      cat.cards.forEach(function (card) {
        if (!card || typeof card.term !== "string" || typeof card.definition !== "string") return;
        var term = card.term.trim();
        var definition = card.definition.trim();
        if (!term || !definition) return;   /* reject empty / whitespace-only values */
        if (seen[term]) return;             /* reject duplicate terms (first wins) */
        seen[term] = true;
        terms.push({
          id: card.id,
          term: term,
          topic: card.topic || cat.name || "",
          category: key,
          definition: definition
        });
      });
    });
    return terms;
  }
  window.FLASHCARDS_BUILD_TERMS = buildTerms;
  window.FLASHCARDS_TERMS = buildTerms(window.FLASHCARDS);
})();
