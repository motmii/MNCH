/* ============================================================
   MODULE 90 · Motion — Lenis smooth scroll + GSAP polish layer
   ------------------------------------------------------------
   One progressive-enhancement layer ON TOP of the existing
   platform (it never replaces it):

   · Lenis smooth scrolling, driven by gsap.ticker and feeding
     ScrollTrigger.update. Internal scroll containers opt out via
     data-lenis-prevent (statically in index.html, plus a
     selector fallback for dynamically rendered drawers such as
     the quiz explanation <details class="q-explain">).
   · BlurText-style staggered word reveals for the hero heading,
     tagline and sub. WORDS ONLY: Arabic cursive joining must
     never be broken — no per-character splitting and no
     letter-spacing anywhere (style.css MODULE 80 rule). The
     gradient phrase (.grad, background-clip: text) animates as
     ONE unit with opacity/filter only — transformed children of
     a clipped-gradient element cannot render correctly.
   · ScrollTrigger card reveals for #semester + #subjects grids,
     #paths cards, the #skills tree, the 12 tool cards and the 4
     lab cards. Cards are armed only while their view is active
     (ViewSwitcher keeps inactive views display:none), so
     triggers never measure hidden layout; a MutationObserver
     arms dynamically rendered cards. Tilt cards (MODULE 11 owns
     their transform) get an opacity/blur reveal instead of a
     transform tween so the two never fight over style.transform.
   · ViewSwitcher transitions on nova:view-changed, smooth
     anchor jumps for in-view targets, and smooth scroll-to-top
     when re-clicking the already-active tab. Browser
     Back/Forward goes through the same path (popstate →
     activate → nova:view-changed).
   · Pointer-tracked neon glow (coordinates written here; the
     ::after paint lives in motion.css).

   Gating: every piece lives inside gsap.matchMedia()
   "(prefers-reduced-motion: no-preference)" — with reduced
   motion the callback never runs: no Lenis, no splitting, no
   tweens, the site keeps its exact pre-motion behaviour (native
   scroll + the MODULE 08 .reveal IntersectionObserver). The
   returned cleanup undoes everything when the preference flips
   at runtime. If the vendored libs are missing, the module
   exits at the feature-detect: zero errors, zero side effects.
   ============================================================ */
