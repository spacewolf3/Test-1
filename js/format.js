/* Turns a pasted plain-text article into newspaper HTML.
   Every non-empty line is a paragraph, plus a few light conventions:
     ## Subhead            > Pull quote           - or * list item
     ---  section break    **bold**  *italic*     [text](https://link)  bare URLs */
(function () {
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function inline(text) {
    let s = esc(text);
    const links = [];
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      links.push(`<a href="${url}" target="_blank" rel="noopener">${label}</a>`);
      return `\u0000${links.length - 1}\u0000`;
    });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+?)([.,;:!?]*)(?=$|[\s<)])/g, (_, pre, url, trail) => {
      links.push(`<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>`);
      return `${pre}\u0000${links.length - 1}\u0000${trail}`;
    });
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>");
    s = s.replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, "$1<em>$2</em>");
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => links[i]);
    return s;
  }

  function articleHTML(body) {
    const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let list = null;
    const flush = () => { if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flush(); continue; }
      let m;
      if ((m = line.match(/^[-*•]\s+(.*)/)) && !/^\*\*/.test(line)) {
        (list = list || []).push(`<li>${inline(m[1])}</li>`);
        continue;
      }
      flush();
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) out.push(`<hr class="section-break">`);
      else if ((m = line.match(/^#{1,4}\s+(.*)/))) out.push(`<h3>${inline(m[1])}</h3>`);
      else if ((m = line.match(/^>\s?(.*)/))) out.push(`<blockquote class="pull-quote">${inline(m[1])}</blockquote>`);
      else out.push(`<p>${inline(line)}</p>`);
    }
    flush();
    return out.join("\n");
  }

  /** Plain text excerpt of the first paragraphs, for front-page teasers. */
  function excerpt(body, maxChars) {
    const paras = String(body || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l && !/^(#|>|-{3,}|[-*•]\s)/.test(l))
      .map((l) => l.replace(/\*\*|__|\*|_/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
    let text = "";
    for (const p of paras) {
      if (text.length + p.length > maxChars) {
        if (!text) text = p.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
        break;
      }
      text += (text ? "\n" : "") + p;
    }
    return text;
  }

  const wordCount = (body) => (String(body || "").match(/\S+/g) || []).length;
  const readingTime = (body) => Math.max(1, Math.round(wordCount(body) / 230));

  function longDate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    if (!y) return "";
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  function shortDate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    if (!y) return "";
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  window.Format = { esc, inline, articleHTML, excerpt, wordCount, readingTime, longDate, shortDate };
})();
