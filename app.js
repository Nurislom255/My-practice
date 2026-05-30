/* app.js
   SAT Mock "heart" logic
   - Reads global `data` from script.js
   - Renders left panel + right panel
   - Handles MCQ + SPR, timer, navigation, question grid, Desmos panel
*/

(() => {
  "use strict";

  // -----------------------------
  // Small helpers
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const toInt = (v, fallback = 0) => {
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const hasMeaningfulText = (html) => {
    // Strip tags & entities-ish; good enough for "is empty?" checks
    const s = String(html ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;|&#160;/g, " ")
      .trim();
    return s.length > 0;
  };

  const safeHTML = (html) => String(html ?? ""); // your data is trusted (local)

  const formatMMSS = (ms) => {
    ms = Math.max(0, ms);
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const now = () => Date.now();

  // -----------------------------
  // Inject the missing "selected choice" styling you requested
  // (you could move this into mock.css later)
  // -----------------------------
  function injectSelectionCSS() {
    const css = `
      .choice.is-selected{
        box-shadow: 0 0 2px 2px rgba(151, 125, 87);
        border-color: rgba(151, 125, 87);
      }
      .choice.is-selected .choice__icon{
        background: rgba(51, 80, 203);
        border-color: black;
        color: #fff;
        font-weight: 800;
      }

      /* SPR UI */
      .spr{
        margin: 10px 20px;
        display: grid;
        gap: 8px;
      }
      .spr__row{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
      }
      .spr__input{
        border: 2px solid #000;
        border-radius: 8px;
        padding: 10px 12px;
        font: inherit;
      }
      .spr__btn{
        padding: 10px 14px;
        border: 0;
        border-radius: 999px;
        background: rgb(0 0 255);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }

      /* Simple dialogs */
      dialog.satdlg{
        border: 1px solid rgba(0,0,0,0.25);
        border-radius: 10px;
        padding: 12px;
        max-width: min(720px, 92vw);
      }
      .dlg__head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 20px;
        margin-bottom: 10px;
        font-weight: 700;
        font-size: larger;
      }
      .dlg__close{
        border: 1px solid rgba(0,0,0,0.25);
        border-radius: 999px;
        padding: 6px 10px;
        background: #fff;
        cursor: pointer;
        font-weight: 700;
        font-size: large;
      }
      .qgrid{
        display:grid;
        grid-template-columns: repeat(9, minmax(0, 1fr));
        gap: 6px;
      }
      .qgrid__btn{
        border: 1px solid rgba(0,0,0,0.25);
        border-radius: 8px;
        padding: 20px 32px;
        background: #fff;
        cursor:pointer;
        font: inherit;
        font-weight: 700;
        margin: 10px;
      }
      .qgrid__btn[data-answered="1"]{ background: rgba(38, 213, 61, 0.33); }
      .qgrid__btn[data-current="1"]{ outline: 2px solid rgba(0,0,0,0.25); outline-offset: 1px; }

      /* Desmos floating */
      .desmos{
        position: fixed;
        top: 90px;
        right: 20px;
        width: 420px;
        height: 520px;
        background: #fff;
        border: 1px solid rgba(0,0,0,0.25);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.18);
        overflow: hidden;
        z-index: 9999;
        display: none;
      }
      .desmos__bar{
        height: 44px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 0 10px;
        background: rgba(0,0,0,0.06);
        cursor: move;
        user-select: none;
        font-weight: 800;
      }
      .desmos__x{
        cursor:pointer;
        border: 1px solid rgba(0,0,0,0.25);
        border-radius: 999px;
        padding: 4px 10px;
        background: #fff;
        font-weight: 800;
      }
      .desmos iframe{
        width: 100%;
        height: calc(100% - 44px);
        border: 0;
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // -----------------------------
  // Data normalization
  // -----------------------------
  function normalizeQuestions(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x) => x && typeof x === "object" && typeof x.id === "string")
      .map((q) => {
        const content = Array.isArray(q.content) ? q.content : [];
        const byKind = new Map(content.map((c) => [c.kind, c]));

        return {
          pack: String(q.pack ?? ""),
          id: String(q.id ?? ""),
          module: String(q.module ?? ""),
          order: toInt(q.order, 0),
          section: String(q.section ?? ""), // "" => RW, "math" => Math (your data)
          spr: String(q.spr ?? ""),         // "yes"/"no" for math
          domain: String(q.domain ?? ""),
          skill: String(q.skill ?? ""),
          prompt: String(q.prompt ?? ""),
          A: String(q.A ?? ""),
          B: String(q.B ?? ""),
          C: String(q.C ?? ""),
          D: String(q.D ?? ""),
          answer: String(q.answer ?? ""),
          difficulty: q.difficulty ?? null,

          // common content blocks
          blurb: safeHTML(byKind.get("blurb")?.html ?? ""),
          quote: safeHTML(byKind.get("quote")?.html ?? ""),
          copyright: safeHTML(byKind.get("copyright")?.html ?? ""),
          text: safeHTML(byKind.get("text")?.html ?? ""),

          equation1: safeHTML(byKind.get("equation1")?.html ?? ""),
          equation2: safeHTML(byKind.get("equation2")?.html ?? ""),

          table: byKind.get("table") ?? null,
          image: byKind.get("image") ?? null,
        };
      });
  }

  function sectionType(q) {
    return q.section === "math" ? "math" : "rw";
  }

  function groupKeyOf(q) {
    return `${q.pack}|${sectionType(q)}|${q.module}`;
  }

  // -----------------------------
  // Storage (answers + timer + UI)
  // -----------------------------
  function storageKey(prefix, groupKey) {
    return `satmock:v1:${prefix}:${groupKey}`;
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota/blocked
    }
  }

  // -----------------------------
  // KaTeX auto-render (if present)
  // -----------------------------
  function renderKatexIfAvailable(rootEl) {
    try {
      if (typeof window.renderMathInElement === "function" && rootEl) {
        window.renderMathInElement(rootEl, {
          delimiters: [
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      }
    } catch {
      // don't crash the app for math rendering
    }
  }

  // -----------------------------
  // Table rendering: columns/rows -> <table>
  // (Automatically trims fully-empty trailing rows/cols so blank pads don't show)
  // -----------------------------
  function computeUsedRect(columns, rows) {
    const colCount = Math.max(columns.length, ...rows.map((r) => r.length));
    let lastUsedCol = -1;

    for (let c = 0; c < colCount; c++) {
      if (hasMeaningfulText(columns[c] ?? "")) {
        lastUsedCol = Math.max(lastUsedCol, c);
        continue;
      }
      for (const r of rows) {
        if (hasMeaningfulText(r?.[c] ?? "")) {
          lastUsedCol = Math.max(lastUsedCol, c);
          break;
        }
      }
    }

    let lastUsedRow = -1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const any = row.some((cell, c) => c <= lastUsedCol && hasMeaningfulText(cell ?? ""));
      if (any) lastUsedRow = r;
    }

    return {
      usedCols: lastUsedCol + 1, // 0 => no table content
      usedRows: lastUsedRow + 1,
    };
  }

  function buildTableDOM(tableObj) {
    const caption = safeHTML(tableObj?.caption ?? "");
    const columns = Array.isArray(tableObj?.columns) ? tableObj.columns : [];
    const rows = Array.isArray(tableObj?.rows) ? tableObj.rows : [];

    const { usedCols, usedRows } = computeUsedRect(columns, rows);

    if (usedCols <= 0 || usedRows <= 0) return null;

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.margin = "10px 0";

    // Basic cell borders so tables are readable
    const cellStyle = "border:1px solid rgba(0,0,0,0.25); padding:6px 8px; vertical-align:top;";

    if (hasMeaningfulText(caption)) {
      const cap = document.createElement("caption");
      cap.innerHTML = caption;
      cap.style.captionSide = "top";
      cap.style.fontWeight = "800";
      cap.style.padding = "6px 0";
      table.appendChild(cap);
    }

    // header row if any column header has text
    const anyHeader = columns.slice(0, usedCols).some((c) => hasMeaningfulText(c ?? ""));
    if (anyHeader) {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      for (let c = 0; c < usedCols; c++) {
        const th = document.createElement("th");
        th.innerHTML = safeHTML(columns[c] ?? "");
        th.setAttribute("style", cellStyle + " font-weight:800; text-align:left;");
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement("tbody");
    for (let r = 0; r < usedRows; r++) {
      const tr = document.createElement("tr");
      const row = rows[r] ?? [];
      for (let c = 0; c < usedCols; c++) {
        const td = document.createElement("td");
        td.innerHTML = safeHTML(row[c] ?? "");
        td.setAttribute("style", cellStyle);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    return table;
  }

  // -----------------------------
  // App boot
  // -----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    injectSelectionCSS();

    if (!Array.isArray(window.data)) {
      alert("script.js did not load `const data = [...]`. Add <script defer src='script.js'></script> before app.js");
      return;
    }

    // Normalize
    const all = normalizeQuestions(window.data);

    if (all.length === 0) {
      alert("No questions found. Your data array must contain objects with an `id` field.");
      return;
    }

    // Group questions by pack+sectionType+module
    const groups = new Map();
    for (const q of all) {
      const key = groupKeyOf(q);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(q);
    }
    for (const [k, arr] of groups) {
      arr.sort((a, b) => a.order - b.order);
      groups.set(k, arr);
    }

    // Choose starting group from URL ?pack=1&section=rw|math&module=1
    const url = new URL(window.location.href);
    const wantPack = url.searchParams.get("pack");
    const wantSection = url.searchParams.get("section"); // "rw" or "math"
    const wantModule = url.searchParams.get("module");

    let activeKey = null;
    for (const k of groups.keys()) {
      const [pack, sec, mod] = k.split("|");
      if (wantPack && pack !== wantPack) continue;
      if (wantSection && sec !== wantSection) continue;
      if (wantModule && mod !== wantModule) continue;
      activeKey = k;
      break;
    }
    if (!activeKey) activeKey = [...groups.keys()][0];

    // Element refs
    const el = {
      topbarMeta: $("topbar-meta"),
      timer: $("timer"),
      timerHideBtn: $("timer-hide-btn"),

      annotateBtn: $("annotate-btn"),
      moreBtn: $("more-btn"),
      directionsBtn: $("directions-btn"),

      panelLeft: $("panel-left"),

      qTable: $("question__table"),
      qImage: $("question__image"),
      qBlurb: $("question__blurb"),
      qQuote: $("question__quote"),
      qCopyright: $("question__copyright"),
      qText: $("question__text"),

      qNumber: $("question-number"),
      prompt: $("prompt"),

      choicesWrap: $("choices"),
      choiceA: $("choice-a"),
      choiceB: $("choice-b"),
      choiceC: $("choice-c"),
      choiceD: $("choice-d"),

      optA: $("options__a"),
      optB: $("options__b"),
      optC: $("options__c"),
      optD: $("options__d"),

      navBtn: $("question-nav-btn"),
      navText: $("question-nav-text"),

      backBtn: $("back-btn"),
      nextBtn: $("next-btn"),
    };

    // Reorder left-panel slots once to guarantee: Image -> Table -> ...
    // (Your HTML had table before image.)
    // We keep your nodes; we just move them.
    (() => {
      const nodes = [el.qImage, el.qTable, el.qBlurb, el.qQuote, el.qCopyright, el.qText].filter(Boolean);
      for (const n of nodes) el.panelLeft.appendChild(n);
    })();

    // Runtime state
    const state = {
      groupKey: activeKey,
      questions: groups.get(activeKey),
      index: 0,

      // per-group persisted:
      answers: {},   // { [id]: { type:"mcq", choice:"A" } OR { type:"spr", value:"-13" } }
      leftHTML: {},  // { [id]: { blurb,quote,copyright,text,table,image } } for annotate persistence

      // timer persisted:
      timer: { running: true, endAtMs: 0, durationMs: 0 },

      // UI toggles:
      timerHidden: false,
      annotateOn: false,
    };

    // -----------------------------
    // Dialogs: Directions, Question Nav, More
    // -----------------------------
    const directionsDlg = makeDialog("Directions", "");
    const navDlg = makeDialog("Question Navigation", "");
    const moreDlg = makeDialog("More", "");

    function makeDialog(title, bodyHTML) {
      const dlg = document.createElement("dialog");
      dlg.className = "satdlg";

      const head = document.createElement("div");
      head.className = "dlg__head";
      head.innerHTML = `<div>${title}</div>`;

      const close = document.createElement("button");
      close.className = "dlg__close";
      close.type = "button";
      close.textContent = "Close";
      close.addEventListener("click", () => dlg.close());

      head.appendChild(close);

      const body = document.createElement("div");
      body.className = "dlg__body";
      body.innerHTML = bodyHTML;

      dlg.appendChild(head);
      dlg.appendChild(body);
      document.body.appendChild(dlg);

      dlg._setBody = (html) => (body.innerHTML = html);
      return dlg;
    }

    // -----------------------------
    // Desmos floating panel (movable)
    // -----------------------------
    const desmos = buildDesmosPanel();
    function buildDesmosPanel() {
      const wrap = document.createElement("div");
      wrap.className = "desmos";
      wrap.innerHTML = `
        <div class="desmos__bar">
          <div>Desmos Calculator</div>
          <button class="desmos__x" type="button">×</button>
        </div>
        <iframe src="https://www.desmos.com/calculator" title="Desmos Calculator"></iframe>
      `;
      document.body.appendChild(wrap);

      const bar = wrap.querySelector(".desmos__bar");
      const x = wrap.querySelector(".desmos__x");

      x.addEventListener("click", () => hideDesmos());

      // drag
      let dragging = false;
      let startX = 0, startY = 0;
      let startLeft = 0, startTop = 0;

      const posKey = storageKey("desmospos", state.groupKey);

      const saved = loadJSON(posKey, null);
      if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
        wrap.style.left = `${saved.left}px`;
        wrap.style.top = `${saved.top}px`;
        wrap.style.right = "auto";
      }

      bar.addEventListener("pointerdown", (e) => {
        dragging = true;
        wrap.setPointerCapture(e.pointerId);
        const rect = wrap.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
      });

      bar.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const left = clamp(startLeft + dx, 8, window.innerWidth - 100);
        const top = clamp(startTop + dy, 60, window.innerHeight - 100);

        wrap.style.left = `${left}px`;
        wrap.style.top = `${top}px`;
        wrap.style.right = "auto";
      });

      bar.addEventListener("pointerup", (e) => {
        if (!dragging) return;
        dragging = false;
        const rect = wrap.getBoundingClientRect();
        saveJSON(posKey, { left: rect.left, top: rect.top });
      });

      return wrap;
    }

    function showDesmos() {
      desmos.style.display = "block";
    }
    function hideDesmos() {
      desmos.style.display = "none";
    }

    // -----------------------------
    // Persist / load per-group data
    // -----------------------------
    function loadGroupState() {
      const aKey = storageKey("answers", state.groupKey);
      const lKey = storageKey("lefthtml", state.groupKey);
      const tKey = storageKey("timer", state.groupKey);

      state.answers = loadJSON(aKey, {});
      state.leftHTML = loadJSON(lKey, {});

      const savedTimer = loadJSON(tKey, null);
      initTimer(savedTimer);
    }

    function saveAnswers() {
      saveJSON(storageKey("answers", state.groupKey), state.answers);
    }

    function saveLeftHTML() {
      saveJSON(storageKey("lefthtml", state.groupKey), state.leftHTML);
    }

    function saveTimer() {
      saveJSON(storageKey("timer", state.groupKey), state.timer);
    }

    // -----------------------------
    // Timer logic (32 min RW, 35 min Math)
    // -----------------------------
    let timerTickHandle = null;

    function initTimer(savedTimer) {
      const isMath = state.groupKey.split("|")[1] === "math";
      const durationMs = (isMath ? 35 : 32) * 60 * 1000;

      // If saved timer looks valid, use it. Else start fresh.
      if (
        savedTimer &&
        typeof savedTimer.endAtMs === "number" &&
        typeof savedTimer.durationMs === "number" &&
        savedTimer.durationMs === durationMs &&
        typeof savedTimer.running === "boolean"
      ) {
        state.timer = savedTimer;
      } else {
        state.timer = {
          running: true,
          durationMs,
          endAtMs: now() + durationMs,
        };
        saveTimer();
      }

      if (timerTickHandle) clearInterval(timerTickHandle);
      timerTickHandle = setInterval(tickTimer, 250);
      tickTimer();
    }

    function remainingMs() {
      const ms = state.timer.endAtMs - now();
      return Math.max(0, ms);
    }

    function tickTimer() {
      if (!state.timer.running) return;

      const ms = remainingMs();
      el.timer.textContent = formatMMSS(ms);
      el.timer.setAttribute("datetime", `PT${Math.ceil(ms / 1000)}S`);

      if (ms <= 0) {
        state.timer.running = false;
        saveTimer();
        alert("Time is up for this module.");
      }
    }

    function toggleTimerVisibility() {
      state.timerHidden = !state.timerHidden;
      el.timer.style.display = state.timerHidden ? "none" : "";
      el.timerHideBtn.textContent = state.timerHidden ? "Show" : "Hide";
    }

    // -----------------------------
    // Rendering
    // -----------------------------
    function currentQuestion() {
      return state.questions[state.index];
    }

    function isSPR(q) {
      const optsEmpty =
        !hasMeaningfulText(q.A) && !hasMeaningfulText(q.B) &&
        !hasMeaningfulText(q.C) && !hasMeaningfulText(q.D);
      return q.spr === "yes" || optsEmpty;
    }

    function setTopBar(q) {
      const sec = sectionType(q) === "math" ? "Section 2" : "Section 1";
      const name = sectionType(q) === "math" ? "Math" : "Reading and Writing";
      el.topbarMeta.textContent = `${sec}, Module ${q.module}: ${name}`;
    }

    function setBottomBar() {
      el.navText.textContent = `Question ${state.index + 1} of ${state.questions.length}`;
    }

    function applySavedLeftHTMLIfAny(q) {
      const saved = state.leftHTML[q.id];
      if (!saved) return;

      if (typeof saved.image === "string") el.qImage.innerHTML = saved.image;
      if (typeof saved.table === "string") el.qTable.innerHTML = saved.table;
      if (typeof saved.blurb === "string") el.qBlurb.innerHTML = saved.blurb;
      if (typeof saved.quote === "string") el.qQuote.innerHTML = saved.quote;
      if (typeof saved.copyright === "string") el.qCopyright.innerHTML = saved.copyright;
      if (typeof saved.text === "string") el.qText.innerHTML = saved.text;
    }

    function saveLeftSlots(q) {
      state.leftHTML[q.id] = {
        image: el.qImage.innerHTML,
        table: el.qTable.innerHTML,
        blurb: el.qBlurb.innerHTML,
        quote: el.qQuote.innerHTML,
        copyright: el.qCopyright.innerHTML,
        text: el.qText.innerHTML,
      };
      saveLeftHTML();
    }

    function renderLeft(q) {
      // image
      el.qImage.innerHTML = "";
      const img = q.image;
      const src = img?.src ? String(img.src) : "";
      if (src.trim()) {
        const figure = document.createElement("figure");
        figure.style.margin = "10px 0";

        const im = document.createElement("img");
        im.src = src;
        im.alt = String(img?.alt ?? "");
        im.style.maxWidth = "100%";
        im.style.height = "auto";
        im.loading = "lazy";

        figure.appendChild(im);

        if (hasMeaningfulText(img?.caption ?? "")) {
          const cap = document.createElement("figcaption");
          cap.innerHTML = safeHTML(img.caption);
          cap.style.fontSize = "0.9rem";
          cap.style.opacity = "0.9";
          figure.appendChild(cap);
        }

        el.qImage.appendChild(figure);
      }

      // table
      el.qTable.innerHTML = "";
      if (q.table) {
        const tableDOM = buildTableDOM(q.table);
        if (tableDOM) el.qTable.appendChild(tableDOM);
      }

      // blurb/quote/copyright vs text
      const showText = hasMeaningfulText(q.text);
      const showBQC =
        hasMeaningfulText(q.blurb) ||
        hasMeaningfulText(q.quote) ||
        hasMeaningfulText(q.copyright);

      el.qBlurb.innerHTML = showBQC ? q.blurb : "";
      el.qQuote.innerHTML = showBQC ? q.quote : "";
      el.qCopyright.innerHTML = showBQC ? q.copyright : "";

      // Math "equation1/equation2" show above main text if present
      const eq1 = hasMeaningfulText(q.equation1) ? `<div>${q.equation1}</div>` : "";
      const eq2 = hasMeaningfulText(q.equation2) ? `<div>${q.equation2}</div>` : "";

      if (showText) {
        el.qText.innerHTML = `${eq1}${eq2}${q.text}`;
      } else if (showBQC) {
        // When using blurb+quote, q.text is usually empty in your data.
        el.qText.innerHTML = ""; // keep clean
      } else {
        el.qText.innerHTML = `${eq1}${eq2}`; // edge case
      }

      // KaTeX on left
      renderKatexIfAvailable(el.panelLeft);

      // If you annotated this question before, restore annotated HTML over the fresh render
      applySavedLeftHTMLIfAny(q);

      // Re-run KaTeX after restore
      renderKatexIfAvailable(el.panelLeft);
    }

    function clearChoiceSelectionUI() {
      const btns = [el.choiceA, el.choiceB, el.choiceC, el.choiceD];
      for (const b of btns) {
        b.classList.remove("is-selected");
        b.setAttribute("aria-pressed", "false");
      }
    }

    function applyChoiceSelectionUI(letter) {
      clearChoiceSelectionUI();
      const map = { A: el.choiceA, B: el.choiceB, C: el.choiceC, D: el.choiceD };
      const btn = map[letter];
      if (!btn) return;
      btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", "true");
    }

    function renderRight(q) {
      el.qNumber.textContent = `Question ${state.index + 1}`;

      // prompt: for RW usually set, for Math often empty in your data
      if (hasMeaningfulText(q.prompt)) {
        el.prompt.style.display = "";
        el.prompt.innerHTML = safeHTML(q.prompt);
      } else {
        el.prompt.style.display = "none";
        el.prompt.innerHTML = "";
      }

      // MCQ vs SPR
      const spr = isSPR(q);

      // Remove any old SPR UI
      const oldSpr = $("spr-wrap");
      if (oldSpr) oldSpr.remove();

      if (!spr) {
        el.choicesWrap.style.display = "";

        el.optA.innerHTML = safeHTML(q.A);
        el.optB.innerHTML = safeHTML(q.B);
        el.optC.innerHTML = safeHTML(q.C);
        el.optD.innerHTML = safeHTML(q.D);

        const saved = state.answers[q.id];
        if (saved?.type === "mcq") applyChoiceSelectionUI(saved.choice);
        else clearChoiceSelectionUI();
      } else {
        el.choicesWrap.style.display = "none";

        const wrap = document.createElement("div");
        wrap.id = "spr-wrap";
        wrap.className = "spr";
        wrap.innerHTML = `
          <div style="font-weight:800; margin-top: 6px;">Student-Produced Response</div>
          <div class="spr__row">
            <input class="spr__input" id="spr-input" type="text" inputmode="decimal" placeholder="Type your answer..." />
            <button class="spr__btn" id="spr-save" type="button">Save</button>
          </div>
          <div style="opacity:0.8; font-size:0.9rem;">Tip: press Enter to save.</div>
        `;
        el.prompt.insertAdjacentElement("afterend", wrap);

        const input = $("spr-input");
        const saveBtn = $("spr-save");
        const saved = state.answers[q.id];
        if (saved?.type === "spr") input.value = saved.value ?? "";

        const save = () => {
          const v = input.value.trim();
          state.answers[q.id] = { type: "spr", value: v };
          saveAnswers();
          // Update nav grid if open
          if (navDlg.open) renderNavGrid();
        };

        saveBtn.addEventListener("click", save);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") save();
        });
      }

      // KaTeX on right (options/prompt)
      renderKatexIfAvailable(el.panelLeft);
      renderKatexIfAvailable($("panel-right"));
    }

    function renderAll() {
      const q = currentQuestion();
      setTopBar(q);
      setBottomBar();
      renderLeft(q);
      renderRight(q);
      updateDesmosAvailability();
    }

    // -----------------------------
    // Answer selection
    // -----------------------------
    function onChoiceClick(letter) {
      const q = currentQuestion();
      if (isSPR(q)) return; // ignore in SPR mode

      state.answers[q.id] = { type: "mcq", choice: letter };
      saveAnswers();
      applyChoiceSelectionUI(letter);

      if (navDlg.open) renderNavGrid();
    }

    // Event delegation for choices
    el.choicesWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button.choice");
      if (!btn) return;
      const letter = btn.dataset.choice;
      if (!letter) return;
      onChoiceClick(letter);
    });

    // -----------------------------
    // Navigation
    // -----------------------------
    function go(delta) {
      state.index = clamp(state.index + delta, 0, state.questions.length - 1);
      renderAll();
    }

    el.backBtn.addEventListener("click", () => go(-1));
    el.nextBtn.addEventListener("click", () => go(+1));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(+1);

      const k = e.key.toUpperCase();
      if (k === "A" || k === "B" || k === "C" || k === "D") onChoiceClick(k);
    });

    // -----------------------------
    // Question navigator dialog
    // -----------------------------
    function answeredFlag(q) {
      const a = state.answers[q.id];
      if (!a) return false;
      if (a.type === "mcq") return !!a.choice;
      if (a.type === "spr") return hasMeaningfulText(a.value ?? "");
      return false;
    }

    function renderNavGrid() {
      const buttons = state.questions
        .map((q, i) => {
          const answered = answeredFlag(q) ? 1 : 0;
          const current = i === state.index ? 1 : 0;
          return `<button class="qgrid__btn" type="button" data-i="${i}" data-answered="${answered}" data-current="${current}">${i + 1}</button>`;
        })
        .join("");

      navDlg._setBody(`<div class="qgrid">${buttons}</div>`);
      navDlg.querySelector(".qgrid").addEventListener(
        "click",
        (e) => {
          const b = e.target.closest("button.qgrid__btn");
          if (!b) return;
          const i = toInt(b.dataset.i, 0);
          state.index = clamp(i, 0, state.questions.length - 1);
          navDlg.close();
          renderAll();
        },
        { once: true }
      );
    }

    el.navBtn.addEventListener("click", () => {
      renderNavGrid();
      navDlg.showModal();
    });

    // -----------------------------
    // Directions dialog
    // -----------------------------
    function directionsHTML() {
      const isMath = state.groupKey.split("|")[1] === "math";
      if (isMath) {
        return `
          <div style="line-height:1.4;">
            <div style="font-weight:800; margin-bottom:6px;">Math Module Directions</div>
            <ul>
              <li>Work through each question. Some questions may require a student-produced response.</li>
              <li>You can open the Desmos calculator from <b>More</b>.</li>
              <li>Timer is 35 minutes for Math modules.</li>
            </ul>
          </div>
        `;
      }
      return `
        <div style="line-height:1.4;">
          <div style="font-weight:800; margin-bottom:6px;">Reading &amp; Writing Module Directions</div>
          <ul>
            <li>Read the passage/text on the left, then answer the question on the right.</li>
            <li>Select A–D. Your selection is saved locally.</li>
            <li>Timer is 32 minutes for RW modules.</li>
          </ul>
        </div>
      `;
    }

    el.directionsBtn.addEventListener("click", () => {
      directionsDlg._setBody(directionsHTML());
      directionsDlg.showModal();
    });

    // -----------------------------
    // More dialog (toggle Desmos + switch modules)
    // -----------------------------
    function listGroupsHTML() {
      const keys = [...groups.keys()];
      const items = keys
        .map((k) => {
          const [pack, sec, mod] = k.split("|");
          const name = sec === "math" ? "Math" : "Reading & Writing";
          const count = groups.get(k)?.length ?? 0;
          const active = k === state.groupKey ? " (current)" : "";
          return `<button type="button" data-g="${k}" class="dlg__close" style="border-radius:10px; width:100%; text-align:left; padding:10px;">
            Pack ${pack} • ${name} • Module ${mod} • ${count} Q${active}
          </button>`;
        })
        .join("");

      const isMath = state.groupKey.split("|")[1] === "math";
      const desmosBtn = isMath
        ? `<button type="button" id="toggle-desmos" class="dlg__close" style="width:100%; padding:10px; border-radius:10px;">
             ${desmos.style.display === "block" ? "Hide" : "Show"} Desmos Calculator
           </button>`
        : `<div style="opacity:0.7;">Desmos is available only in Math sections.</div>`;

      return `
        <div style="display:grid; gap:10px;">
          ${desmosBtn}
          <div style="font-weight:800;">Switch section/module</div>
          <div style="display:grid; gap:8px;">${items}</div>
        </div>
      `;
    }

    el.moreBtn.addEventListener("click", () => {
      moreDlg._setBody(listGroupsHTML());
      moreDlg.showModal();

      const toggle = moreDlg.querySelector("#toggle-desmos");
      if (toggle) {
        toggle.addEventListener("click", () => {
          if (desmos.style.display === "block") hideDesmos();
          else showDesmos();
          moreDlg.close();
        });
      }

      moreDlg.querySelectorAll("button[data-g]").forEach((b) => {
        b.addEventListener("click", () => {
          const key = b.dataset.g;
          if (!groups.has(key)) return;

          // switch group
          state.groupKey = key;
          state.questions = groups.get(key);
          state.index = 0;

          loadGroupState();
          renderAll();
          moreDlg.close();
        });
      });
    });

    function updateDesmosAvailability() {
      const isMath = state.groupKey.split("|")[1] === "math";
      if (!isMath) hideDesmos();
    }

    // -----------------------------
    // Annotate (simple highlight mode)
    // - Click Annotate: toggles highlight mode
    // - In highlight mode: selecting text inside left panel + mouse up will try to wrap in <mark>
    // - Clicking a highlight removes it
    // -----------------------------
    el.annotateBtn.addEventListener("click", () => {
      state.annotateOn = !state.annotateOn;
      el.annotateBtn.setAttribute("aria-pressed", state.annotateOn ? "true" : "false");
      el.annotateBtn.style.opacity = state.annotateOn ? "1" : "0.7";
    });

    el.panelLeft.addEventListener("mouseup", () => {
      if (!state.annotateOn) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!range || range.collapsed) return;

      // must be inside left panel
      const common = range.commonAncestorContainer;
      if (!el.panelLeft.contains(common.nodeType === 1 ? common : common.parentElement)) return;

      // Avoid tiny selections
      const text = sel.toString().trim();
      if (text.length < 2) return;

      const mark = document.createElement("mark");
      mark.style.background = "rgba(255, 230, 128, 0.9)";
      mark.style.padding = "0 2px";
      mark.style.borderRadius = "4px";

      try {
        range.surroundContents(mark);
        sel.removeAllRanges();
        saveLeftSlots(currentQuestion());
      } catch {
        // This happens when selection spans multiple elements.
        // Keep it honest and practical: user must select within one continuous node.
        sel.removeAllRanges();
      }
    });

    el.panelLeft.addEventListener("click", (e) => {
      const m = e.target.closest("mark");
      if (!m) return;
      // unwrap mark
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      saveLeftSlots(currentQuestion());
    });

    // -----------------------------
    // Timer hide button
    // -----------------------------
    el.timerHideBtn.addEventListener("click", toggleTimerVisibility);

    // -----------------------------
    // Boot group state and first render
    // -----------------------------
    loadGroupState();
    renderAll();
  });
})();