(function initMotion() {
  "use strict";

  const doc = document;
  const rootEl = doc.documentElement;

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const Lenis = window.Lenis;
  /* Feature-detect — without the vendored libs nothing runs at all. */
  if (!gsap || typeof gsap.ticker !== "object" || typeof gsap.matchMedia !== "function") return;
  if (!ScrollTrigger || typeof ScrollTrigger.update !== "function") return;
  if (typeof Lenis !== "function") return;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- shared selectors ---------- */
  /** Cards that get the richer staggered ScrollTrigger reveal. */
  const CARD_SEL = [
    ".work-card",
    ".path-card",
    ".skill-card",
    ".tool-card",
    ".lab-link",
    ".bento-card",
    "#semesterGrid > *",
    "#labsGrid > *",
  ].join(", ");

  /** Internal scroll containers Lenis must never hijack. */
  const NO_SCROLL_SEL = "[data-lenis-prevent], .q-explain";

  /** Hero text that gets the word-by-word BlurText reveal. */
  const WORD_SEL = [
    ".hero-title .reveal-line",
    ".hero-tagline",
    ".hero-sub",
  ].join(", ");

  const main = doc.querySelector("main");
  const hero = doc.getElementById("hero");

  /** Currently active ViewSwitcher view element (falls back to main). */
  function activeViewEl() {
    if (!main) return null;
    for (let i = 0; i < main.children.length; i++) {
      const el = main.children[i];
      if (el.classList && el.classList.contains("is-active")) return el;
    }
    return main;
  }

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", function (ctx) {
    rootEl.classList.add("motion-on");

    /* ================= 1 · Lenis smooth scroll ================= */
    const lenis = new Lenis({
      autoRaf: false, /* driven by gsap.ticker below */
      lerp: 0.11,
      prevent: function (node) {
        return !!(node && typeof node.closest === "function" && node.closest(NO_SCROLL_SEL));
      },
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = function (time) { lenis.raf(time * 1000); };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    /** Two-frame deferral so layout settles before ScrollTrigger maps it. */
    function refreshSoon() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { ScrollTrigger.refresh(); });
      });
    }

    /* ================= 2 · Hero word reveal (BlurText) ================= */
    /**
     * Wrap every word of a text node tree in a span.m-word.
     * Descends into child elements (mixed markup like the <em class="grad">
     * accent) but NEVER inside .grad — that element is collected as one
     * soft unit and animated without transforms. Idempotent: a re-run
     * collects the existing spans instead of wrapping again.
     * @param {HTMLElement} el Root element to split.
     * @param {Array<HTMLElement>} hard Collector for animatable word spans.
     * @param {Array<HTMLElement>} soft Collector for .grad single units.
     * @returns {void}
     */
    function splitWords(el, hard, soft) {
      if (!el) return;
      if (el.__motionSplit) {
        el.querySelectorAll(".m-word").forEach(function (w) { hard.push(w); });
        el.querySelectorAll(".grad").forEach(function (g) { soft.push(g); });
        return;
      }
      el.__motionSplit = "1";
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          const text = node.nodeValue;
          if (!text || !/\S/.test(text)) return;
          const frag = doc.createDocumentFragment();
          text.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(doc.createTextNode(part));
              return;
            }
            const span = doc.createElement("span");
            span.className = "m-word";
            span.textContent = part;
            hard.push(span);
            frag.appendChild(span);
          });
          el.replaceChild(frag, node);
        } else if (node.nodeType === 1) {
          if (node.tagName === "BR") return;
          if (node.classList && node.classList.contains("grad")) {
            soft.push(node);
            return;
          }
          splitWords(node, hard, soft);
        }
      });
    }

    const hardWords = [];
    const softUnits = [];
    if (hero) {
      hero.querySelectorAll(WORD_SEL).forEach(function (el) {
        splitWords(el, hardWords, softUnits);
      });
    }

    /* Neutralise the base .reveal transition for hero blocks so the
       richer timeline below owns their entrance (the hidden
       #heroNextAction keeps the stock behaviour — MODULE 57 may
       unhide it later and should still fade it in as before). */
    if (hero) {
      hero.querySelectorAll(".hero-content .reveal").forEach(function (el) {
        if (el.id === "heroNextAction") return;
        el.style.transition = "none";
        el.classList.add("is-visible");
      });
    }

    if (hardWords.length) gsap.set(hardWords, { opacity: 0, yPercent: 55, filter: "blur(10px)" });
    if (softUnits.length) gsap.set(softUnits, { opacity: 0, filter: "blur(12px)" });

    /** Animate one playback of the hero word entrance. @param {number} delay Base delay. @returns {void} */
    function playWords(delay) {
      if (hardWords.length) {
        gsap.to(hardWords, {
          opacity: 1, yPercent: 0, filter: "blur(0px)",
          duration: 0.85, ease: "power3.out", stagger: 0.045, delay: delay,
          clearProps: "filter,transform,opacity",
        });
      }
      if (softUnits.length) {
        gsap.to(softUnits, {
          opacity: 1, filter: "blur(0px)",
          duration: 0.9, ease: "power3.out", delay: delay + 0.12,
          clearProps: "filter,opacity",
        });
      }
    }

    const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
    /** Enter-from helper that skips hidden strips (#heroNextAction etc.). */
    function heroFrom(el, vars, at) {
      if (el && !el.hidden) heroTl.from(el, vars, at);
    }
    heroFrom(doc.getElementById("heroNow"), { autoAlpha: 0, y: 14, duration: 0.5 }, 0);
    heroFrom(doc.querySelector(".hero-brand"), { autoAlpha: 0, y: 14, duration: 0.5 }, 0.06);
    playWords(0.12);
    heroFrom(doc.getElementById("heroSearchTrigger"), { autoAlpha: 0, y: 14, duration: 0.5 }, 0.66);
    heroFrom(doc.querySelector(".hero-meta"), { autoAlpha: 0, y: 14, duration: 0.55 }, 0.72);
    heroFrom(doc.querySelector(".hero-actions"), { autoAlpha: 0, y: 16, duration: 0.55 }, 0.78);
    heroFrom(doc.getElementById("heroStartHere"), { autoAlpha: 0, y: 16, duration: 0.55 }, 0.86);
    heroFrom(doc.getElementById("heroNextAction"), { autoAlpha: 0, y: 16, duration: 0.55 }, 0.86);
    heroFrom(doc.getElementById("heroDash"), { autoAlpha: 0, y: 20, duration: 0.7 }, 0.94);
    heroFrom(doc.getElementById("bentoMatrix"), { autoAlpha: 0, y: 22, duration: 0.7 }, 1.04);

    /* Language switches re-render every [data-i18n] node (textContent
       replacement in MODULE 22), which wipes the word spans mid-flight.
       Rebuild from scratch on each switch and replay the reveal — the
       plain text itself is never hidden for more than a frame. */
    let dead = false;
    /** Flatten + re-split the hero text after a locale repaint. @returns {void} */
    function rebuildHeroWords() {
      if (dead || !hero) return;
      const targets = hero.querySelectorAll(WORD_SEL);
      if (!targets.length) return;
      hardWords.length = 0;
      softUnits.length = 0;
      targets.forEach(function (el) {
        el.textContent = el.textContent; /* flatten any leftover spans */
        delete el.__motionSplit;
        splitWords(el, hardWords, softUnits);
      });
      if (!hardWords.length) return;
      gsap.set(hardWords, { opacity: 0, yPercent: 55, filter: "blur(10px)" });
      if (softUnits.length) gsap.set(softUnits, { opacity: 0, filter: "blur(12px)" });
      if (hero.classList.contains("is-active")) playWords(0);
    }
    if (window.Lang && typeof window.Lang.onSwitch === "function") {
      window.Lang.onSwitch(rebuildHeroWords);
    }

    /* ================= 3 · ScrollTrigger card reveals ================= */
    /** Arm not-yet-armed, currently visible cards; hidden views arm on switch. */
    function armCards(scope) {
      if (!scope || typeof scope.querySelectorAll !== "function") return;
      const fresh = [];
      scope.querySelectorAll(CARD_SEL).forEach(function (el) {
        if (el.__motionArmed || el.offsetParent === null) return;
        el.__motionArmed = "1";
        fresh.push(el);
      });
      if (!fresh.length) return;
      fresh.forEach(function (el) {
        /* MODULE 11 owns style.transform on .tilt/.magnetic elements. */
        const tilt = el.classList.contains("tilt") || el.classList.contains("magnetic");
        el.__motionTilt = tilt;
        el.style.transition = "none";
        el.classList.remove("reveal");
        if (tilt) gsap.set(el, { opacity: 0, filter: "blur(8px)" });
        else gsap.set(el, { opacity: 0, y: 26, filter: "blur(6px)" });
      });
      ScrollTrigger.batch(fresh, {
        start: "top 92%",
        once: true,
        onEnter: function (batch) {
          const tilts = batch.filter(function (el) { return el.__motionTilt; });
          const others = batch.filter(function (el) { return !el.__motionTilt; });
          const restore = function () {
            batch.forEach(function (el) { el.style.transition = ""; });
          };
          if (others.length) {
            gsap.to(others, {
              opacity: 1, y: 0, filter: "blur(0px)",
              duration: 0.65, ease: "power3.out", stagger: 0.06,
              clearProps: "filter,transform,opacity", onComplete: restore,
            });
          }
          if (tilts.length) {
            gsap.to(tilts, {
              opacity: 1, filter: "blur(0px)",
              duration: 0.7, ease: "power3.out", stagger: 0.06,
              clearProps: "filter,opacity", onComplete: restore,
            });
          }
        },
      });
    }
    armCards(activeViewEl());

    /* Dynamically rendered cards (semester grid, paths, progress…). */
    let armTimer = null;
    let observer = null;
    if (typeof MutationObserver === "function" && main) {
      observer = new MutationObserver(function () {
        if (armTimer) return;
        armTimer = setTimeout(function () {
          armTimer = null;
          armCards(activeViewEl());
        }, 220);
      });
      observer.observe(main, { childList: true, subtree: true });
    }

    /* ================= 4 · View transitions + anchors ================= */
    let ready = false;
    requestAnimationFrame(function () { ready = true; });

    /** Stagger a view's section heads (replaces their plain .reveal fade). */
    function staggerHeads(view) {
      view.querySelectorAll(".section-head").forEach(function (head) {
        head.style.transition = "none";
        head.classList.add("is-visible");
      });
      const kids = view.querySelectorAll(".section-head > *");
      if (!kids.length) return;
      gsap.fromTo(kids,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.05, delay: 0.08,
          clearProps: "opacity,visibility,transform",
        });
    }

    /** nova:view-changed — entrance animation + late arming of the view. */
    function onViewChanged(e) {
      const id = e && e.detail ? e.detail.viewId : null;
      const view = id ? doc.getElementById(id) : null;
      lenis.resize();
      armCards(view || activeViewEl());
      if (!view) { refreshSoon(); return; }
      if (!ready) { refreshSoon(); return; } /* boot activation — no entrance */
      gsap.fromTo(view,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out",
          clearProps: "opacity,visibility,transform", onComplete: refreshSoon,
        });
      staggerHeads(view);
      if (id === "hero") playWords(0); /* light replay when returning home */
    }
    doc.addEventListener("nova:view-changed", onViewChanged);

    /**
     * Capture-phase anchor handling (runs before ViewSwitcher's own
     * bubble handler): view links stay with the ViewSwitcher — except a
     * re-click on the already-active view, which smooth-scrolls to its
     * top; in-view anchors (#faq-style targets) smooth-scroll with the
     * navbar offset. Any other default behaviour is untouched.
     */
    function onAnchorClick(e) {
      if (e.defaultPrevented) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target;
      const link = target && typeof target.closest === "function"
        ? target.closest('a[href^="#"]:not([href="#"])')
        : null;
      if (!link) return;
      const id = (link.getAttribute("href") || "").slice(1);
      if (!id) return;
      const NV = window.NovaViews;
      if (NV && typeof NV.resolveViewId === "function" && NV.resolveViewId(id) === id) {
        /* A ViewSwitcher route: only add the "back to top" nicety. */
        if (NV.current() === id) {
          e.preventDefault();
          lenis.scrollTo(0, { duration: 0.8, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
        }
        return;
      }
      const el = doc.getElementById(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -88, duration: 0.9 });
    }
    doc.addEventListener("click", onAnchorClick, true);

    /* ================= 5 · Pointer-tracked card glow ================= */
    const fineHover = typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    /** Write the pointer position onto the hovered card's custom props. */
    function onPointerGlow(e) {
      const target = e.target;
      const card = target && typeof target.closest === "function"
        ? target.closest(".tool-card, .lab-link, .skill-card, .path-card, .hero-dash-panel, .bento-card")
        : null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left).toFixed(1) + "px");
      card.style.setProperty("--my", (e.clientY - r.top).toFixed(1) + "px");
    }
    if (fineHover) doc.addEventListener("pointermove", onPointerGlow, { passive: true });

    /* ================= 6 · Command-deck 3D tilt (v3.0.0 hero) ================= */
    /* Pointermove binds on the deck element ONLY (never document-level), so
       the tilt maths run only while the pointer is actually over it. */
    const deckTiltCleanups = [];
    if (fineHover && hero) {
      hero.querySelectorAll(".cmd-deck").forEach(function (deckEl) {
        const MAX_TILT = 6;
        let rx = null;
        let ry = null;
        if (typeof gsap.quickTo === "function") {
          rx = gsap.quickTo(deckEl, "rotationX", { duration: 0.5, ease: "power2.out" });
          ry = gsap.quickTo(deckEl, "rotationY", { duration: 0.5, ease: "power2.out" });
        }
        /** Track the pointer across the deck face; relax back on leave. */
        function onDeckMove(e) {
          const r = deckEl.getBoundingClientRect();
          if (!r || !r.width || !r.height) return;
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          const tiltX = -py * MAX_TILT * 2;
          const tiltY = px * MAX_TILT * 2;
          if (rx && ry) { rx(tiltX); ry(tiltY); }
          else {
            deckEl.style.transform = "rotateX(" + tiltX.toFixed(2) + "deg) rotateY(" + tiltY.toFixed(2) + "deg)";
          }
        }
        function onDeckLeave() {
          if (rx && ry) { rx(0); ry(0); }
          else deckEl.style.transform = "";
        }
        deckEl.addEventListener("pointermove", onDeckMove, { passive: true });
        deckEl.addEventListener("pointerleave", onDeckLeave);
        deckTiltCleanups.push(function () {
          deckEl.removeEventListener("pointermove", onDeckMove);
          deckEl.removeEventListener("pointerleave", onDeckLeave);
        });
      });
    }

    /* ================= 7 · Bento matrix parallax (v3.0.0) ================= */
    /* Gentle scrub drift on each bento card's decorative glow layer. */
    if (hero) {
      hero.querySelectorAll(".bento-card").forEach(function (card) {
        const layer = card.querySelector(".bento-glow");
        if (!layer) return;
        gsap.fromTo(layer,
          { yPercent: -6 },
          {
            yPercent: 6, ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
          });
      });
    }

    /* ================= cleanup (media preference flips) ================= */
    return function () {
      dead = true;
      if (observer) observer.disconnect();
      if (armTimer) clearTimeout(armTimer);
      doc.removeEventListener("nova:view-changed", onViewChanged);
      doc.removeEventListener("click", onAnchorClick, true);
      doc.removeEventListener("pointermove", onPointerGlow);
      deckTiltCleanups.forEach(function (fn) { fn(); });
      gsap.ticker.remove(tick);
      lenis.destroy();
      rootEl.classList.remove("motion-on");
      /* gsap.matchMedia reverts every context-created tween, trigger and
         inline style automatically after this function returns. */
    };
  });
})();
