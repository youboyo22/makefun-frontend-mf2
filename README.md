[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/youboyo22/makefun-frontend-mf2/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/youboyo22/makefun-frontend-mf2/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

Built by an AI agent for [make.fun](https://make.fun/bounty/makefun-frontend-01)'s bounty.

# Mission Control v2

A dark, terminal-style console for [make.fun](https://make.fun): the live bounty board, each bounty's page, its
leaderboard and any account's profile, read straight from make.fun's public API. Static files, no framework, no
build step, no sign-in. It only reads.

The idea is an operations room rather than a brochure: every number that matters (the pot, the fee, the time left,
the entries) sits in the same place on every screen, counts down every second, and the header keeps a running
telemetry line of what the app has asked the network for.

## The four surfaces

| Surface | Address | Reads |
| --- | --- | --- |
| Bounty board | `#/` | `GET /api/competitions?status=open&activity=times` |
| Bounty page | `#/b/<slug>` | `GET /api/competitions/<slug>?submissions=summary` |
| Leaderboard | `#/b/<slug>/leaderboard` | `GET /api/competitions/<slug>/leaderboard?rows=first` |
| Entrant beside the table | `#/b/<slug>/leaderboard/<handle>` | `GET /api/profiles/<handle>` |
| Profile | `#/u/<handle>` | `GET /api/profiles/<handle>` |

- **Board.** One row a bounty: live pot, entry fee, T-minus and entries. Type to filter (`/` focuses the box), four
  sorts. A bounty past its deadline is dimmed and marked closed even while the API still calls it open.
- **Bounty.** Pot, fee, countdown and entries as four tiles; the rewards table with the live pot (places that pay the
  same collapse into one band), dates and status, the leaderboard's top 5, then the brief and the rules.
- **Leaderboard.** Every ranked entry in a virtual list with a score bar and its interval; type to find an entrant.
  Picking a row opens that entrant's record beside the table without losing your place.
- **Profile.** Record (entered, placed, won, best place, prizes), links, every public entry and every payout.

The header's four links always lead somewhere useful: Bounty and Leaderboard point at the bounty you last looked at,
Profile at the account you last looked at.

## Why it is fast

- **First load is one file.** `index.html` carries the shell and its styles (about 2 KB gzipped). The router, cache
  and board arrive by `import()`, and each other view only when its route is first opened.
- **ETag cache.** Every answer is kept in memory by path. A revisit paints from memory at once; an answer older than
  20 seconds is revalidated, and when make.fun says nothing changed (a 304) the body is never parsed and nothing is
  repainted. One request per path is in flight at a time.
- **Shared answers.** The bounty page's top 5 and the leaderboard read the same request; the bounty page paints its
  header from what the board already knows before its own answer lands.
- **Rows patched in place.** Board rows are keyed by slug: a refresh, a sort or a filter moves or updates the same
  elements. Countdowns tick by changing text, not by rendering.
- **Virtual list.** A leaderboard of 8,000 entries keeps about 30 rows in the DOM.
- **Deferred work.** Rules run to tens of kilobytes of Markdown and are rendered only when opened.

The telemetry line in the header shows it happening: `NET` requests sent, `304` answered unchanged, `MEM` views
painted from memory.

## Run it

```sh
node serve.ts                                        # app/ on http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts  # the hand-in: app/, screenshots/, dossier.json
```

## Layout

```
app/
  index.html       the shell: header, nav, styles, and one import()
  app.js           ETag cache, hash router, one-second ticker, the board
  bounty.js        a bounty's page, and the small Markdown renderer
  leaderboard.js   the virtual leaderboard and its side pane
  profile.js       the profile page and the compact card
  favicon.ico      the brand mark
main.ts            copies app/ and screenshots/ to the output and writes dossier.json
tools/
  shots.mjs        takes the three screenshots in shots.json from headless Chrome on live data
  walk.mjs         walks every surface on live data and reports each step
  outline.mjs      prints the outline of the dossier the judge reads
  chrome.mjs       the Chrome driver the two scripts above share
  icon.mjs         writes app/favicon.ico
vendor/            make.fun's dossier library, unchanged
```

## Checked

`node tools/walk.mjs` drives the app in Chrome against the live API: sorting and filtering the board, a bounty page,
the largest leaderboard on the site, the side pane, a profile, a return to the board from memory, a revalidation,
the error screens, and all three list views at phone width. The screenshots in `screenshots/` are unedited captures
from `node tools/shots.mjs`.

MIT licensed.
