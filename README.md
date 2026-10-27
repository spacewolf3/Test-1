# My Paper — a personal newspaper

A one-person newspaper: find topics, research them, write the stories yourself, and watch your front page fill up.

## The three areas

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
- **Brainstorm** on the same page: about 18 questions, each with its own answer box. They're grouped into Find the story, The people, The facts and Your take, plus a few suited to the topic's category (for example, study limits for science, or why it still matters for history). There's also a general notes box. Everything saves as you type and syncs with the rest of your paper.
- **Write your article** at the bottom of the page. Write it there or paste it in from elsewhere. **Pull my brainstorm answers into the draft** drops your answers in as a rough outline to rewrite. Then add a headline, subheadline, byline, section, date and an optional image, pick which sources to list, preview, and publish.

**📚 Bookshelf**
- Add the books you've read by searching [Open Library](https://openlibrary.org), a free book catalog, or add them by hand.
- Track each book's status (finished, reading, want to read), date finished, and a 1–5 star rating.
- Each book gets a set of review questions. Fiction and nonfiction get different ones (characters and setting vs. argument and evidence). Answers save as you type.
- **Turn my notes into a review** assembles your answers into a draft, which you polish and publish to the paper's **Books** section.
  - Your one-sentence verdict becomes the subheadline.
  - Your favorite quote becomes a pull quote.
- Published reviews show the book's cover, details and your rating. The front page gets a "From the Bookshelf" row.

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

## On your phone's home screen
Once the app is online at a web address (GitHub Pages or Netlify), open that address on your phone:
- **iPhone (Safari):** tap Share → **Add to Home Screen** → Add.
- **Android (Chrome):** tap ⋮ → **Add to Home screen** (or **Install app**).

It opens full-screen with its own icon and works without a connection, though gathering topics and searching books need one. On iPhone, the home-screen app keeps its own saved data, separate from Safari. Use Export/Import backup in Settings if you've already written in Safari.

## About the feeds
Most websites don't let a web page read their RSS feed directly. When that happens, the app reads the feed through [rss2json.com](https://rss2json.com), a free service that converts feeds. That service sees which feed addresses are requested, and nothing else.

## Your data
Everything is saved in your browser's local storage, on that device only. Nothing is sent anywhere except the searches made to the public topic and research sources, unless you turn on sync.

### Syncing across devices
**Settings → Sync across devices** saves your paper as `paper.json` in a **private** GitHub repo of your own, such as `my-paper-data`. Keep it separate from this app's repo, so your writing stays private even if the app's code is public.
1. Create a private repo at https://github.com/new.
2. Create a fine-grained access token at https://github.com/settings/personal-access-tokens/new. Give it access to **only that repo**, with **Contents: Read and write**.
3. Paste the repo name and token into Settings on each device.

How it behaves:
- Changes are saved to GitHub about 15 seconds after you stop editing, and when you leave the app. Opening the app pulls in changes from your other devices.
- If you edit on two devices before they sync, the copies are merged item by item. The newest edit to each article, book or note wins, and deletions stick.
- Every save is a commit, so the repo's history doubles as a complete backup.
- The token is stored only on the device where you pasted it. It's never synced or included in backups.

**Settings → Export backup** still saves a copy as a file, and **Import** replaces everything on that device with the backup.
