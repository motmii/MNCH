/* ============================================================
   UI OVERHAUL · progressive enhancement
   - per-route document titles (the routed sections are real h1s)
   - grouped workspace / personal-board strips
   - tools index: search, categories, jump list
   - one calm FAB: Canva opens from the footer
   No data is stored, no lab or quiz behavior is touched.
   ============================================================ */
(function () {
  "use strict";

  var AR = "ar";
  var EN = "en";

  function lang() {
    return document.documentElement.lang === EN ? EN : AR;
  }

  function t(key, params) {
    if (window.Lang && typeof window.Lang.t === "function") return window.Lang.t(key, params);
    return key;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function each(list, fn) {
    Array.prototype.forEach.call(list || [], fn);
  }

  /* ---------------- 1 · routed document titles ---------------- */

  var HOME_TITLES = {
    ar: "الرئيسية — منصة أمن المعلومات",
    en: "Home — Information Security Platform"
  };
  var BRANDS = {
    ar: "منصة أمن المعلومات",
    en: "Information Security Platform"
  };

  function activeViewId() {
    var active = document.querySelector("#hero.is-active, .section.is-active");
    if (!active) return "";
    return active.id || "";
  }

  function syncTitle() {
    var viewId = activeViewId();
    var current = lang();
    var title;
    if (!viewId || viewId === "hero") {
      title = HOME_TITLES[current];
    } else {
      var scope = document.getElementById(viewId);
      var heading = scope ? scope.querySelector("h1.section-title, h1") : null;
      var label = heading ? heading.textContent.replace(/\s+/g, " ").trim() : "";
      title = label ? label + " — " + BRANDS[current] : t("meta.title");
    }
    if (title) document.title = title;
    document.documentElement.setAttribute("data-view", viewId || "hero");
    markWorkspaceLinks(viewId);
  }

  function markWorkspaceLinks(viewId) {
    each(document.querySelectorAll(".workspace-links a"), function (link) {
      var target = (link.getAttribute("href") || "").replace(/^#/, "");
      if (target && target === viewId) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  /* ---------------- 2 · workspace / board strips ---------------- */

  var WORKSPACE = {
    label: "nav.workspace",
    links: [
      ["#labs", "nav.labs"],
      ["#theatre", "nav.theatre"],
      ["#games", "nav.games"],
      ["#redteam", "nav.redteam"],
      ["#ir", "nav.ir"],
      ["#cryptolab", "nav.cryptolab"]
    ]
  };
  var BOARD = {
    label: "nav.myBoard",
    links: [
      ["#progress", "nav.progress"],
      ["#skills", "nav.skills"],
      ["#student", "nav.student"]
    ]
  };

  function buildStrip(config) {
    var nav = el("nav", "workspace-nav");
    nav.setAttribute("aria-label", t(config.label));
    var label = el("span", "workspace-label", t(config.label));
    label.setAttribute("data-i18n", config.label);
    nav.appendChild(label);
    var links = el("div", "workspace-links");
    config.links.forEach(function (pair) {
      var a = el("a", null, t(pair[1]));
      a.href = pair[0];
      a.setAttribute("data-i18n", pair[1]);
      links.appendChild(a);
    });
    nav.appendChild(links);
    return nav;
  }

  function mountStrips() {
    var groups = [
      [["labs", "theatre", "games", "redteam", "ir", "cryptolab"], WORKSPACE],
      [["progress", "skills", "student"], BOARD]
    ];
    groups.forEach(function (group) {
      var config = group[1];
      group[0].forEach(function (id) {
        var section = document.getElementById(id);
        if (!section || section.querySelector(":scope > .workspace-nav")) return;
        section.insertBefore(buildStrip(config), section.firstChild);
      });
    });
    markWorkspaceLinks(activeViewId());
  }

  /* ---------------- 3 · tools index ---------------- */

  function revealCard(card) {
    if (!card) return;
    card.classList.add("is-revealed");
    ["opacity", "filter", "transform", "translate", "rotate", "scale", "transition"].forEach(function (prop) {
      card.style.removeProperty(prop);
    });
  }

  function mountToolEdu() {
    var openOnDesktop = window.matchMedia("(min-width: 900px)").matches;
    each(document.querySelectorAll(".tool-card .tool-edu"), function (edu) {
      if (edu.querySelector(":scope > .tool-edu-more")) return;
      var details = el("details", "tool-edu-more");
      details.open = openOnDesktop;
      var summary = el("summary", "tool-edu-summary", t("tools.eduToggle"));
      summary.setAttribute("data-i18n", "tools.eduToggle");
      details.appendChild(summary);
      var body = el("div", "tool-edu-body");
      while (edu.firstChild) body.appendChild(edu.firstChild);
      details.appendChild(body);
      edu.appendChild(details);
    });
  }

  var TOOL_CATEGORY = {
    "tool-hash": "crypto",
    "tool-caesar": "crypto",
    "tool-jwt": "web",
    "tool-cidr": "network",
    "tool-password": "passwords",
    "tool-encoders": "crypto",
    "tool-regex": "analysis",
    "tool-fw": "network",
    "tool-vuln": "web",
    "tool-sniffer": "network",
    "tool-portscan": "network",
    "tool-playground": "crypto"
  };
  var CATEGORIES = [
    ["all", "tools.catAll"],
    ["crypto", "tools.catCrypto"],
    ["web", "tools.catWeb"],
    ["network", "tools.catNetwork"],
    ["passwords", "tools.catPasswords"],
    ["analysis", "tools.catAnalysis"]
  ];

  function toolsState() {
    return {
      query: "",
      category: "all"
    };
  }

  function mountTools() {
    var section = document.getElementById("tools");
    var grid = document.getElementById("toolsGrid") || (section && section.querySelector(".tools-grid"));
    if (!section || !grid || section.querySelector(".tools-toolbar")) return;

    var state = toolsState();
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".tool-card"));
    cards.forEach(function (card) {
      card.setAttribute("data-cat", TOOL_CATEGORY[card.id] || "analysis");
    });

    var toolbar = el("div", "tools-toolbar");
    toolbar.setAttribute("role", "search");

    var row = el("div", "tools-toolbar-row");
    var search = el("input", "tools-search");
    search.type = "search";
    search.placeholder = t("tools.searchPlaceholder");
    search.setAttribute("aria-label", t("tools.searchPlaceholder"));
    search.setAttribute("data-i18n-placeholder", "tools.searchPlaceholder");
    row.appendChild(search);

    var chips = el("div", "tools-toolbar-row");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", t("tools.catAll"));
    CATEGORIES.forEach(function (pair) {
      var chip = el("button", "tools-chip", t(pair[1]));
      chip.type = "button";
      chip.setAttribute("data-cat", pair[0]);
      chip.setAttribute("data-i18n", pair[1]);
      chip.setAttribute("aria-pressed", pair[0] === "all" ? "true" : "false");
      chips.appendChild(chip);
    });
    row.appendChild(chips);
    toolbar.appendChild(row);

    var jump = el("div", "tools-jump");
    jump.setAttribute("aria-label", t("tools.catAll"));
    cards.forEach(function (card) {
      var title = card.querySelector(".tool-title");
      var a = el("a", null, title ? title.textContent : card.id);
      a.href = "#" + card.id;
      a.setAttribute("data-tool-jump", card.id);
      jump.appendChild(a);
    });
    toolbar.appendChild(jump);

    var count = el("p", "tools-count");
    count.setAttribute("aria-live", "polite");
    toolbar.appendChild(count);

    var empty = el("p", "tools-empty");
    empty.hidden = true;
    section.insertBefore(toolbar, grid);
    section.appendChild(empty);

    function apply(reveal) {
      var q = state.query.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var cat = card.getAttribute("data-cat");
        var text = card.textContent.toLowerCase();
        var visible = (state.category === "all" || cat === state.category) &&
          (!q || text.indexOf(q) !== -1);
        card.hidden = !visible;
        if (visible) {
          shown++;
          if (reveal) revealCard(card);
        }
      });
      count.textContent = lang() === EN
        ? shown + " of " + cards.length + " tools"
        : shown + " من " + cards.length + " أداة";
      empty.hidden = shown !== 0;
      empty.textContent = lang() === EN
        ? "No tool matches this search."
        : "لا توجد أداة مطابقة لهذا البحث.";
    }

    search.addEventListener("input", function () {
      state.query = search.value;
      apply(true);
    });

    chips.addEventListener("click", function (event) {
      var chip = event.target.closest(".tools-chip");
      if (!chip) return;
      state.category = chip.getAttribute("data-cat") || "all";
      each(chips.querySelectorAll(".tools-chip"), function (other) {
        other.setAttribute("aria-pressed", other === chip ? "true" : "false");
      });
      apply(true);
    });

    jump.addEventListener("click", function (event) {
      var link = event.target.closest("[data-tool-jump]");
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      var card = document.getElementById(link.getAttribute("data-tool-jump"));
      if (!card) return;
      if (card.hidden) {
        state.query = "";
        state.category = "all";
        search.value = "";
        each(chips.querySelectorAll(".tools-chip"), function (other) {
          other.setAttribute("aria-pressed", other.getAttribute("data-cat") === "all" ? "true" : "false");
        });
        apply(true);
      }
      card.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
      card.classList.add("is-flashed");
      window.setTimeout(function () { card.classList.remove("is-flashed"); }, 1200);
    });

    apply();
    window.__uiToolsApply = apply;
  }

  /* ---------------- 4 · footer Canva entry ---------------- */

  function mountCanvaEntry() {
    each(document.querySelectorAll("[data-canva-open]"), function (button) {
      if (button.getAttribute("data-canva-wired") === "1") return;
      button.setAttribute("data-canva-wired", "1");
      button.setAttribute("aria-haspopup", "dialog");
      button.addEventListener("click", function () {
        var fab = document.getElementById("canvaFab");
        if (!fab) return;
        fab.click();
        var studio = document.getElementById("canvaStudio");
        if (!studio || typeof MutationObserver !== "function") return;
        var observer = new MutationObserver(function () {
          if (studio.hidden || studio.getAttribute("aria-hidden") === "true") {
            observer.disconnect();
            if (button.isConnected) button.focus();
          }
        });
        observer.observe(studio, { attributes: true, attributeFilter: ["hidden", "aria-hidden"] });
        window.setTimeout(function () { observer.disconnect(); }, 60000);
      });
    });
  }

  /* ---------------- 5 · mobile FAB guard ---------------- */

  /* The assistant FAB is fixed to the bottom corner, where it can cover the
     hero's primary CTA on phones. Keep it out of the way until the first
     meaningful scroll, then restore it. */
  function mountAssistantFabGuard() {
    var root = document.getElementById("assistantRoot");
    if (!root) return;
    var mq = window.matchMedia ? window.matchMedia("(max-width: 900px)") : null;
    var ticking = false;

    function sync() {
      ticking = false;
      var small = !!(mq && mq.matches);
      var y = window.scrollY || window.pageYOffset || 0;
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      root.classList.toggle("is-fab-muted", small && y < 240 && maxScroll > 260);
    }

    function request() {
      if (ticking) return;
      ticking = true;
      var raf = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };
      raf(sync);
    }

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    if (mq && typeof mq.addEventListener === "function") mq.addEventListener("change", request);
    document.addEventListener("nova:view-changed", request);
    sync();
  }

  /* ---------------- 6 · boot + live updates ---------------- */

  function boot() {
    mountStrips();
    mountToolEdu();
    mountTools();
    mountCanvaEntry();
    mountAssistantFabGuard();
    syncTitle();
    window.setTimeout(syncTitle, 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  document.addEventListener("nova:view-changed", function (event) {
    var detail = event && event.detail ? event.detail : {};
    if (detail.viewId) markWorkspaceLinks(detail.viewId);
    syncTitle();
  });

  if (window.Lang && typeof window.Lang.onSwitch === "function") {
    window.Lang.onSwitch(function () {
      syncTitle();
      mountToolEdu();
      if (typeof window.__uiToolsApply === "function") window.__uiToolsApply();
    });
  }

  window.addEventListener("load", syncTitle);
})();
