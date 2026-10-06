/* Topic gathering and topic research. Every API here is free, needs no key,
   and allows browser (CORS) requests. Each source fails independently. */
(function () {
  const WIKI = "https://en.wikipedia.org";

  async function getJSON(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 15000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: opts.headers });
      if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const pad = (n) => String(n).padStart(2, "0");
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const wikiUrl = (title) => `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const stripHtml = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent.replace(/\s+/g, " ").trim();
  };
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s || "");

  // ---------------------------------------------------------------------------
  // Topic sources. Each returns an array of topic candidates.
  // ---------------------------------------------------------------------------

  // Wikipedia's "Current events" portal: dozens of one-line news summaries per day.
  async function currentEvents() {
    const out = [];
    for (const n of [1, 2]) {
      const d = daysAgo(n);
      const page = `Portal:Current_events/${d.getFullYear()}_${MONTHS[d.getMonth()]}_${d.getDate()}`;
      const url = `${WIKI}/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&formatversion=2&origin=*`;
      let data;
      try { data = await getJSON(url); } catch { continue; }
      if (!data.parse) continue;
      const doc = new DOMParser().parseFromString(data.parse.text, "text/html");
      const root = doc.querySelector(".current-events-content") || doc.body;
      let heading = "News";
      for (const el of root.children) {
        if (el.tagName === "P" || el.tagName === "DIV") {
          const t = el.textContent.trim();
          if (t) heading = t;
          continue;
        }
        if (el.tagName !== "UL") continue;
        for (const li of el.querySelectorAll("li")) {
          if (li.querySelector("ul")) continue; // only leaf items are actual events
          const ext = li.querySelector("a.external");
          const clone = li.cloneNode(true);
          clone.querySelectorAll("a.external").forEach((a) => a.remove());
          const text = clone.textContent.replace(/\s+/g, " ").replace(/\(\s*\)\s*$/, "").trim();
          if (text.length < 40) continue;
          const parentLi = li.parentElement.closest("li");
          const storyLink = parentLi && parentLi.querySelector(":scope > a[href^='/wiki/']");
          const firstWiki = li.querySelector("a[href^='/wiki/']");
          const link = storyLink || firstWiki;
          const wikiTitle = link ? decodeURIComponent(link.getAttribute("href").replace("/wiki/", "")).replace(/_/g, " ") : "";
          out.push({
            id: "ce-" + slug(text),
            category: "Current Events",
            kicker: (storyLink ? storyLink.textContent.trim() : heading),
            title: truncate(text.split(/(?<=\.)\s/)[0], 180),
            blurb: text.length > 180 ? truncate(text, 320) : "",
            source: ext ? `${ext.textContent.replace(/[()]/g, "").trim()} via Wikipedia Current Events` : "Wikipedia Current Events",
            sourceUrl: ext ? ext.getAttribute("href") : `${WIKI}/wiki/${page}`,
            wikiTitle,
            query: wikiTitle || truncate(text, 80),
            date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
          });
        }
      }
    }
    return out;
  }

  // Wikipedia's daily featured feed: "In the news", most-read articles and today's featured article.
  async function featuredFeed(date = new Date(), { includeTrending = true } = {}) {
    const url = `${WIKI}/api/rest_v1/feed/featured/${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
    const data = await getJSON(url);
    const out = [];
    for (const item of data.news || []) {
      const main = (item.links || [])[0];
      const story = stripHtml(item.story);
      out.push({
        id: "itn-" + slug(story),
        category: "Current Events",
        kicker: "In the news",
        title: story,
        blurb: main ? truncate(main.extract, 280) : "",
        source: "Wikipedia: In the news",
        sourceUrl: main ? main.content_urls.desktop.page : `${WIKI}/wiki/Main_Page`,
        wikiTitle: main ? main.titles.normalized : "",
        query: main ? main.titles.normalized : story,
        image: main && main.thumbnail ? main.thumbnail.source : "",
      });
    }
    if (includeTrending && data.mostread) {
      for (const a of data.mostread.articles || []) {
        const title = a.titles.normalized;
        if (/^(Main Page|Special:|Wikipedia:|Portal:|File:|Deaths in)/.test(title)) continue;
        out.push({
          id: "wiki-" + slug(title),
          category: "Trending",
          kicker: `${Number(a.views).toLocaleString()} readers yesterday`,
          title: a.description ? `${title} — ${a.description}` : title,
          blurb: truncate(a.extract, 280),
          source: "Wikipedia most-read",
          sourceUrl: a.content_urls.desktop.page,
          wikiTitle: title,
          query: title,
          image: a.thumbnail ? a.thumbnail.source : "",
        });
      }
    }
    if (data.tfa) {
      const t = data.tfa;
      out.push({
        id: "wiki-" + slug(t.titles.normalized),
        category: "Curiosities",
        kicker: "Wikipedia featured article",
        title: t.description ? `${t.titles.normalized} — ${t.description}` : t.titles.normalized,
        blurb: truncate(t.extract, 280),
        source: "Wikipedia featured article",
        sourceUrl: t.content_urls.desktop.page,
        wikiTitle: t.titles.normalized,
        query: t.titles.normalized,
        image: t.thumbnail ? t.thumbnail.source : "",
      });
    }
    return out;
  }

  // A featured article from a random day in the past few years — deep cuts.
  async function deepCuts() {
    const picks = [0, 1].map(() => daysAgo(30 + Math.floor(Math.random() * 1800)));
    const results = await Promise.allSettled(picks.map((d) => featuredFeed(d, { includeTrending: false })));
    return results.flatMap((r) => (r.status === "fulfilled" ? r.value.filter((t) => t.category === "Curiosities") : []));
  }

  // On this day in history.
  async function onThisDay() {
    const d = new Date();
    const data = await getJSON(`${WIKI}/api/rest_v1/feed/onthisday/selected/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`);
    return (data.selected || []).map((ev) => {
      const page = (ev.pages || [])[0];
      const yearsAgo = d.getFullYear() - ev.year;
      return {
        id: `otd-${ev.year}-${slug(ev.text)}`,
        category: "History",
        kicker: `On this day, ${ev.year}${yearsAgo > 0 ? ` · ${yearsAgo} years ago` : ""}`,
        title: ev.text,
        blurb: page ? truncate(page.extract, 280) : "",
        source: "Wikipedia: On this day",
        sourceUrl: page ? page.content_urls.desktop.page : `${WIKI}/wiki/${MONTHS[d.getMonth()]}_${d.getDate()}`,
        wikiTitle: page ? page.titles.normalized : "",
        query: page ? page.titles.normalized : ev.text,
        image: page && page.thumbnail ? page.thumbnail.source : "",
      };
    });
  }

  // New research papers in major journals (via Europe PMC).
  const JOURNALS = [
    "0028-0836", // Nature
    "0036-8075", // Science
    "0092-8674", // Cell
    "0140-6736", // The Lancet
    "0028-4793", // NEJM
    "1078-8956", // Nature Medicine
    "0027-8424", // PNAS
    "0098-7484", // JAMA
    "2375-2548", // Science Advances
    "2397-3374", // Nature Human Behaviour
    "1758-678X", // Nature Climate Change
    "2041-1723", // Nature Communications
  ];
  async function newStudies() {
    const from = daysAgo(30);
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const q = `(${JOURNALS.map((i) => `ISSN:"${i}"`).join(" OR ")}) AND FIRST_PDATE:[${fmt(from)} TO ${fmt(new Date())}] AND HAS_ABSTRACT:y`;
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&resultType=core&pageSize=40&sort=${encodeURIComponent("P_PDATE_D desc")}`;
    const data = await getJSON(url);
    return ((data.resultList && data.resultList.result) || []).map((p) => ({
      id: "study-" + slug(p.doi || p.id),
      category: "Science",
      kicker: `New study · ${p.journalInfo && p.journalInfo.journal ? p.journalInfo.journal.title : p.journalTitle || "Journal"}`,
      title: stripHtml(p.title).replace(/\.$/, ""),
      blurb: truncate(stripHtml(p.abstractText), 320),
      source: "Europe PMC",
      sourceUrl: p.doi ? `https://doi.org/${p.doi}` : `https://europepmc.org/article/${p.source}/${p.id}`,
      wikiTitle: "",
      query: stripHtml(p.title).split(/[:.]/)[0],
      date: p.firstPublicationDate,
    }));
  }

  // Tech & internet culture from the Hacker News front page.
  async function techNews() {
    const data = await getJSON("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40");
    return (data.hits || [])
      .filter((h) => h.url && !/^(Ask|Show|Tell) HN/.test(h.title))
      .map((h) => ({
        id: "hn-" + h.objectID,
        category: "Tech",
        kicker: `${h.points} points on Hacker News`,
        title: h.title,
        blurb: "",
        source: new URL(h.url).hostname.replace(/^www\./, ""),
        sourceUrl: h.url,
        discussionUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
        wikiTitle: "",
        query: h.title,
      }));
  }

  function evergreen() {
    return (window.EVERGREEN || []).map(([category, title, wikiTitle, blurb]) => ({
      id: "ever-" + slug(title),
      category,
      kicker: "Feature idea",
      title,
      blurb,
      source: `Wikipedia: ${wikiTitle}`,
      sourceUrl: wikiUrl(wikiTitle),
      wikiTitle,
      query: wikiTitle,
    }));
  }

  // How many fresh topics each source contributes per gather.
  const QUOTAS = [
    { name: "Current events", fn: currentEvents, take: 4 },
    { name: "In the news & trending", fn: () => featuredFeed(), take: 4 },
    { name: "New studies", fn: newStudies, take: 3 },
    { name: "On this day", fn: onThisDay, take: 2 },
    { name: "Tech", fn: techNews, take: 2 },
    { name: "Deep cuts", fn: deepCuts, take: 1 },
    { name: "Feature ideas", fn: async () => evergreen(), take: 2 },
  ];
  const MAX_FEED_IDEAS = 10; // at most one per magazine per gather
  const MAX_THEMES = 4;

  /** Gather a fresh mix of topics, skipping anything already seen or dismissed. */
  async function gather(seenIds) {
    const seen = new Set(seenIds);
    const tasks = QUOTAS.map((q) => q.fn());
    // Wikipedia's news summaries and Hacker News also count toward "hot theme" detection.
    const headlineOf = (src) => (r) => r.status === "fulfilled" ? r.value.map((t) => ({ title: t.title, link: t.sourceUrl, source: src })) : [];
    const extraHeadlines = Promise.all([
      Promise.allSettled([tasks[0]]).then(([r]) => headlineOf("Wikipedia Current Events")(r)),
      Promise.allSettled([tasks[4]]).then(([r]) => headlineOf("Hacker News")(r)),
    ]).then((a) => a.flat());
    const feedsTask = window.Feeds ? Feeds.gatherFeeds(extraHeadlines) : Promise.reject(new Error("feeds unavailable"));
    const [results, feedResult] = await Promise.all([Promise.allSettled(tasks), Promise.allSettled([feedsTask]).then(([r]) => r)]);

    const picked = [];
    const failed = [];
    const take = (pool, n) => {
      let taken = 0;
      for (const t of pool) {
        if (taken >= n) break;
        if (seen.has(t.id)) continue;
        const key = t.wikiTitle && "w:" + t.wikiTitle.toLowerCase();
        if (key && seen.has(key)) continue; // same subject already picked from another source
        seen.add(t.id);
        if (key) seen.add(key);
        picked.push(t);
        taken++;
      }
    };

    if (feedResult.status === "fulfilled") {
      const { ideas, themes } = feedResult.value;
      take(themes, MAX_THEMES);
      // One article per magazine, magazines in random order.
      const byFeed = {};
      for (const t of shuffle(ideas)) if (!seen.has(t.id)) byFeed[t.feedName] = byFeed[t.feedName] || t;
      take(shuffle(Object.values(byFeed)), MAX_FEED_IDEAS);
      if (feedResult.value.failed.length) console.warn("Feeds that didn't respond:", feedResult.value.failed.join(", "));
    } else {
      failed.push("Magazine & news feeds");
    }

    results.forEach((r, i) => {
      if (r.status !== "fulfilled") { failed.push(QUOTAS[i].name); console.warn(QUOTAS[i].name, r.reason); return; }
      // News items keep their order (most important first); everything else is sampled.
      take(/Current|news/.test(QUOTAS[i].name) ? r.value : shuffle(r.value), QUOTAS[i].take);
    });
    return { topics: shuffle(picked), failed };
  }

  // ---------------------------------------------------------------------------
  // Research for a single topic.
  // ---------------------------------------------------------------------------

  async function wikiSummary(title) {
    const d = await getJSON(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
    if (d.type === "disambiguation") return null;
    return {
      title: d.titles ? d.titles.normalized : d.title,
      description: d.description || "",
      extract: d.extract || "",
      url: d.content_urls ? d.content_urls.desktop.page : wikiUrl(title),
      image: d.originalimage ? d.originalimage.source : d.thumbnail ? d.thumbnail.source : "",
    };
  }

  async function wikiSearch(query) {
    const d = await getJSON(`${WIKI}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=6&format=json&origin=*`);
    return (d.query ? d.query.search : []).map((r) => ({
      title: r.title,
      url: wikiUrl(r.title),
      snippet: stripHtml(r.snippet),
    }));
  }

  async function papers(query) {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=6&resultType=lite&sort=${encodeURIComponent("CITED desc")}`;
    const d = await getJSON(url);
    return ((d.resultList && d.resultList.result) || []).map((p) => ({
      title: stripHtml(p.title),
      url: p.doi ? `https://doi.org/${p.doi}` : `https://europepmc.org/article/${p.source}/${p.id}`,
      meta: [p.authorString && truncate(p.authorString, 60), p.journalTitle, p.pubYear, p.citedByCount ? `cited ${p.citedByCount}×` : ""].filter(Boolean).join(" · "),
    }));
  }

  async function discussions(query) {
    const d = await getJSON(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=6`);
    return (d.hits || []).filter((h) => h.title).map((h) => ({
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      meta: `${h.points || 0} points · ${h.num_comments || 0} comments · ${(h.created_at || "").slice(0, 10)}`,
      discussionUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
    }));
  }

  // Recent news coverage across thousands of outlets via the GDELT project.
  async function coverage(query) {
    const q = query.split(/\s+/).length > 1 ? `"${query.replace(/"/g, "")}"` : query;
    const d = await getJSON(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q + " sourcelang:english")}&mode=artlist&maxrecords=10&format=json&sort=hybridrel&timespan=3months`);
    return (d.articles || []).map((a) => ({
      title: a.title,
      url: a.url,
      meta: `${a.domain}${a.seendate ? " · " + a.seendate.slice(0, 4) + "-" + a.seendate.slice(4, 6) + "-" + a.seendate.slice(6, 8) : ""}`,
    }));
  }

  function searchLinks(query, category) {
    const q = encodeURIComponent(query);
    const links = [
      ["Google News", `https://news.google.com/search?q=${q}`],
      ["AP News", `https://apnews.com/search?q=${q}`],
      ["Reuters", `https://www.reuters.com/site-search/?query=${q}`],
      ["BBC", `https://www.bbc.co.uk/search?q=${q}`],
      ["NPR", `https://www.npr.org/search/?query=${q}`],
      ["Google Scholar", `https://scholar.google.com/scholar?q=${q}`],
      ["PubMed", `https://pubmed.ncbi.nlm.nih.gov/?term=${q}`],
      ["Britannica", `https://www.britannica.com/search?query=${q}`],
      ["Internet Archive", `https://archive.org/search?query=${q}`],
      ["Library of Congress", `https://www.loc.gov/search/?q=${q}`],
      ["YouTube", `https://www.youtube.com/results?search_query=${q}`],
      ["Reddit", `https://www.reddit.com/search/?q=${q}`],
    ];
    if (category === "History") links.push(["Chronicling America (old newspapers)", `https://chroniclingamerica.loc.gov/search/pages/results/?andtext=${q}`]);
    return links.map(([label, url]) => ({ label, url }));
  }

  /** Brainstorming prompts tailored loosely to the kind of topic. */
  function angles(topic) {
    const common = [
      "What's the one-sentence version of this story?",
      "Who is affected, and how would they describe it?",
      "What's surprising or counterintuitive here?",
      "What happens next — and what should readers watch for?",
    ];
    const byCat = {
      "Current Events": ["What led up to this? Give readers the backstory.", "Who are the key players and what do they want?", "Has anything like this happened before?"],
      Trending: ["Why are so many people looking this up right now?", "What's the story behind the headlines?"],
      Science: ["What question were the researchers asking?", "How big was the study, and what are its limits?", "What would this change in everyday life?", "What do independent experts say?"],
      Tech: ["Who wins and who loses if this takes off?", "Explain it to someone who doesn't follow tech."],
      "Hot Theme": ["Why are so many outlets covering this at once?", "What's the story underneath the headlines?", "What are the different outlets emphasizing, and what are they missing?"],
      Ideas: ["What's the big idea, in your own words?", "Do you agree? What's the strongest counterargument?", "Where does this idea show up in everyday life?"],
      "Design & Art": ["Who made this, and what were they trying to do?", "Describe it so a reader can picture it without seeing it.", "What's the trend or movement it belongs to?"],
      Surprise: ["What made you curious about this?", "What's the strangest detail you found?", "Who would be most surprised to learn this?"],
      History: ["Why does this still matter today?", "What's the human story — one person at the center of it?", "What do most people get wrong about it?"],
    };
    return [...(byCat[topic.category] || ["What's the hook that makes a reader care today?", "What's a vivid scene you could open with?"]), ...common];
  }

  /** Fetch all research for a topic. Returns partial results if some sources fail. */
  async function research(topic) {
    const query = topic.query || topic.wikiTitle || topic.title;
    const summaryTask = (async () => {
      if (topic.wikiTitle) {
        try { const s = await wikiSummary(topic.wikiTitle); if (s) return s; } catch {}
      }
      const hits = await wikiSearch(query);
      return hits[0] ? wikiSummary(hits[0].title) : null;
    })();
    const [summary, related, studies, discuss, news] = await Promise.allSettled([
      summaryTask,
      wikiSearch(query),
      papers(query),
      discussions(query),
      coverage(query),
    ]);
    const val = (r) => (r.status === "fulfilled" ? r.value : null);
    return {
      fetchedAt: Date.now(),
      query,
      summary: val(summary),
      related: val(related) || [],
      studies: val(studies) || [],
      discussions: val(discuss) || [],
      coverage: val(news) || [],
      searchLinks: searchLinks(query, topic.category),
      angles: angles(topic),
    };
  }

  window.Sources = { gather, research, searchLinks, angles };
})();
