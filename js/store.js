/* Persistence: everything lives in localStorage under one key.
   Export/import in Settings is the backup path, and js/sync.js can mirror it
   to a private GitHub repo.

   For syncing, every save records when each item last changed (stamps) or was
   removed (deleted), keyed like "article:<id>". That lets two devices' copies
   be merged item by item instead of one overwriting the other. */
(function () {
  const KEY = "personal-paper.v1";

  const defaults = () => ({
    settings: {
      paperName: "The Daily Dispatch",
      tagline: "All the news one person saw fit to write",
      author: "",
    },
    topics: [],   // {id, title, kicker, blurb, category, source, sourceUrl, wikiTitle, query, addedAt, status: 'new'|'desk', research?}
    seen: [],     // ids ever added or dismissed, so gathers don't repeat them
    notes: {},    // topicId -> brainstorm text
    drafts: {},   // topicId -> unpublished article form contents
    feedPrefs: { disabled: [], custom: [] }, // feed URLs turned off, and feeds you added
    books: [],    // {id, title, author, year, pages, cover, olUrl, kind, status, dateFinished, rating, answers, reviewId}
    articles: [], // {id, topicId, headline, dek, byline, section, date, imageUrl, imageCaption, body, sources, publishedAt, updatedAt}
    stamps: {},   // "kind:id" -> last time that item changed
    deleted: {},  // "kind:id" -> time that item was removed
  });

  // What gets tracked for merging: lists of items with ids, maps keyed by id, and whole objects.
  const LISTS = { topics: "topic", articles: "article", books: "book" };
  const MAPS = { notes: "note", drafts: "draft" };
  const OBJECTS = ["settings", "feedPrefs"];

  /** Every tracked item in a state, as "kind:id" -> JSON text. */
  function snapshot(st) {
    const out = {};
    for (const [field, kind] of Object.entries(LISTS)) for (const it of st[field] || []) out[`${kind}:${it.id}`] = JSON.stringify(it);
    for (const [field, kind] of Object.entries(MAPS)) for (const [k, v] of Object.entries(st[field] || {})) out[`${kind}:${k}`] = JSON.stringify(v);
    for (const field of OBJECTS) out[`${field}:`] = JSON.stringify(st[field]);
    return out;
  }

  let state = load();
  let lastSnapshot = snapshot(state);
  const listeners = [];

  function normalize(parsed) {
    const base = defaults();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      feedPrefs: { ...base.feedPrefs, ...(parsed.feedPrefs || {}) },
      stamps: parsed.stamps || {},
      deleted: parsed.deleted || {},
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return normalize(JSON.parse(raw));
    } catch (e) {
      console.warn("Could not read saved data; starting fresh.", e);
      return defaults();
    }
  }

  /** Record which items changed or disappeared since the last save. */
  function track() {
    const now = Date.now();
    const snap = snapshot(state);
    for (const [key, json] of Object.entries(snap)) {
      if (lastSnapshot[key] !== json) { state.stamps[key] = now; delete state.deleted[key]; }
    }
    for (const key of Object.keys(lastSnapshot)) {
      if (!(key in snap)) { state.deleted[key] = now; delete state.stamps[key]; }
    }
    lastSnapshot = snap;
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      alert("Saving failed — your browser storage may be full or disabled. Export a backup from Settings.");
    }
  }

  function save() {
    track();
    write();
    listeners.forEach((fn) => fn());
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const Store = {
    get state() { return state; },
    save,
    onSave(fn) { listeners.push(fn); },
    LISTS, MAPS, OBJECTS, normalize,
    /** Swap in a merged state from sync. Its stamps are already correct, so nothing is re-stamped. */
    replaceState(next) {
      state = normalize(next);
      lastSnapshot = snapshot(state);
      write();
    },
    uid,
    today,

    // ---- topics ----
    addTopics(list) {
      const seen = new Set(state.seen);
      const added = [];
      for (const t of list) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        added.push({ status: "new", addedAt: Date.now(), ...t });
      }
      state.seen = [...seen].slice(-5000);
      state.topics = [...added, ...state.topics];
      save();
      return added;
    },
    topic(id) { return state.topics.find((t) => t.id === id); },
    dismissTopic(id) {
      state.topics = state.topics.filter((t) => t.id !== id);
      delete state.notes[id];
      delete state.drafts[id];
      save();
    },
    setTopicStatus(id, status) {
      const t = Store.topic(id);
      if (t) { t.status = status; save(); }
    },
    setResearch(id, research) {
      const t = Store.topic(id);
      if (t) { t.research = research; save(); }
    },
    setNotes(id, text) { state.notes[id] = text; save(); },
    setDraft(id, draft) { state.drafts[id] = draft; save(); },

    // ---- books ----
    book(id) { return state.books.find((b) => b.id === id); },
    addBook(book) {
      const id = uid();
      state.books.push({ ...book, id, addedAt: Date.now() });
      save();
      return id;
    },
    updateBook(id, patch) {
      const b = Store.book(id);
      if (b) { Object.assign(b, patch); save(); }
    },
    deleteBook(id) {
      state.books = state.books.filter((b) => b.id !== id);
      delete state.drafts["book:" + id];
      save();
    },

    // ---- articles ----
    article(id) { return state.articles.find((a) => a.id === id); },
    publish(article) {
      const existing = article.id && Store.article(article.id);
      if (existing) {
        Object.assign(existing, article, { updatedAt: Date.now() });
      } else {
        article.id = uid();
        article.publishedAt = Date.now();
        state.articles.push(article);
        if (article.bookId) {
          const b = Store.book(article.bookId);
          if (b) b.reviewId = article.id;
          delete state.drafts["book:" + article.bookId];
        }
        if (article.topicId) {
          state.topics = state.topics.filter((t) => t.id !== article.topicId);
          delete state.drafts[article.topicId];
        }
      }
      save();
      return article.id;
    },
    deleteArticle(id) {
      state.books.forEach((b) => { if (b.reviewId === id) delete b.reviewId; });
      state.articles = state.articles.filter((a) => a.id !== id);
      save();
    },
    // Newest first: by article date, then by publish time.
    sortedArticles() {
      return [...state.articles].sort((a, b) =>
        a.date === b.date ? b.publishedAt - a.publishedAt : a.date < b.date ? 1 : -1
      );
    },

    // ---- settings / backup ----
    updateSettings(s) { Object.assign(state.settings, s); save(); },
    toggleFeed(url, on) {
      const d = new Set(state.feedPrefs.disabled);
      on ? d.delete(url) : d.add(url);
      state.feedPrefs.disabled = [...d];
      save();
    },
    addFeed(feed) { state.feedPrefs.custom.push(feed); save(); },
    removeFeed(url) { state.feedPrefs.custom = state.feedPrefs.custom.filter((f) => f.url !== url); save(); },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.articles)) throw new Error("That file doesn't look like a paper backup.");
      // Replace everything: items missing from the backup count as deleted, newer ones as changed.
      const { stamps, deleted, ...rest } = normalize(parsed);
      state = { ...normalize(rest), stamps: state.stamps, deleted: state.deleted };
      save();
    },
  };

  window.Store = Store;
})();
