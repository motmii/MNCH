# مساعد المنصة — دليل الربط والتشغيل

مساعد ذكي عربي أولًا مدمج في المنصة، يعمل من دون أي مفاتيح API في الواجهة.

## كيف يعمل (المعمارية)

```
[ المتصفح — assistant.js ]
   ├── 1) إن وُجد endpoint مُعدّ: POST { messages, locale } → /api/chat
   │      (أي خادم/Worker يحتفظ بمفتاح المزود في الخادم فقط)
   │      الرد المتوقع: { "reply": "نص الإجابة" }
   └── 2) عند غياب الـ endpoint أو فشله: محرك معرفة محلي
          يجيب من محتوى المنصة نفسه (مواد، قواعد الاختبارات،
          الأدوات، مصطلحات البطاقات، مختبر CTF، استكشاف الأخطاء)
```

- المحرك المحلي يعمل **دون اتصال** ويُخزَّن مع المنصة عبر Service Worker.
- لا يتم إرسال أي بيانات خارج المتصفح إلا إذا فعّلت endpoint يدويًا.

## التفعيل بدون backend (الافتراضي)

لا شيء مطلوب. المساعد يعمل فورًا بالمحرك المحلي.

## التفعيل مع LLM حقيقي (اختياري، آمن)

1. انشر وسيطًا (proxy) يحمل المفتاح في الخادم — مثل Cloudflare Worker:

```js
// مثال توضيحي — لا تضع المفتاح في أي ملف أمامي
export default {
  async fetch(req, env) {
    const { messages = [], locale = "ar" } = await req.json();
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.LLM_KEY}`, // سر خادم فقط
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content:
          "أنت «مساعد المنصة» لمنصة أمن المعلومات. أجب بالعربية اعتمادًا على محتوى المنصة فقط (مواد، اختبارات، أدوات، بطاقات، CTF)، ولا تخترع معلومات غير موجودة." },
          ...messages]
      })
    });
    const d = await r.json();
    return Response.json({ reply: d.choices?.[0]?.message?.content ?? "" });
  }
};
```

2. في `index.html` قبل تحميل `assistant.js` أضف:

```html
<script>window.PLATFORM_AI = { endpoint: "/api/chat" };</script>
```

(وجّه `/api/chat` إلى الوسيط عبر `_redirects` في Netlify/Cloudflare Pages، أو ضع رابط Worker كاملًا.)

## الخصوصية

- المحادثة لا تُخزَّن في أي مكان (ذاكرة الصفحة فقط).
- عند التشغيل المحلي: كل شيء داخل المتصفح.
- عند ربط endpoint: تُرسل رسائل المحادثة فقط (آخر 8 رسائل) إلى وسيطك أنت.

## ملفات الميزة

| ملف | الدور |
|---|---|
| `assistant.js` | MODULE 33 — المحرك المحلي + الواجهة + تجريد المزود |
| `index.html` | علامات الواجهة (FAB + لوحة المحادثة) قبل تذييل الصفحة |
| `style.css` | طبقة v9 — تنسيقات المساعد (RTL آمنة، reduced-motion) |
| `sw.js` | تخزين `assistant.js` مسبقًا (v1.5.0) |
