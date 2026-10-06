/* UI: hash routing between the Newsroom (topics, research, writing desk)
   and the Paper (published articles). */
(function () {
  const { esc, articleHTML, excerpt, readingTime, wordCount, longDate, shortDate } = window.Format;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const app = $("#app");

  const SECTIONS = ["News", "World", "Politics", "Science", "Health", "Technology", "History", "Culture", "Ideas", "Features", "Opinion"];
  const SECTION_FOR = {
    "Current Events": "News", Trending: "Culture", Science: "Science", Tech: "Technology", History: "History",
    Curiosities: "Features", Ideas: "Ideas", Culture: "Culture", Food: "Features", Places: "Features", Nature: "Science",
  };

  let wireFilter = "All";
  let gathering = false;

  // ---------------------------------------------------------------- routing
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    const [view, a, b] = parts;
    if (!view) return location.replace(Store.state.articles.length ? "#/paper" : "#/newsroom");
    document.body.dataset.view = view === "newsroom" || view === "write" || view === "edit" ? "newsroom" : view || "paper";
    $$(".topnav a").forEach((el) => el.classList.toggle("active", el.dataset.view === document.body.dataset.view));
    window.scrollTo(0, 0);

    if (view === "paper" && a === "article") return renderArticle(b);
    if (view === "paper" && a === "section") return renderPaper(b);
    if (view === "paper" && a === "archive") return renderArchive();
    if (view === "paper") return renderPaper();
    if (view === "newsroom") return renderNewsroom(a);
    if (view === "write") return renderWrite({ topicId: a === "new" ? null : a });
    if (view === "edit") return renderWrite({ articleId: a });
    if (view === "settings") return renderSettings();
    location.hash = "#/";
  }
  window.addEventListener("hashchange", route);

  const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 3200);
  }

  // ======================================================================
  // AREA 2 — THE PAPER
  // ======================================================================
  function masthead() {
    const s = Store.state.settings;
    const n = Store.state.articles.length;
    return `
      <header class="masthead">
        <div class="masthead-rule top">
          <span>${esc(longDate(Store.today()))}</span>
          <span class="tagline">${esc(s.tagline)}</span>
          <span>Vol. I · No. ${n}</span>
        </div>
        <h1 class="paper-name"><a href="#/paper">${esc(s.paperName)}</a></h1>
        <nav class="section-nav">
          <a href="#/paper">Front Page</a>
          ${usedSections().map((sec) => `<a href="#/paper/section/${encodeURIComponent(sec)}">${esc(sec)}</a>`).join("")}
          <a href="#/paper/archive">Archive</a>
        </nav>
      </header>`;
  }

  const usedSections = () => SECTIONS.concat(Store.state.articles.map((a) => a.section))
    .filter((s, i, arr) => arr.indexOf(s) === i && Store.state.articles.some((a) => a.section === s));

  function byline(a) {
    const parts = [];
    if (a.byline) parts.push(`By <strong>${esc(a.byline)}</strong>`);
    parts.push(`<time datetime="${esc(a.date)}">${esc(shortDate(a.date))}</time>`);
    parts.push(`${readingTime(a.body)} min read`);
    return parts.join(" · ");
  }

  const figure = (a, cls = "") => a.imageUrl
    ? `<figure class="${cls}"><img src="${esc(a.imageUrl)}" alt="${esc(a.imageCaption || a.headline)}" loading="lazy" onerror="this.closest('figure').remove()">${a.imageCaption && cls === "article-figure" ? `<figcaption>${esc(a.imageCaption)}</figcaption>` : ""}</figure>`
    : "";

  function storyCard(a, size) {
    const href = `#/paper/article/${a.id}`;
    const words = { lead: 1400, second: 260, small: 140 }[size] || 140;
    const teaser = excerpt(a.body, words).split("\n").map((p) => `<p>${esc(p)}</p>`).join("");
    return `
      <article class="story story-${size}">
        ${size !== "small" ? `<a href="${href}" class="story-img">${figure(a)}</a>` : ""}
        <div class="kicker">${esc(a.section)}</div>
        <h2 class="headline"><a href="${href}">${esc(a.headline)}</a></h2>
        ${a.dek && size !== "small" ? `<p class="dek">${esc(a.dek)}</p>` : ""}
        <div class="byline">${byline(a)}</div>
        ${size !== "small" ? `<div class="teaser">${teaser}</div>` : ""}
        ${size === "lead" ? `<a class="continue" href="${href}">Continue reading →</a>` : ""}
      </article>`;
  }

  function renderPaper(section) {
    let articles = Store.sortedArticles();
    if (section) articles = articles.filter((a) => a.section === section);

    if (!Store.state.articles.length) {
      app.innerHTML = `
        <div class="paper">${masthead()}
          <div class="empty-paper">
            <p class="big">Stop the presses — there's nothing here yet.</p>
            <p>Head to the <a href="#/newsroom">Newsroom</a>, pick a topic, write your story, and it will appear on this front page.</p>
          </div>
        </div>`;
      return;
    }

    const [lead, ...rest] = articles;
    const second = rest.slice(0, 4);
    const briefs = rest.slice(4, 12);
    const more = rest.slice(12);

    app.innerHTML = `
      <div class="paper">
        ${masthead()}
        ${section ? `<h2 class="section-title">${esc(section)}</h2>` : ""}
        ${!lead ? `<p class="empty-paper">No stories in this section yet.</p>` : `
        <div class="front">
          <div class="front-main">
            ${storyCard(lead, "lead")}
          </div>
          <aside class="front-side">
            ${second.length ? second.map((a) => storyCard(a, "second")).join("") : `<p class="muted side-empty">More stories will appear here as you write.</p>`}
          </aside>
        </div>
        ${briefs.length ? `
          <h3 class="rule-heading">More Stories</h3>
          <div class="briefs">${briefs.map((a) => storyCard(a, "small")).join("")}</div>` : ""}
        ${more.length ? `
          <h3 class="rule-heading">From the Archive</h3>
          <ul class="archive-list">${more.map(archiveItem).join("")}</ul>` : ""}`}
        ${footer()}
      </div>`;
  }

  const archiveItem = (a) => `
    <li><time>${esc(shortDate(a.date))}</time>
      <a href="#/paper/article/${a.id}">${esc(a.headline)}</a>
      <span class="muted">${esc(a.section)}</span></li>`;

  function renderArchive() {
    const groups = {};
    for (const a of Store.sortedArticles()) {
      const [y, m] = a.date.split("-");
      const key = new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      (groups[key] = groups[key] || []).push(a);
    }
    app.innerHTML = `
      <div class="paper">
        ${masthead()}
        <h2 class="section-title">Archive</h2>
        ${Object.keys(groups).length ? Object.entries(groups).map(([month, list]) => `
          <h3 class="rule-heading">${esc(month)} <span class="muted">· ${list.length} ${list.length === 1 ? "story" : "stories"}</span></h3>
          <ul class="archive-list">${list.map(archiveItem).join("")}</ul>`).join("") : `<p class="empty-paper">No stories yet.</p>`}
        ${footer()}
      </div>`;
  }

  function renderArticle(id) {
    const a = Store.article(id);
    if (!a) return go("#/paper");
    const list = Store.sortedArticles();
    const i = list.findIndex((x) => x.id === id);
    const newer = list[i - 1], older = list[i + 1];
    app.innerHTML = `
      <div class="paper">
        ${masthead()}
        <article class="full-article">
          <div class="kicker"><a href="#/paper/section/${encodeURIComponent(a.section)}">${esc(a.section)}</a></div>
          <h1 class="article-headline">${esc(a.headline)}</h1>
          ${a.dek ? `<p class="article-dek">${esc(a.dek)}</p>` : ""}
          <div class="byline article-byline">${byline(a)}${a.updatedAt ? ` · <span class="muted">Updated ${esc(new Date(a.updatedAt).toLocaleDateString())}</span>` : ""}</div>
          ${figure(a, "article-figure")}
          <div class="article-body">${articleHTML(a.body)}</div>
          ${a.sources && a.sources.length ? `
            <aside class="further-reading">
              <h4>Sources &amp; further reading</h4>
              <ul>${a.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a></li>`).join("")}</ul>
            </aside>` : ""}
          <div class="article-tools">
            <a href="#/edit/${a.id}">Edit</a>
            <button class="linklike" data-act="print">Print</button>
            <button class="linklike danger" data-act="delete">Delete</button>
          </div>
        </article>
        <nav class="article-pager">
          ${older ? `<a href="#/paper/article/${older.id}"><span>← Previous story</span>${esc(older.headline)}</a>` : "<span></span>"}
          ${newer ? `<a class="right" href="#/paper/article/${newer.id}"><span>Next story →</span>${esc(newer.headline)}</a>` : "<span></span>"}
        </nav>
        ${footer()}
      </div>`;
    $("[data-act=print]").onclick = () => window.print();
    $("[data-act=delete]").onclick = () => {
      if (!confirm(`Delete "${a.headline}"? This can't be undone.`)) return;
      Store.deleteArticle(a.id);
      toast("Article deleted.");
      go("#/paper");
    };
  }

  function footer() {
    const s = Store.state.settings;
    const n = Store.state.articles.length;
    const words = Store.state.articles.reduce((sum, a) => sum + wordCount(a.body), 0);
    return `<footer class="paper-footer">
      <span>© ${new Date().getFullYear()} ${esc(s.paperName)}${s.author ? ` · Written by ${esc(s.author)}` : ""}</span>
      <span>${n} ${n === 1 ? "story" : "stories"} · ${words.toLocaleString()} words published</span>
    </footer>`;
  }

  // ======================================================================
  // AREA 1 — THE NEWSROOM
  // ======================================================================
  function renderNewsroom(topicId) {
    const topics = Store.state.topics;
    const cats = ["All", "On my desk", ...new Set(topics.map((t) => t.category))];
    if (!cats.includes(wireFilter)) wireFilter = "All";
    const shown = topics.filter((t) =>
      wireFilter === "All" ? true : wireFilter === "On my desk" ? t.status === "desk" : t.category === wireFilter);
    // Desk topics float to the top.
    shown.sort((x, y) => (y.status === "desk") - (x.status === "desk"));

    app.innerHTML = `
      <div class="newsroom ${topicId ? "has-detail" : ""}">
        <section class="wire">
          <div class="wire-head">
            <div>
              <h2>Topic Wire</h2>
              <p class="muted">${topics.length} topics · ${topics.filter((t) => t.status === "desk").length} on your desk</p>
            </div>
            <div class="wire-actions">
              <button class="btn primary" id="gather" ${gathering ? "disabled" : ""}>${gathering ? "Gathering…" : "↻ Gather topics"}</button>
            </div>
          </div>
          <div class="chips">
            ${cats.map((c) => `<button class="chip ${c === wireFilter ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}${c !== "All" ? ` <span>${c === "On my desk" ? topics.filter((t) => t.status === "desk").length : topics.filter((t) => t.category === c).length}</span>` : ""}</button>`).join("")}
          </div>
          <form class="own-topic" id="own-topic">
            <input name="title" placeholder="Have your own idea? Add a topic…" autocomplete="off">
            <button class="btn">Add</button>
          </form>
          <div class="topic-list">
            ${shown.length ? shown.map((t) => topicCard(t, t.id === topicId)).join("") : `
              <div class="wire-empty">
                ${topics.length ? "Nothing in this category." : `<p class="big">The wire is quiet.</p><p>Click <strong>Gather topics</strong> to pull in current events, new studies, history and more.</p>`}
              </div>`}
          </div>
        </section>
        <section class="detail" id="detail">
          ${topicId ? `<div class="loading">Loading…</div>` : deskIntro()}
        </section>
      </div>`;

    $("#gather").onclick = gather;
    $$(".chip").forEach((b) => (b.onclick = () => { wireFilter = b.dataset.cat; renderNewsroom(topicId); }));
    $("#own-topic").onsubmit = (e) => {
      e.preventDefault();
      const title = e.target.title.value.trim();
      if (!title) return;
      const [t] = Store.addTopics([{ id: "mine-" + Store.uid(), category: "My Topics", kicker: "Your idea", title, blurb: "", source: "Your idea", sourceUrl: "", wikiTitle: "", query: title, status: "desk" }]);
      go(`#/newsroom/${t.id}`);
    };
    $$(".topic-card").forEach((card) => {
      const id = card.dataset.id;
      card.onclick = (e) => { if (!e.target.closest("button, a")) go(`#/newsroom/${id}`); };
      $("[data-act=dismiss]", card).onclick = () => dismiss(id, topicId);
      $("[data-act=dig]", card).onclick = () => go(`#/newsroom/${id}`);
    });

    if (topicId) renderTopicDetail(topicId);
    if (!topics.length && !gathering && !renderNewsroom.autoGathered) { renderNewsroom.autoGathered = true; gather(); }
  }

  function topicCard(t, active) {
    return `
      <div class="topic-card ${active ? "active" : ""} ${t.status === "desk" ? "on-desk" : ""}" data-id="${esc(t.id)}">
        <div class="tc-top">
          <span class="cat cat-${esc(t.category.toLowerCase().replace(/\W+/g, "-"))}">${esc(t.category)}</span>
          ${t.status === "desk" ? `<span class="desk-badge">On desk</span>` : ""}
          <button class="dismiss" data-act="dismiss" title="Dismiss — not interested">✕</button>
        </div>
        ${t.kicker ? `<div class="tc-kicker">${esc(t.kicker)}</div>` : ""}
        <h3>${esc(t.title)}</h3>
        ${t.blurb ? `<p>${esc(t.blurb)}</p>` : ""}
        <div class="tc-foot">
          <span class="muted">${esc(t.source || "")}</span>
          <button class="btn small" data-act="dig">Dig in →</button>
        </div>
      </div>`;
  }

  function deskIntro() {
    const desk = Store.state.topics.filter((t) => t.status === "desk");
    return `
      <div class="desk-intro">
        <h2>Your desk</h2>
        <ol class="steps">
          <li><strong>Browse the wire.</strong> Dismiss (✕) anything you don't care about. Hit <em>Gather topics</em> any time for a fresh batch.</li>
          <li><strong>Dig in.</strong> Pick a topic to get background, coverage, studies and links — plus a notepad for brainstorming.</li>
          <li><strong>Write it wherever you like</strong>, then paste the finished piece into the article form.</li>
          <li><strong>Publish.</strong> It lands in the paper, dated, and your front page fills out.</li>
        </ol>
        ${desk.length ? `<h3>Topics on your desk</h3><ul class="desk-list">${desk.map((t) => `<li><a href="#/newsroom/${esc(t.id)}">${esc(t.title)}</a></li>`).join("")}</ul>` : ""}
        <p><a class="btn" href="#/write/new">Write a story without a topic</a></p>
      </div>`;
  }

  async function gather() {
    if (gathering) return;
    gathering = true;
    const btn = $("#gather");
    if (btn) { btn.disabled = true; btn.textContent = "Gathering…"; }
    try {
      const { topics, failed } = await Sources.gather(Store.state.seen);
      const added = Store.addTopics(topics);
      toast(added.length ? `${added.length} new topics on the wire.` : "No new topics right now — try again later.");
      if (failed.length) console.warn("Some sources didn't respond:", failed.join(", "));
      if (failed.length === 7) toast("Couldn't reach any topic sources. Check your connection.");
    } catch (e) {
      console.error(e);
      toast("Gathering failed: " + e.message);
    } finally {
      gathering = false;
      if (document.body.dataset.view === "newsroom" && !/^#\/(write|edit)/.test(location.hash)) {
        const keep = location.hash.split("/")[2];
        const scroll = $(".topic-list") && $(".topic-list").scrollTop;
        renderNewsroom(keep ? decodeURIComponent(keep) : undefined);
        if (scroll && $(".topic-list")) $(".topic-list").scrollTop = scroll;
      }
    }
  }

  function dismiss(id, currentId) {
    const card = $(`.topic-card[data-id="${CSS.escape(id)}"]`);
    const finish = () => {
      Store.dismissTopic(id);
      if (id === currentId) go("#/newsroom");
      else { card && card.remove(); updateCounts(); }
    };
    if (card) { card.classList.add("leaving"); setTimeout(finish, 220); } else finish();
  }

  function updateCounts() {
    const topics = Store.state.topics;
    const p = $(".wire-head .muted");
    if (p) p.textContent = `${topics.length} topics · ${topics.filter((t) => t.status === "desk").length} on your desk`;
  }

  function linkList(items, empty) {
    if (!items.length) return `<p class="muted">${empty}</p>`;
    return `<ul class="links">${items.map((r) => `
      <li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
        ${r.meta ? `<div class="meta">${esc(r.meta)}</div>` : ""}
        ${r.snippet ? `<div class="meta">${esc(r.snippet)}</div>` : ""}</li>`).join("")}</ul>`;
  }

  async function renderTopicDetail(id, { refresh = false } = {}) {
    const t = Store.topic(id);
    const el = $("#detail");
    if (!t) { el.innerHTML = `<div class="desk-intro"><p>That topic is no longer on the wire.</p><a href="#/newsroom">Back to the wire</a></div>`; return; }

    const header = `
      <div class="detail-head">
        <a href="#/newsroom" class="back">← Wire</a>
        <span class="cat">${esc(t.category)}</span>
        ${t.kicker ? `<span class="muted"> · ${esc(t.kicker)}</span>` : ""}
        <h2>${esc(t.title)}</h2>
        ${t.blurb ? `<p class="lede">${esc(t.blurb)}</p>` : ""}
        <div class="detail-actions">
          <a class="btn primary" href="#/write/${encodeURIComponent(t.id)}">✎ Submit article</a>
          <button class="btn" data-act="desk">${t.status === "desk" ? "★ On your desk" : "☆ Save to desk"}</button>
          <button class="btn" data-act="refresh">↻ Refresh research</button>
          <button class="btn ghost" data-act="dismiss">Dismiss</button>
        </div>
      </div>`;

    if (!t.research || refresh) {
      el.innerHTML = header + `<div class="loading">Pulling together background, coverage and studies…</div>`;
      wireDetail(t);
      if (t.status !== "desk") {
        Store.setTopicStatus(t.id, "desk");
        const card = $(`.topic-card[data-id="${CSS.escape(t.id)}"]`);
        if (card) {
          card.classList.add("on-desk");
          $(".cat", card).insertAdjacentHTML("afterend", `<span class="desk-badge">On desk</span>`);
        }
        updateCounts();
      }
      const research = await Sources.research(t);
      if (!Store.topic(id)) return;
      Store.setResearch(id, research);
      if (!decodeURIComponent(location.hash).endsWith("/" + id)) return; // user moved on
      return renderTopicDetail(id);
    }

    const r = t.research;
    const s = r.summary;
    const notes = Store.state.notes[t.id] || "";
    el.innerHTML = header + `
      <div class="research">
        <div class="r-block original">
          <h4>Where this came from</h4>
          <ul class="links">
            ${t.sourceUrl ? `<li><a href="${esc(t.sourceUrl)}" target="_blank" rel="noopener">${esc(t.source || t.sourceUrl)}</a></li>` : `<li class="muted">Your own idea.</li>`}
            ${t.discussionUrl ? `<li><a href="${esc(t.discussionUrl)}" target="_blank" rel="noopener">Discussion thread</a></li>` : ""}
          </ul>
        </div>

        ${s ? `
        <div class="r-block background">
          <h4>Background</h4>
          <div class="summary">
            ${s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
            <div>
              <h5><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></h5>
              ${s.description ? `<div class="meta">${esc(s.description)}</div>` : ""}
              <p>${esc(s.extract)}</p>
              <a href="${esc(s.url)}" target="_blank" rel="noopener">Read the full Wikipedia article →</a>
            </div>
          </div>
        </div>` : ""}

        <div class="r-block brainstorm">
          <h4>Brainstorm</h4>
          <ul class="angles">${r.angles.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
          <textarea id="notes" placeholder="Jot down angles, questions, quotes, an outline…">${esc(notes)}</textarea>
          <div class="meta" id="notes-status">Notes save automatically.</div>
        </div>

        <div class="r-grid">
          <div class="r-block"><h4>Recent coverage</h4>${linkList(r.coverage, "No recent coverage found — try the searches below.")}</div>
          <div class="r-block"><h4>Related reading</h4>${linkList(r.related.filter((x) => !s || x.title !== s.title), "No related articles found.")}</div>
          <div class="r-block"><h4>Studies &amp; papers</h4>${linkList(r.studies, "No research papers found for this topic.")}</div>
          <div class="r-block"><h4>Discussions</h4>${linkList(r.discussions, "No discussions found.")}</div>
        </div>

        <div class="r-block">
          <h4>Search further</h4>
          <form class="requery" id="requery"><input name="q" value="${esc(r.query)}" aria-label="Search terms"><button class="btn small">Search again</button></form>
          <div class="search-links">${r.searchLinks.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}</div>
        </div>
        <p class="meta">Research gathered ${esc(new Date(r.fetchedAt).toLocaleString())}.</p>
      </div>`;
    wireDetail(t);

    const ta = $("#notes");
    let timer;
    ta.oninput = () => {
      clearTimeout(timer);
      $("#notes-status").textContent = "Saving…";
      timer = setTimeout(() => { Store.setNotes(t.id, ta.value); $("#notes-status").textContent = "Saved."; }, 400);
    };
    $("#requery").onsubmit = (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      if (!q) return;
      t.query = q;
      t.wikiTitle = "";
      Store.save();
      renderTopicDetail(t.id, { refresh: true });
    };
  }

  function wireDetail(t) {
    const el = $("#detail");
    $("[data-act=desk]", el).onclick = () => {
      Store.setTopicStatus(t.id, t.status === "desk" ? "new" : "desk");
      renderNewsroom(t.id);
    };
    $("[data-act=refresh]", el).onclick = () => renderTopicDetail(t.id, { refresh: true });
    $("[data-act=dismiss]", el).onclick = () => dismiss(t.id, t.id);
  }

  // ---------------------------------------------------------------- write / edit
  function renderWrite({ topicId, articleId }) {
    const editing = articleId ? Store.article(articleId) : null;
    if (articleId && !editing) return go("#/paper");
    const topic = topicId ? Store.topic(topicId) : null;
    if (topicId && !topic) return go("#/newsroom");
    const s = Store.state.settings;
    const research = topic && topic.research;

    const suggestedSources = [];
    if (topic) {
      if (topic.sourceUrl) suggestedSources.push({ title: topic.source || topic.sourceUrl, url: topic.sourceUrl });
      if (research && research.summary) suggestedSources.push({ title: `Wikipedia: ${research.summary.title}`, url: research.summary.url });
      if (research) [...research.coverage.slice(0, 4), ...research.studies.slice(0, 3)].forEach((x) => suggestedSources.push({ title: x.title, url: x.url }));
    }

    const draft = (topicId && Store.state.drafts[topicId]) || {};
    const v = editing || {
      headline: topic ? topic.title.replace(/ — .*$/, "") : "",
      dek: "",
      byline: s.author,
      section: topic ? SECTION_FOR[topic.category] || "Features" : "News",
      date: Store.today(),
      imageUrl: topic ? (research && research.summary && research.summary.image) || topic.image || "" : "",
      imageCaption: "",
      body: "",
      sources: [],
      ...draft,
    };
    const seenSrc = new Set();
    for (let i = suggestedSources.length - 1; i >= 0; i--) {
      const k = suggestedSources[i].title.toLowerCase();
      if (seenSrc.has(k) || seenSrc.has(suggestedSources[i].url)) suggestedSources.splice(i, 1);
      else { seenSrc.add(k); seenSrc.add(suggestedSources[i].url); }
    }
    // New articles start with every suggested source ticked; edits keep what was saved.
    if (!editing && !draft.sources) v.sources = suggestedSources;
    const chosen = new Set((v.sources || []).map((x) => x.url));
    const allSources = [...(v.sources || []), ...suggestedSources.filter((x) => !chosen.has(x.url))];
    const sectionOpts = SECTIONS.includes(v.section) ? SECTIONS : [...SECTIONS, v.section];

    app.innerHTML = `
      <div class="write">
        <div class="write-head">
          <a class="back" href="${editing ? `#/paper/article/${editing.id}` : topic ? `#/newsroom/${encodeURIComponent(topic.id)}` : "#/newsroom"}">← Back</a>
          <h2>${editing ? "Edit article" : "Submit your article"}</h2>
          ${topic ? `<p class="muted">Topic: ${esc(topic.title)}</p>` : ""}
        </div>
        <form id="article-form" class="article-form">
          <div class="form-main">
            <label>Headline<input name="headline" required value="${esc(v.headline)}" class="input-headline"></label>
            <label>Subheadline <span class="muted">(optional — a one-sentence summary under the headline)</span><input name="dek" value="${esc(v.dek)}"></label>
            <label>Article text
              <textarea name="body" required rows="22" placeholder="Paste your finished article here.">${esc(v.body)}</textarea>
            </label>
            <details class="format-help"><summary>Formatting tips</summary>
              <p>Each line becomes a paragraph. You can also use:
              <code>## Subheading</code> · <code>&gt; Pull quote</code> · <code>- list item</code> · <code>---</code> section break ·
              <code>**bold**</code> · <code>*italic*</code> · <code>[link text](https://…)</code></p>
            </details>
            <div class="meta" id="wc"></div>
          </div>
          <div class="form-side">
            <label>Byline<input name="byline" value="${esc(v.byline)}" placeholder="Your name"></label>
            <label>Section<select name="section">${sectionOpts.map((x) => `<option ${x === v.section ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
            <label>Date<input type="date" name="date" required value="${esc(v.date)}"></label>
            <label>Image URL <span class="muted">(optional)</span><input name="imageUrl" value="${esc(v.imageUrl)}" placeholder="https://…"></label>
            <div class="img-preview">${v.imageUrl ? `<img src="${esc(v.imageUrl)}" alt="" onerror="this.remove()">` : ""}</div>
            <label>Image caption<input name="imageCaption" value="${esc(v.imageCaption)}"></label>
            ${allSources.length ? `
            <fieldset class="sources-pick"><legend>Sources to list under the article</legend>
              ${allSources.map((x, i) => `<label class="check"><input type="checkbox" name="src" value="${i}" ${chosen.has(x.url) ? "checked" : ""}> <span>${esc(x.title)}</span></label>`).join("")}
            </fieldset>` : ""}
            <div class="form-buttons">
              <button type="button" class="btn" id="preview-btn">Preview</button>
              <button class="btn primary">${editing ? "Save changes" : "Publish to the paper"}</button>
            </div>
          </div>
        </form>
        <div id="preview" class="preview paper" hidden></div>
      </div>`;

    const form = $("#article-form");
    const read = () => {
      const fd = new FormData(form);
      return {
        headline: fd.get("headline").trim(),
        dek: fd.get("dek").trim(),
        byline: fd.get("byline").trim(),
        section: fd.get("section"),
        date: fd.get("date"),
        imageUrl: fd.get("imageUrl").trim(),
        imageCaption: fd.get("imageCaption").trim(),
        body: fd.get("body").replace(/\s+$/, ""),
        sources: fd.getAll("src").map((i) => allSources[+i]),
      };
    };
    const updateWc = () => {
      const body = form.body.value;
      $("#wc").textContent = `${wordCount(body).toLocaleString()} words · about ${readingTime(body)} min read`;
    };
    updateWc();
    let t;
    form.oninput = (e) => {
      updateWc();
      if (e.target.name === "imageUrl") {
        $(".img-preview").innerHTML = e.target.value.trim() ? `<img src="${esc(e.target.value.trim())}" alt="" onerror="this.remove()">` : "";
      }
      if (!editing && topicId) { clearTimeout(t); t = setTimeout(() => Store.setDraft(topicId, read()), 400); }
    };
    $("#preview-btn").onclick = () => {
      const a = read();
      const p = $("#preview");
      p.hidden = false;
      p.innerHTML = `<div class="preview-label">Preview</div>
        <article class="full-article">
          <div class="kicker">${esc(a.section)}</div>
          <h1 class="article-headline">${esc(a.headline || "Untitled")}</h1>
          ${a.dek ? `<p class="article-dek">${esc(a.dek)}</p>` : ""}
          <div class="byline article-byline">${byline(a)}</div>
          ${figure(a, "article-figure")}
          <div class="article-body">${articleHTML(a.body)}</div>
        </article>`;
      p.scrollIntoView({ behavior: "smooth" });
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const a = read();
      if (!a.body.trim()) return toast("Paste in your article text first.");
      if (a.byline && !s.author) Store.updateSettings({ author: a.byline });
      const id = Store.publish(editing ? { ...a, id: editing.id } : { ...a, topicId: topicId || null });
      toast(editing ? "Changes saved." : "Published! Your story is in the paper.");
      go(`#/paper/article/${id}`);
    };
  }

  // ---------------------------------------------------------------- settings
  function renderSettings() {
    const s = Store.state.settings;
    app.innerHTML = `
      <div class="settings">
        <h2>Settings</h2>
        <form id="settings-form">
          <label>Newspaper name<input name="paperName" value="${esc(s.paperName)}" required></label>
          <label>Tagline<input name="tagline" value="${esc(s.tagline)}"></label>
          <label>Default byline<input name="author" value="${esc(s.author)}" placeholder="Your name"></label>
          <button class="btn primary">Save</button>
        </form>
        <h3>Backup</h3>
        <p class="muted">Everything is stored in this browser only. Export a backup now and then — and to move your paper to another device.</p>
        <div class="row">
          <button class="btn" id="export">Export backup</button>
          <label class="btn">Import backup<input type="file" id="import" accept="application/json,.json" hidden></label>
        </div>
        <h3>Topic wire</h3>
        <div class="row">
          <button class="btn" id="clear-wire">Clear all undesked topics</button>
          <button class="btn" id="forget">Forget dismissed topics</button>
        </div>
      </div>`;
    $("#settings-form").onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      Store.updateSettings({ paperName: fd.get("paperName").trim(), tagline: fd.get("tagline").trim(), author: fd.get("author").trim() });
      toast("Settings saved.");
    };
    $("#export").onclick = () => {
      const blob = new Blob([Store.exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `paper-backup-${Store.today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $("#import").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm("Replace everything in this browser with the backup?")) return;
      try { Store.importJSON(await file.text()); toast("Backup restored."); go("#/paper"); }
      catch (err) { alert(err.message); }
    };
    $("#clear-wire").onclick = () => {
      Store.state.topics.filter((t) => t.status !== "desk").forEach((t) => Store.dismissTopic(t.id));
      toast("Wire cleared.");
    };
    $("#forget").onclick = () => {
      Store.state.seen = Store.state.topics.map((t) => t.id);
      Store.save();
      toast("Dismissed topics may show up again in future gathers.");
    };
  }

  route();
})();
