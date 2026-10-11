/* ============================================================
   Threat Theatre — interactive branching security scenarios
   Single source of truth for MODULE 78 (script.js · initThreatTheatre).

   Each scenario is a decision tree the learner walks node by node.
   Every node offers 2–4 choices; each choice has an immediate bilingual
   outcome (good / risky / bad) + an educational explanation. Nothing
   here acts, touches the network, or stores secrets — purely didactic.

   Contract (mirrors data/flashcards.js): authors append scenarios (no
   build); every string is bilingual {ar,en}; the engine VALIDATES at
   load (a node with no choice, a choice with no outcome/why, or a
   dangling `next` is dropped). `next` points to another node id in the
   SAME scenario; an end node has `next:null`.
   ============================================================ */
(function () {
  "use strict";

  var SCENARIOS = [];

  SCENARIOS.push({
    id: "phish-email",
    topic: { ar: "هندسة اجتماعية", en: "Social Engineering" },
    title: { ar: "رسالة تصيّد في بريد الجامعة", en: "A phishing email in your university inbox" },
    intro: {
      ar: "يظهر في بريدك الجامعي ما يبدو أنه من «الدعم الفني» يطلب تأكيد كلمة المرور فورًا وإلا عُطّل حسابك. اقرأ بهدوء واختر تصرّفك.",
      en: "An email that looks like it is from “IT Support” demands you confirm your password immediately or your account will be disabled. Read calmly and choose what you do."
    },
    start: "s1",
    nodes: {
      s1: {
        text: {
          ar: "الرسالة عاجلة، وعنوان المُرسِل يبدو رسميًا، ورابط «تحديث كلمة المرور» يطلب بياناتك.",
          en: "The message is urgent, the sender looks official, and an “update your password” link asks for your details."
        },
        choices: [
          {
            id: "verify",
            label: { ar: "أتأكد من المُرسِل عبر القناة الرسمية قبل أي نقرة", en: "Verify the sender via the official channel before clicking" },
            outcome: "good",
            why: {
              ar: "ممتاز — لا تثق بعنوان المُرسِل وحده. الجهات الرسمية لا تطلب كلمة مرورك أبدًا عبر رابط في رسالة.",
              en: "Excellent — never trust the sender address alone. Official bodies never ask for your password via a link in a message."
            },
            next: "s2"
          },
          {
            id: "click",
            label: { ar: "أنقر الرابط وأدخل كلمة المرور بسرعة قبل التعطيل", en: "Click the link and enter the password before it is disabled" },
            outcome: "bad",
            why: {
              ar: "خطر شديد — هذا بالضبط ما يبتزّه المهاجم: العجلة والتهديد. بياناتك ستُسرّب لصفحة مزيّفة.",
              en: "Serious risk — this is exactly what the attacker preys on: urgency and threat. Your credentials would be harvested by a fake page."
            },
            next: "s3"
          },
          {
            id: "reply",
            label: { ar: "أرد على الرسالة وأسأل إن كانت حقيقية", en: "Reply to the email and ask if it is genuine" },
            outcome: "risky",
            why: {
              ar: "حذار — الرد يؤكّد للمهاجم أن بريدك نشِط ويستقبل، فيزيد استهدافك. تواصل عبر قناة تعرفها أنت.",
              en: "Careful — replying confirms to the attacker that your mailbox is live, increasing targeting. Reach out via a channel you know."
            },
            next: "s4"
          }
        ]
      },
      s2: {
        text: {
          ar: "تواصلت مع الدعم الفني عبر رقم المنصة الرسمي، فأكّدوا أنهم لم يُرسلوا شيئًا.",
          en: "You contacted IT via the official platform number and they confirmed they sent nothing."
        },
        choices: [
          {
            id: "report",
            label: { ar: "أبلّغ عن الرسالة كتصيّد ثم أحذفها", en: "Report the message as phishing, then delete it" },
            outcome: "good",
            why: {
              ar: "قرار سليم — الإبلاغ يحمي بقية الطلاب ويُدرّب مرشحات الحماية على هذا النمط.",
              en: "A sound decision — reporting protects other students and trains the filters against this pattern."
            },
            next: null
          }
        ]
      },
      s3: {
        text: {
          ar: "الصفحة التي فتحتها كانت مزيّفة وأرسلت كلمة مرورك إلى المهاجم.",
          en: "The page you opened was fake and sent your password to the attacker."
        },
        choices: [
          {
            id: "rotate",
            label: { ar: "أغيّر كلمة المرور فورًا من الجهاز الرسمي وأفعّل التحقق بخطوتين", en: "Change the password immediately from the official device and enable 2FA" },
            outcome: "good",
            why: {
              ar: "إجراء تصحيح صحيح — تغيير كلمة المرور وتفعيل المصادقة المتعددة يقطع استغلال المهاجم.",
              en: "A correct recovery step — rotating the password and enabling MFA cuts off the attacker's access."
            },
            next: null
          },
          {
            id: "ignore",
            label: { ar: "أتظاهر أنه لم يحدث وأتابع يومي", en: "Pretend it did not happen and carry on" },
            outcome: "bad",
            why: {
              ar: "خطأ — كلمة مرورك في يد المهاجم؛ كل دقيقة تأخير تُوسّع الاختراق. غيّرها الآن.",
              en: "Wrong — your password is in the attacker's hands; every minute of delay widens the breach. Change it now."
            },
            next: null
          }
        ]
      },
      s4: {
        text: {
          ar: "بقي لديك شكّ في كون الرسالة خطيرة على الآخرين.",
          en: "You are still unsure whether the message endangers others."
        },
        choices: [
          {
            id: "report2",
            label: { ar: "أبلّغ عنها للدعم الفني دون الرد على المُرسِل", en: "Report it to IT without replying to the sender" },
            outcome: "good",
            why: {
              ar: "صحيح — الإبلاغ قناة آمنة تحمي حسابك وتحذّر المجتمع في الوقت نفسه.",
              en: "Correct — reporting is a safe channel that protects your account and warns the community at once."
            },
            next: null
          }
        ]
      }
    }
  });

  SCENARIOS.push({
    id: "public-wifi",
    topic: { ar: "أمن الشبكات", en: "Network Security" },
    title: { ar: "شبكة واي فاي عامة في المقهى", en: "Public Wi-Fi at a café" },
    intro: {
      ar: "أنت في مقهى وتحتاج تسجيل دخول سريع. أمامك شبكتان: إحداهما مفتوحة بلا كلمة مرور، والأخرى تحمل اسم المكان بالحرف.",
      en: "You are at a café and need a quick login. Two networks appear: one open with no password, the other bearing the café's exact name."
    },
    start: "w1",
    nodes: {
      w1: {
        text: {
          ar: "تحتاج إرسال مستند جامعي مهم الآن من هذه الشبكة.",
          en: "You need to send an important university document from this network right now."
        },
        choices: [
          {
            id: "vpn",
            label: { ar: "أستخدم شبكة جوالي أو VPN موثوق قبل الإرسال", en: "Use my mobile data or a trusted VPN before sending" },
            outcome: "good",
            why: {
              ar: "حكيم — الشبكات العامة بلا تشفير تتيح اعتراض البيانات؛ النفق المشفّر يحمي محتواك.",
              en: "Wise — unencrypted public networks allow interception; an encrypted tunnel protects your traffic."
            },
            next: "w2"
          },
          {
            id: "open",
            label: { ar: "أتصل بالشبكة المفتوحة وأرسل مباشرة", en: "Connect to the open network and send directly" },
            outcome: "risky",
            why: {
              ar: "خطر — أي شخص على الشبكة قد يراقب حركة بياناتك إن لم تكن مشفّرة من طرف إلى طرف.",
              en: "Risky — anyone on the network may observe your traffic if it is not end-to-end encrypted."
            },
            next: "w3"
          },
          {
            id: "evil",
            label: { ar: "أتصل بالشبكة التي تحمل اسم المقهى وأدخل بريدي", en: "Join the network bearing the café's name and log in with my email" },
            outcome: "bad",
            why: {
              ar: "خطر شديد — قد تكون شبكة «التوأم الشرير» التي ينسخها المهاجم لسرقة بيانات الدخول.",
              en: "Serious risk — it could be an “evil twin” the attacker clones to steal your credentials."
            },
            next: "w3"
          }
        ]
      },
      w2: {
        text: {
          ar: "أُرسل المستند عبر نفق مشفّر بأمان.",
          en: "You sent the document safely through an encrypted tunnel."
        },
        choices: [
          {
            id: "done",
            label: { ar: "أنهي المهمة وأفصل الاتصال عند عدم الحاجة", en: "Finish the task and disconnect when done" },
            outcome: "good",
            why: {
              ar: "ممارسة نظيفة — أقل وقت اتصال يعني أقل سطح للتعرض.",
              en: "Clean practice — less time connected means a smaller exposure surface."
            },
            next: null
          }
        ]
      },
      w3: {
        text: {
          ar: "شككتَ أن الشبكة غير آمنة أثناء إرسال بيانات حسّاسة.",
          en: "You suspect the network is unsafe while sending sensitive data."
        },
        choices: [
          {
            id: "stop",
            label: { ar: "أتوقّف، أفصل، وأعيد المهمة لاحقًا من شبكة موثوقة", en: "Stop, disconnect, and redo the task later on a trusted network" },
            outcome: "good",
            why: {
              ar: "قرار صحيح — إيقاف التسريب المبكر أفضل من إكمال مهمة على قناة مشتبه بها.",
              en: "A correct call — stopping an early leak beats finishing a task on a suspect channel."
            },
            next: null
          }
        ]
      }
    }
  });

  SCENARIOS.push({
    id: "usb-bait",
    topic: { ar: "برمجيات خبيثة", en: "Malware" },
    title: { ar: "ذاكرة USB مجهولة في قاعة المحاضرات", en: "An unknown USB drive in the lecture hall" },
    intro: {
      ar: "تجد ذاكرة USB ملقاة في القاعة، وعليها اسم ملفّ يثير فضولك: «رواتب الجامعة 2026».",
      en: "You find a USB stick on the floor, labelled with a tempting filename: “University Salaries 2026”."
    },
    start: "u1",
    nodes: {
      u1: {
        text: {
          ar: "الفضول يدفعك لمعرفة ما داخلها، لكنها جهاز مجهول.",
          en: "Curiosity pulls you to see what is inside, but it is an unknown device."
        },
        choices: [
          {
            id: "hand",
            label: { ar: "أسلّمها للأمن أو أستاذ المادة دون توصيلها", en: "Hand it to security or the lecturer without plugging it in" },
            outcome: "good",
            why: {
              ar: "ممتاز — هذا نمط «الإغراء» (baiting): توصيل جهاز مجهول قد يثبّت برمجية خبيثة فورًا.",
              en: "Excellent — this is classic “baiting”: plugging in an unknown device can install malware instantly."
            },
            next: "u2"
          },
          {
            id: "plug",
            label: { ar: "أوصلها بجهازي لأفحص المحتوى", en: "Plug it into my device to inspect the contents" },
            outcome: "bad",
            why: {
              ar: "خطر شديد — قد تعمل تلقائيًا برمجية خبيثة أو تسرق بياناتك بمجرد التوصيل.",
              en: "Serious risk — malware may auto-run or exfiltrate your data the moment you connect."
            },
            next: "u3"
          },
          {
            id: "lab",
            label: { ar: "أوصلها في جهاز معزول للمعمل فقط", en: "Plug it into an isolated lab machine only" },
            outcome: "risky",
            why: {
              ar: "أفضل، لكن الأفضل أصلًا عدم التوصيل والتسليم لخبير. العزل يقلّل الخطر لا يلغيه.",
              en: "Better, but ideally do not connect at all and hand it to an expert. Isolation reduces, not removes, risk."
            },
            next: "u3"
          }
        ]
      },
      u2: {
        text: {
          ar: "سلّمتها بأمان وتجنّبتَ أي خطر على جهازك.",
          en: "You handed it over safely and avoided any risk to your device."
        },
        choices: [
          {
            id: "end",
            label: { ar: "أنهي الموقف بسلوة", en: "Close out the situation calmly" },
            outcome: "good",
            why: {
              ar: "تصرّف مسؤول — الفضول لا يسبق الأمان أبدًا.",
              en: "Responsible — curiosity never outranks security."
            },
            next: null
          }
        ]
      },
      u3: {
        text: {
          ar: "لم تتوصّل بعد، لكنك ما زلت متردّدًا.",
          en: "You have not connected yet, but you are still hesitating."
        },
        choices: [
          {
            id: "back",
            label: { ar: "أتراجع وأسلّمها لخبير", en: "Back off and hand it to an expert" },
            outcome: "good",
            why: {
              ar: "قرار صحيح — الفحص الآمن يحتاج بيئة معزولة وخبرة، لا فضولًا عاديًا.",
              en: "A correct call — safe inspection needs an isolated environment and expertise, not ordinary curiosity."
            },
            next: null
          }
        ]
      }
    }
  });

  SCENARIOS.push({
    id: "weak-password",
    topic: { ar: "المصادقة والوصول", en: "Authentication & Access" },
    title: { ar: "كلمة مرور واحدة لكل الحسابات", en: "One password for every account" },
    intro: {
      ar: "تستخدم كلمة مرور واحدة سهلة التذكّر لجميع حساباتك: البريد الجامعي، والمتجر، والشبكات الاجتماعية.",
      en: "You use one easy-to-remember password across all accounts: university email, a shop, and social media."
    },
    start: "p1",
    nodes: {
      p1: {
        text: {
          ar: "سمعتَ أن أحد المتاجر التي سجّلت فيها تعرّض لاختراق وسرقة بيانات.",
          en: "You hear that a shop you signed up with suffered a breach and data theft."
        },
        choices: [
          {
            id: "unique",
            label: { ar: "أستخدم كلمات مرور فريدة ومدير كلمات مرور", en: "Use unique passwords and a password manager" },
            outcome: "good",
            why: {
              ar: "صحيح — كلمة مرور فريدة تمنع «حشو بيانات الاعتماد» (credential stuffing) عبر المواقع.",
              en: "Correct — unique passwords stop credential-stuffing across sites."
            },
            next: "p2"
          },
          {
            id: "reuse",
            label: { ar: "أُعيد استخدام كلمة المرور مع تغيير بسيط (إضافة رقم)", en: "Reuse the password with a tiny tweak (add a digit)" },
            outcome: "risky",
            why: {
              ar: "غير كافٍ — المهاجمون يولّدون تلقائيًا تنويعات معروفة؛ التغيير الطفيف يُخترق بسهولة.",
              en: "Not enough — attackers auto-generate known variations; a tiny tweak is easily cracked."
            },
            next: "p3"
          },
          {
            id: "wait",
            label: { ar: "أنتظر حتى يخترق أحد حساباتي فعليًا", en: "Wait until one of my accounts is actually breached" },
            outcome: "bad",
            why: {
              ar: "خطأ — كلمة مرور مشتركة تعني أن اختراقًا واحدًا = اختراقًا للكل. التصرّف الاستباقي أأمن.",
              en: "Wrong — a shared password means one breach equals a breach of everything. Acting early is safer."
            },
            next: "p3"
          }
        ]
      },
      p2: {
        text: {
          ar: "بنيتَ كلمات مرور قوية وفريدة، وفعّلتَ التحقق بخطوتين حيث أمكن.",
          en: "You built strong unique passwords and enabled 2FA where available."
        },
        choices: [
          {
            id: "mfa",
            label: { ar: "أفعّل التحقق بخطوتين على البريد الجامعي أولًا", en: "Enable 2FA on the university email first" },
            outcome: "good",
            why: {
              ar: "أفضل ترتيب — بريدك الجامعي هو مفتاح استعادة بقية حساباتك، فحمايته أولوية.",
              en: "Best order — your university email is the recovery key for everything else, so protect it first."
            },
            next: null
          }
        ]
      },
      p3: {
        text: {
          ar: "ما زالت كلمات مرورك مشتركة بين حساباتك.",
          en: "You still reuse passwords between accounts."
        },
        choices: [
          {
            id: "fix",
            label: { ar: "أفصل الحسابات بكلمات مرور فريدة الآن", en: "Separate accounts with unique passwords now" },
            outcome: "good",
            why: {
              ar: "قرار تصحيحي مهم — عزل الحسابات يحدّ من انتشار أي اختراق مستقبلي.",
              en: "An important corrective step — isolating accounts limits the spread of any future breach."
            },
            next: null
          }
        ]
      }
    }
  });

  window.THREAT_SCENARIOS = SCENARIOS;
})();
