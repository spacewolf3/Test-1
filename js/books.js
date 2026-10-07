/* The Bookshelf: books you've read, guided review prompts, and turning your
   answers into a review draft for the paper. Book search uses Open Library. */
(function () {
  const { esc } = window.Format;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // kind: "all" | "fiction" | "nonfiction"
  const PROMPTS = [
    { group: "The basics", id: "about", kind: "all", q: "In one or two sentences, what is this book about?", hint: "Imagine telling a friend over dinner." },
    { group: "The basics", id: "why", kind: "all", q: "Why did you pick it up?", hint: "A recommendation, a review, the cover, a subject you care about?" },
    { group: "Summary", id: "premise", kind: "fiction", q: "What's the setup? Who is it about, and what do they want?", hint: "Stay spoiler-free past the first act." },
    { group: "Summary", id: "argument", kind: "nonfiction", q: "What's the author's central argument or big idea?", hint: "If the book had a thesis statement, what would it be?" },
    { group: "Summary", id: "shape", kind: "fiction", q: "How does the story unfold?", hint: "Pacing, structure, point of view, timelines." },
    { group: "Summary", id: "shape_nf", kind: "nonfiction", q: "How does the author make the case?", hint: "Research, interviews, history, personal stories? How is the book organized?" },
    { group: "Craft", id: "characters", kind: "fiction", q: "Which character felt most alive, and why?", hint: "Or which one never quite came to life?" },
    { group: "Craft", id: "setting", kind: "fiction", q: "How does the setting shape the story?", hint: "Time, place, the rules of the world." },
    { group: "Craft", id: "evidence", kind: "nonfiction", q: "Did the author convince you?", hint: "What was the strongest evidence, and the weakest?" },
    { group: "Craft", id: "style", kind: "all", q: "How would you describe the writing?", hint: "Spare, lush, funny, academic, breathless? A short example helps." },
    { group: "Craft", id: "author", kind: "all", q: "What should readers know about the author?", hint: "Their background, other books, why they wrote this one." },
    { group: "Your reaction", id: "themes", kind: "fiction", q: "What is the book really about, underneath the plot?", hint: "Grief, ambition, class, belonging…" },
    { group: "Your reaction", id: "changed", kind: "nonfiction", q: "Has it changed how you think, or what you'll do?", hint: "One idea you'll keep." },
    { group: "Your reaction", id: "stayed", kind: "all", q: "What has stayed with you since you finished it?", hint: "A scene, an idea, a feeling." },
    { group: "Your reaction", id: "surprised", kind: "all", q: "What surprised you?", hint: "" },
    { group: "Your reaction", id: "quote", kind: "all", q: "A line or passage worth quoting", hint: "This becomes a pull quote in your review. Paste it without quotation marks.", short: true },
    { group: "Your reaction", id: "fell_short", kind: "all", q: "What didn't work for you?", hint: "Every book has a weak spot. Be fair, be specific." },
    { group: "The verdict", id: "compare", kind: "all", q: "How does it compare with other books you've read?", hint: "By the same author, in the same genre, or on the same subject." },
    { group: "The verdict", id: "who", kind: "all", q: "Who should read this, and who should skip it?", hint: "" },
    { group: "The verdict", id: "verdict", kind: "all", q: "Your verdict, in one sentence.", hint: "This becomes the subheadline of your review.", short: true },
  ];
  const promptsFor = (kind) => PROMPTS.filter((p) => p.kind === "all" || p.kind === kind);

  const STATUS = { finished: "Finished", reading: "Reading", want: "Want to read" };
  const stars = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
  const coverUrl = (id, size = "L") => (id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : "");

  async function searchOpenLibrary(q) {
    const fields = "key,title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,subject";
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=${fields}`);
    if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
    const data = await res.json();
    return (data.docs || []).map((d) => {
      const subjects = (d.subject || []).slice(0, 40);
      const isFiction = subjects.some((s) => /fiction|novel/i.test(s)) && !subjects.some((s) => /^nonfiction|non-fiction/i.test(s));
      return {
        title: d.subtitle && d.title.length < 30 ? `${d.title}: ${d.subtitle}` : d.title,
        author: (d.author_name || []).slice(0, 2).join(" & "),
        year: d.first_publish_year || "",
        pages: d.number_of_pages_median || "",
        cover: coverUrl(d.cover_i),
        olUrl: `https://openlibrary.org${d.key}`,
        kind: isFiction ? "fiction" : "nonfiction",
      };
    });
  }

  /** Turn a book's answers into a review draft for the article form. */
  function buildDraft(book) {
    const a = book.answers || {};
    const has = (k) => a[k] && a[k].trim();
    const paras = (...keys) => keys.filter(has).map((k) => a[k].trim());
    const out = [];
    out.push(...paras("about", "why"));
    out.push(...(book.kind === "fiction" ? paras("premise", "shape") : paras("argument", "shape_nf")));
    const craft = book.kind === "fiction" ? paras("characters", "setting", "style", "author") : paras("evidence", "style", "author");
    if (craft.length) out.push("## On the page", ...craft);
    const reaction = book.kind === "fiction" ? paras("themes", "stayed", "surprised") : paras("changed", "stayed", "surprised");
    if (reaction.length || has("quote")) {
      out.push("## What stays with you", ...reaction.slice(0, 1));
      if (has("quote")) out.push(`> “${a.quote.trim().replace(/^["“”]+|["“”]+$/g, "")}”`);
      out.push(...reaction.slice(1));
    }
    if (has("fell_short")) out.push("## Where it falls short", a.fell_short.trim());
    const verdict = paras("compare", "who");
    if (verdict.length || book.rating) {
      out.push("## The verdict", ...verdict);
      if (book.rating) out.push(`**Rating: ${book.rating} out of 5**`);
    }
    const byline = book.author ? ` by ${book.author}` : "";
    return {
      headline: `Review: ${book.title}${byline}`,
      dek: has("verdict") ? a.verdict.trim() : "",
      section: "Books",
      body: out.join("\n\n"),
      sources: book.olUrl ? [{ title: `Open Library: ${book.title}`, url: book.olUrl }] : [],
    };
  }

  /** Snapshot of the book stored on the published article. */
  const bookInfo = (b) => ({ title: b.title, author: b.author, year: b.year, pages: b.pages, cover: b.cover, rating: b.rating || 0, olUrl: b.olUrl });

  // ======================================================================
  // Shelf
  // ======================================================================
  let shelfFilter = "all";

  // The title sits behind the image, so a missing or broken cover still shows something.
  function coverHTML(b, cls = "cover") {
    return `<div class="${cls} cover-blank"><span>${esc(b.title)}</span>${b.cover ? `<img src="${esc(b.cover)}" alt="Cover of ${esc(b.title)}" loading="lazy" onerror="this.remove()">` : ""}</div>`;
  }

  function renderShelf(app) {
    const books = Store.state.books;
    const year = String(new Date().getFullYear());
    const finished = books.filter((b) => b.status === "finished");
    const rated = finished.filter((b) => b.rating);
    const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : "–";
    const filters = {
      all: ["All", () => true],
      toreview: ["To review", (b) => b.status === "finished" && !b.reviewId],
      reviewed: ["Reviewed", (b) => !!b.reviewId],
      reading: ["Reading", (b) => b.status === "reading"],
      want: ["Want to read", (b) => b.status === "want"],
    };
    const shown = books.filter(filters[shelfFilter][1]).sort((x, y) => (y.dateFinished || y.addedAt || "").toString().localeCompare((x.dateFinished || x.addedAt || "").toString()));

    app.innerHTML = `
      <div class="shelf">
        <div class="shelf-head">
          <div>
            <h2>Bookshelf</h2>
            <p class="muted">Add the books you've read, answer a few questions, and turn your answers into a review for the paper.</p>
          </div>
          <div class="shelf-stats">
            <div><strong>${finished.length}</strong><span>books read</span></div>
            <div><strong>${finished.filter((b) => (b.dateFinished || "").startsWith(year)).length}</strong><span>in ${year}</span></div>
            <div><strong>${books.filter((b) => b.reviewId).length}</strong><span>reviewed</span></div>
            <div><strong>${avg}</strong><span>avg. rating</span></div>
          </div>
        </div>

        <div class="add-book">
          <form id="book-search" class="book-search">
            <input name="q" placeholder="Add a book — search by title or author…" autocomplete="off" required>
            <button class="btn primary">Search</button>
          </form>
          <div id="book-results"></div>
          <button class="linklike muted small-link" id="manual-toggle">Can't find it? Add it by hand</button>
          <form id="manual-book" class="manual-book" hidden>
            <input name="title" placeholder="Title" required>
            <input name="author" placeholder="Author">
            <select name="kind"><option value="fiction">Fiction</option><option value="nonfiction">Nonfiction</option></select>
            <button class="btn">Add book</button>
          </form>
        </div>

        <div class="chips">
          ${Object.entries(filters).map(([k, [label, fn]]) => `<button class="chip ${k === shelfFilter ? "on" : ""}" data-f="${k}">${label} <span>${books.filter(fn).length}</span></button>`).join("")}
        </div>

        ${shown.length ? `<div class="book-grid">${shown.map((b) => `
          <a class="book-tile" href="#/books/${b.id}">
            ${coverHTML(b)}
            <span class="badge ${b.reviewId ? "reviewed" : b.status}">${b.reviewId ? "Reviewed" : b.status === "finished" ? "To review" : STATUS[b.status]}</span>
            <div class="bt-title">${esc(b.title)}</div>
            <div class="bt-author">${esc(b.author || "")}</div>
            ${b.rating ? `<div class="stars">${stars(b.rating)}</div>` : ""}
          </a>`).join("")}</div>`
        : `<div class="wire-empty">${books.length ? "No books here." : `<p class="big">Your shelf is empty.</p><p>Search for a book you've read to get started.</p>`}</div>`}
      </div>`;

    $$(".chip", app).forEach((c) => (c.onclick = () => { shelfFilter = c.dataset.f; renderShelf(app); }));
    $("#manual-toggle").onclick = () => { $("#manual-book").hidden = !$("#manual-book").hidden; };
    $("#manual-book").onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      addBook({ title: fd.get("title").trim(), author: fd.get("author").trim(), kind: fd.get("kind"), year: "", pages: "", cover: "", olUrl: "" });
    };
    $("#book-search").onsubmit = async (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      const box = $("#book-results");
      box.innerHTML = `<div class="loading">Searching Open Library…</div>`;
      try {
        const results = await searchOpenLibrary(q);
        if (!results.length) { box.innerHTML = `<p class="muted">No matches. Try different words, or add it by hand.</p>`; return; }
        box.innerHTML = `<ul class="book-results">${results.map((r, i) => `
          <li>
            ${coverHTML(r, "cover-sm")}
            <div class="br-info"><strong>${esc(r.title)}</strong><div class="meta">${esc([r.author, r.year, r.pages && `${r.pages} pages`].filter(Boolean).join(" · "))}</div></div>
            <button class="btn small" data-i="${i}">+ Add</button>
          </li>`).join("")}</ul>`;
        $$("[data-i]", box).forEach((b) => (b.onclick = () => addBook(results[+b.dataset.i])));
      } catch (err) {
        box.innerHTML = `<p class="muted">Couldn't reach Open Library (${esc(err.message)}). You can add the book by hand.</p>`;
        $("#manual-book").hidden = false;
      }
    };
  }

  function addBook(info) {
    const id = Store.addBook({ ...info, status: "finished", dateFinished: Store.today(), rating: 0, answers: {} });
    App.toast(`Added “${info.title}” to your shelf.`);
    App.go(`#/books/${id}`);
  }

  // ======================================================================
  // One book: details + review prompts
  // ======================================================================
  function renderBook(app, id) {
    const b = Store.book(id);
    if (!b) return App.go("#/books");
    const prompts = promptsFor(b.kind);
    const answered = prompts.filter((p) => (b.answers[p.id] || "").trim()).length;
    const groups = [...new Set(prompts.map((p) => p.group))];

    app.innerHTML = `
      <div class="book-page">
        <aside class="book-side">
          <a href="#/books" class="back">← Bookshelf</a>
          ${coverHTML(b, "cover-lg")}
          <h2>${esc(b.title)}</h2>
          <div class="muted">${esc([b.author, b.year].filter(Boolean).join(" · "))}${b.pages ? ` · ${esc(b.pages)} pages` : ""}</div>
          ${b.olUrl ? `<a class="small-link" href="${esc(b.olUrl)}" target="_blank" rel="noopener">View on Open Library →</a>` : ""}
          <div class="rating" role="radiogroup" aria-label="Your rating">
            ${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${n <= (b.rating || 0) ? "on" : ""}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}
          </div>
          <label>Status<select id="b-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === b.status ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <label>Date finished<input type="date" id="b-date" value="${esc(b.dateFinished || "")}"></label>
          <label>Type<select id="b-kind"><option value="fiction" ${b.kind === "fiction" ? "selected" : ""}>Fiction</option><option value="nonfiction" ${b.kind === "nonfiction" ? "selected" : ""}>Nonfiction</option></select></label>
          <button class="linklike danger small-link" id="b-delete">Remove from shelf</button>
        </aside>

        <section class="book-prompts">
          <div class="bp-head">
            <div>
              <h3>Your review notes</h3>
              <p class="muted">Answer as many as you like. Short is fine. Your answers save as you type.</p>
            </div>
            <div class="progress"><div class="bar"><span style="width:${Math.round((answered / prompts.length) * 100)}%"></span></div><span id="progress-label">${answered} of ${prompts.length} answered</span></div>
          </div>
          ${groups.map((g) => `
            <fieldset class="prompt-group"><legend>${esc(g)}</legend>
              ${prompts.filter((p) => p.group === g).map((p) => `
                <label class="prompt">
                  <span class="q">${esc(p.q)}</span>
                  ${p.hint ? `<span class="hint">${esc(p.hint)}</span>` : ""}
                  <textarea data-p="${p.id}" rows="${p.short ? 2 : 4}">${esc(b.answers[p.id] || "")}</textarea>
                </label>`).join("")}
            </fieldset>`).join("")}
          <div class="bp-foot">
            ${b.reviewId && Store.article(b.reviewId) ? `
              <a class="btn" href="#/paper/article/${b.reviewId}">Read your published review</a>
              <a class="btn" href="#/edit/${b.reviewId}">Edit published review</a>` : ""}
            <a class="btn primary" href="#/write/book/${b.id}">${b.reviewId ? "Rebuild review from notes →" : "Turn my notes into a review →"}</a>
          </div>
        </section>
      </div>`;

    const save = (patch) => Store.updateBook(b.id, patch);
    $$("[data-star]", app).forEach((btn) => (btn.onclick = () => {
      const n = +btn.dataset.star;
      save({ rating: b.rating === n ? 0 : n });
      $$("[data-star]", app).forEach((s) => s.classList.toggle("on", +s.dataset.star <= b.rating));
    }));
    $("#b-status").onchange = (e) => save({ status: e.target.value });
    $("#b-date").onchange = (e) => save({ dateFinished: e.target.value });
    $("#b-kind").onchange = (e) => { save({ kind: e.target.value }); renderBook(app, id); };
    $("#b-delete").onclick = () => {
      if (!confirm(`Remove “${b.title}” and your notes from the shelf? A published review stays in the paper.`)) return;
      Store.deleteBook(b.id);
      App.go("#/books");
    };
    let t;
    const boxes = $$("textarea[data-p]", app); // kept as references so a save after navigating still reads this book's boxes
    window.addEventListener("hashchange", () => { if (t) { clearTimeout(t); const answers = { ...b.answers }; boxes.forEach((x) => { answers[x.dataset.p] = x.value; }); save({ answers }); } }, { once: true });
    // Leaving a box (e.g. clicking "Turn my notes into a review") saves right away.
    boxes.forEach((ta) => (ta.onchange = () => {
      if (!t) return;
      clearTimeout(t);
      t = null;
      const answers = { ...b.answers };
      boxes.forEach((x) => { answers[x.dataset.p] = x.value; });
      save({ answers });
    }));
    boxes.forEach((ta) => (ta.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        // Save every box, not just this one, so quick edits across boxes are never lost.
        const answers = { ...b.answers };
        boxes.forEach((x) => { answers[x.dataset.p] = x.value; });
        save({ answers });
        const n = prompts.filter((p) => (b.answers[p.id] || "").trim()).length;
        $("#progress-label").textContent = `${n} of ${prompts.length} answered`;
        $(".progress .bar span").style.width = `${Math.round((n / prompts.length) * 100)}%`;
      }, 350);
    }));
  }

  window.Books = { PROMPTS, promptsFor, buildDraft, bookInfo, stars, renderShelf, renderBook, coverHTML };
})();
