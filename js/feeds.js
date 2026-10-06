/* RSS feeds from magazines and news outlets, plus "hot theme" detection.
   Most feeds don't allow direct browser requests, so each feed is tried
   directly first and then through rss2json.com, a free RSS-to-JSON service. */
(function () {
  // role "ideas": individual articles become topic cards (as inspiration, not copies).
  // role "news": headlines are only scanned for themes several outlets share.
  window.DEFAULT_FEEDS = [
    // Ideas and long reads
    { name: "Aeon", url: "https://aeon.co/feed.rss", category: "Ideas", role: "ideas" },
    { name: "Noema", url: "https://www.noemamag.com/feed/", category: "Ideas", role: "ideas" },
    { name: "Longreads", url: "https://longreads.com/feed/", category: "Ideas", role: "ideas" },
    { name: "Arts & Letters Daily", url: "https://www.aldaily.com/feed/", category: "Ideas", role: "ideas" },
    { name: "JSTOR Daily", url: "https://daily.jstor.org/feed/", category: "History", role: "ideas" },
    // Science and how things work
    { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", category: "Science", role: "ideas" },
    { name: "Nautilus", url: "https://nautil.us/feed/", category: "Science", role: "ideas" },
    { name: "99% Invisible", url: "https://99percentinvisible.org/feed/", category: "Design & Art", role: "ideas" },
    { name: "Low-tech Magazine", url: "https://solar.lowtechmagazine.com/posts/index.xml", category: "Tech", role: "ideas" },
    { name: "The Conversation", url: "https://theconversation.com/us/articles.atom", category: "Science", role: "ideas" },
    { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top.xml", category: "Science", role: "ideas" },
    // Art, design, and visual inspiration
    { name: "Colossal", url: "https://www.thisiscolossal.com/feed/", category: "Design & Art", role: "ideas" },
    { name: "It's Nice That", url: "https://www.itsnicethat.com/rss", category: "Design & Art", role: "ideas" },
    { name: "The Public Domain Review", url: "https://publicdomainreview.org/rss.xml", category: "History", role: "ideas" },
    { name: "The Pudding", url: "https://pudding.cool/rss.xml", category: "Design & Art", role: "ideas" },
    // Surprise
    { name: "Atlas Obscura", url: "https://www.atlasobscura.com/feeds/latest", category: "Surprise", role: "ideas" },
    { name: "Kottke.org", url: "https://feeds.kottke.org/main", category: "Surprise", role: "ideas" },
    { name: "The Marginalian", url: "https://www.themarginalian.org/feed/", category: "Ideas", role: "ideas" },
    { name: "Smithsonian Magazine", url: "https://www.smithsonianmag.com/rss/latest_articles/", category: "History", role: "ideas" },
    // News outlets, scanned for shared themes
    { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "News", role: "news" },
    { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "News", role: "news" },
    { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", category: "News", role: "news" },
    { name: "The Guardian", url: "https://www.theguardian.com/world/rss", category: "News", role: "news" },
    { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "News", role: "news" },
    { name: "CBS News", url: "https://www.cbsnews.com/latest/rss/main", category: "News", role: "news" },
    { name: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/headlines", category: "News", role: "news" },
    { name: "Google Trends (US searches)", url: "https://trends.google.com/trending/rss?geo=US", category: "News", role: "news" },
  ];

  const stripHtml = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent.replace(/\s+/g, " ").trim();
  };
  const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s || "");
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

  async function fetchWithTimeout(url, ms = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("not a feed");
    const items = [...doc.querySelectorAll("item, entry")];
    const get = (el, sel) => { const n = el.getElementsByTagName(sel)[0]; return n ? n.textContent.trim() : ""; };
    return items.map((it) => {
      const linkEl = [...it.getElementsByTagName("link")].find((l) => !l.getAttribute("rel") || l.getAttribute("rel") === "alternate");
      const media = it.getElementsByTagName("media:content")[0] || it.getElementsByTagName("media:thumbnail")[0] || it.getElementsByTagName("enclosure")[0];
      return {
        title: stripHtml(get(it, "title")),
        link: linkEl ? linkEl.getAttribute("href") || linkEl.textContent.trim() : "",
        date: get(it, "pubDate") || get(it, "published") || get(it, "updated") || get(it, "dc:date"),
        description: stripHtml(get(it, "description") || get(it, "summary") || get(it, "content")),
        image: media ? media.getAttribute("url") || "" : "",
      };
    });
  }

  /** Read one feed. Returns [{title, link, date, description, image}]. */
  async function readFeed(url) {
    try {
      const res = await fetchWithTimeout(url, 6000);
      return parseXml(await res.text());
    } catch {
      // Blocked by the site (CORS) or unreachable: go through rss2json.
      const res = await fetchWithTimeout(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.status !== "ok") throw new Error(data.message || "feed unavailable");
      return data.items.map((it) => ({
        title: stripHtml(it.title),
        link: it.link,
        date: it.pubDate,
        description: stripHtml(it.description || it.content),
        image: it.thumbnail || (it.enclosure && it.enclosure.link) || "",
      }));
    }
  }

  function activeFeeds() {
    const prefs = (window.Store && Store.state.feedPrefs) || {};
    const disabled = new Set(prefs.disabled || []);
    return [...window.DEFAULT_FEEDS, ...(prefs.custom || [])].filter((f) => !disabled.has(f.url));
  }

  /** Articles from magazine feeds, turned into topic candidates. */
  function ideaTopics(results) {
    const out = [];
    for (const { feed, items } of results) {
      if (feed.role !== "ideas") continue;
      for (const it of items.slice(0, 12)) {
        if (!it.title || !it.link) continue;
        out.push({
          id: "feed-" + slug(it.link.replace(/^https?:\/\/(www\.)?/, "")),
          category: feed.category,
          kicker: `Spotted in ${feed.name}`,
          title: it.title,
          blurb: truncate(it.description, 280),
          source: feed.name,
          sourceUrl: it.link,
          wikiTitle: "",
          query: it.title.replace(/[:?!].*$/, "").trim() || it.title,
          image: it.image,
          feedName: feed.name,
        });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- hot themes
  const STOP = new Set(`a about above after again against all also am an and any are as at be because been before being below between both but by can could
    did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just
    me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there
    these they this those through to too under until up very was we were what when where which while who whom why will with would you your
    says say said new news live latest update updates video watch report reports year years day days week weeks time first last back get gets got
    make makes made take takes one two three four five six seven eight nine ten man woman men women people could may might amid set sets
    monday tuesday wednesday thursday friday saturday sunday january february march april june july august september october november december
    us uk world good best big top still plan plans call calls show shows want wants way ways mr ms dr need needs here's what's it's don't
    read long number essay opinion analysis review podcast episode photos pictures explainer interview breaking full story stories`.split(/\s+/));

  /** Find phrases that several different outlets are using in today's headlines. */
  function hotThemes(headlines) {
    const phrases = new Map(); // key -> {label, sources:Set, items:[]}
    for (const h of headlines) {
      const words = h.title.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
      const seenHere = new Set();
      const add = (label) => {
        const key = label.toLowerCase();
        if (seenHere.has(key)) return;
        seenHere.add(key);
        if (!phrases.has(key)) phrases.set(key, { label, sources: new Set(), items: [] });
        const p = phrases.get(key);
        p.sources.add(h.source);
        if (p.items.length < 6 && !p.items.some((x) => x.source === h.source)) p.items.push(h);
      };
      for (let i = 0; i < words.length; i++) {
        const w = words[i].replace(/['’]s$/, "");
        const lw = w.toLowerCase();
        if (STOP.has(lw) || /^\d+$/.test(w)) continue;
        if (w.length >= 4) add(w);
        const next = words[i + 1] && words[i + 1].replace(/['’]s$/, "");
        if (next && !STOP.has(next.toLowerCase()) && !/^\d+$/.test(next)) add(`${w} ${next}`);
      }
    }
    const ranked = [...phrases.values()]
      .filter((p) => p.sources.size >= 3)
      .map((p) => ({ ...p, score: p.sources.size + (p.label.includes(" ") ? 1.5 : 0) }))
      .sort((a, b) => b.score - a.score);
    const chosen = [];
    for (const p of ranked) {
      const words = p.label.toLowerCase().split(" ");
      // Skip a phrase that is part of (or contains) one already chosen.
      if (chosen.some((c) => { const cw = c.label.toLowerCase().split(" "); return words.every((w) => cw.includes(w)) || cw.every((w) => words.includes(w)); })) continue;
      // Skip a phrase drawn mostly from the same headlines as one already chosen ("Brazil" vs "election").
      const links = new Set(p.items.map((x) => x.link));
      if (chosen.some((c) => c.items.filter((x) => links.has(x.link)).length >= Math.min(c.items.length, p.items.length) * 0.6)) continue;
      chosen.push(p);
      if (chosen.length >= 6) break;
    }
    const today = new Date().toISOString().slice(0, 10);
    return chosen.map((p) => {
      const label = p.label.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
      return {
        id: `theme-${slug(p.label)}-${today}`,
        category: "Hot Theme",
        kicker: `In headlines from ${p.sources.size} outlets today`,
        title: label,
        blurb: p.items.slice(0, 3).map((x) => `${x.source}: “${x.title}”`).join("  ·  "),
        source: [...p.sources].slice(0, 4).join(", "),
        sourceUrl: p.items[0].link,
        links: p.items.map((x) => ({ title: `${x.source}: ${x.title}`, url: x.link })),
        wikiTitle: "",
        query: p.label,
      };
    });
  }

  /** Read every active feed. Returns idea topics, hot themes and the names of feeds that failed. */
  async function gatherFeeds(extraHeadlines = []) {
    const feeds = activeFeeds();
    const settled = await Promise.allSettled(feeds.map((f) => readFeed(f.url)));
    const results = [];
    const failed = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.length) results.push({ feed: feeds[i], items: r.value });
      else failed.push(feeds[i].name);
    });
    const headlines = [
      ...results.filter((r) => r.feed.role === "news").flatMap((r) => r.items.slice(0, 40).map((it) => ({ ...it, source: r.feed.name }))),
      ...(await extraHeadlines),
    ];
    return { ideas: ideaTopics(results), themes: hotThemes(headlines), failed, ok: results.map((r) => r.feed.name) };
  }

  /** Check each feed individually, for the Settings page. */
  async function testFeed(url) {
    const items = await readFeed(url);
    if (!items.length) throw new Error("no articles found");
    return items.length;
  }

  window.Feeds = { gatherFeeds, testFeed, activeFeeds, readFeed, hotThemes };
})();
