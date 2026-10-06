# My Paper — a personal newspaper

A one-person newspaper: find topics, research them, write the stories yourself, and watch your front page fill up.

## The two areas

**✎ Newsroom**
- **Topic Wire**: a mix of current events, trending subjects, new studies, tech, history ("on this day"), deep cuts and evergreen feature ideas.
  - **↻ Gather topics** pulls a fresh batch. Topics you've seen or dismissed never come back.
  - **✕** dismisses a topic you don't care about.
  - Add your own idea with the box at the top.
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

## Your data
Everything is saved in your browser's local storage. Nothing is sent anywhere except the searches made to the public topic and research sources. Use **Settings → Export backup** now and then, and use **Import** to move your paper to another device or browser.
