# My Paper — a personal newspaper

A one-person newspaper: find topics, research them, write the stories yourself, and watch your front page fill up.

## The two areas

**✎ Newsroom**
- **Topic Wire**: a mix of topics from many places.
  - **Hot themes**: subjects that 3 or more outlets are covering at once. The app scans headlines from BBC, NPR, The Guardian, Al Jazeera, CBS, PBS, Google Trends, Wikipedia and Hacker News.
  - **Article ideas** from magazines, one per magazine each time you gather: Aeon, Noema, Longreads, Arts & Letters Daily, Quanta, Nautilus, 99% Invisible, Low-tech Magazine, The Conversation, ScienceDaily, Colossal, It's Nice That, The Public Domain Review, The Pudding, Atlas Obscura, Kottke, The Marginalian, Smithsonian and JSTOR Daily.
  - **Wikipedia**: current events, most-read articles, "On this day" history and featured articles.
  - **New studies** in major journals (Europe PMC) and the Hacker News front page.
  - A built-in bank of evergreen feature ideas.
  - **↻ Gather topics** pulls a fresh batch. Topics you've seen or dismissed never come back.
  - **✕** dismisses a topic you don't care about.
  - Add your own idea with the box at the top.
  - Turn sources on or off, check which ones are working, or add any RSS feed in **Settings → Sources**.
- **Dig in** on a topic to get:
  - Background from Wikipedia.
  - Recent news coverage (GDELT).
  - Related reading.
  - Studies and papers (Europe PMC).
  - Discussions (Hacker News).
  - One-click searches on Google News, AP, Reuters, BBC, NPR, Google Scholar, PubMed, Britannica, Internet Archive and more.
  - Brainstorm prompts and a notepad that saves as you type.
- **Submit article**: paste in the piece you wrote elsewhere. Add a headline, subheadline, byline, section, date and an optional image. Pick which sources to list under it, preview it, then publish.

**📰 The Paper**
- Front page:
  - A masthead with your paper's name.
  - The newest story as the lead, the next four in a sidebar, then "More Stories" and the archive.
- Section pages, a dated archive, and full article pages with newspaper typography.
- Every article can be edited, printed or deleted.

### Formatting your article
Each line of the article text becomes a paragraph. You can also use:
`## Subheading` · `> Pull quote` · `- list item` · `---` (section break) · `**bold**` · `*italic*` · `[link](https://…)`

## Running it
It's a static site with no build step and no server code.

- **Locally**: from this folder, run `npx serve .` (or `python3 -m http.server`) and open the URL it prints. Opening `index.html` directly also works in most browsers.
- **Online**: turn on GitHub Pages for this repository (Settings → Pages → deploy from branch, root folder).

## About the feeds
Most websites don't let a web page read their RSS feed directly. When that happens, the app reads the feed through [rss2json.com](https://rss2json.com), a free service that converts feeds. That service sees which feed addresses are requested, and nothing else.

## Your data
Everything is saved in your browser's local storage. Nothing is sent anywhere except the searches made to the public topic and research sources. Use **Settings → Export backup** now and then, and use **Import** to move your paper to another device or browser.
