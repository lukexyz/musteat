# MustEat

Year 2099. Lockdown day 336,041. City access: restricted. Going outside is illegal. Food is as scarce as federation credits.

A single-file idle game where every player starts as a delivery runner for whoever
sent them the link, buys gear, opens a shop, recruits colleagues to run for them,
and then builds a supply chain (Depot, Kitchen Plant, Nutrient Factory, Ministry
seat) that is gated on headcount rather than credits. It is a pyramid scheme. That
is the joke. That is also the growth strategy.

`index.v1.html` is the previous build (shop and runners only, four-endpoint
backend). `index.html` is the current one.

## First visit

With no save in the browser the page opens on a splash: six lines of dystopian terminal fiction (2099, a city locked by a Ministry update,
frozen accounts, subscribed hunger, and a leaked courier login) that fade in one at a time. It moves on to registration
by itself after five seconds, or on a tap. `CONFIG.INTRO_S` sets the wait. Returning players never see it.

## Run it

Open `index.html` in a browser. No build, no dependencies. Progress saves to
`localStorage` and keeps accruing while the tab is closed (full rate for 8h, half
rate up to 24h).

## See everything without 30 colleagues

In local mode the footer has **seed demo company**. It fakes ~32 citizens around
you: four direct runners, their runners, a rival empire in Sales with a Nutrient
Factory, two Finance strays who never opened a shop, and a franchise you handed
over yesterday (so the Portfolio tab has a trophy in it). After seeding you can
see downline cuts, sectors by department, the company feed, milestones, nudges,
and build a Depot and a Kitchen Plant once you have the credits.

**wipe company** in the footer clears the local sheet and your save.

## Test the pyramid by hand

In local mode every invite, voucher and franchise link carries a fresh `&slot=NNNNNNN`. Open it in
the same browser and it registers a new player who shares this browser's sheet, so the company,
feed, leaderboard and ledger are shared between all the players you spawn this way. With a backend
configured the slot is not added.

Local mode fakes the sheet inside the same browser profile:

1. Open `index.html`, register, open a shop, copy the invite. Note the `?ref=CODE`.
2. Open `index.html?slot=2&ref=CODE` in another tab. Register a second citizen and tap RUN.
   The recruit sees who they run for, the 10% tax, and any supply chain perks.
3. Back in the first tab the recruit appears within a second (tabs listen for sheet
   writes) with a "joined as your runner" log line, and 10% of their earnings lands in your cash.

Voucher test: `index.html?slot=3&ref=CODE&v=Sam` shows the voucher intro and starts Sam with ₵250.

Offline test: in DevTools, set `JSON.parse(localStorage.musteat_save).lastSeen` to a few hours ago, write it back, reload.

## Browser smoke test

`test/smoke.js` drives the real page in headless Chromium with Playwright: registration,
taps, a held click on a re-rendered button, opening a shop, clipboard share, a recruit in
a second tab, bulk buy, upgrades, a crate, a franchise handover in another tab and the trophy it leaves, a Ministry sale, seeded company at phone width, offline return.

```
cd test && npm install && node smoke.js          # add --headed to watch it
node remote.js                                   # three separate browser contexts sharing one company through sheetmock.js
```

## Balance play-test

`test/exportlog.js` exports the current Claude Code session for this project into `.logs/` (gitignored) as a readable transcript plus the raw jsonl.

`test/balance.js` runs the page with a bot on a fresh save and simulated time: it taps, buys whatever pays back fastest, collects half the crates and buys the Compliance Drone. Prints when each tier was first bought, the longest waits with nothing affordable, and income samples. `node balance.js 480 2` is eight hours of an active tapper; `node balance.js 1440 0` is a day of someone who only checks in every ten minutes. `?dev` on the page URL exposes the economy as `window.MUSTEAT` for this.

## Slack unfurl

`og.png` and the Open Graph tags in the head give the link a title, description and image in Slack. `og:image` must be an absolute URL; it points at the GitHub Pages copy, so change it if the game moves.

## The sheet

The backend is treated as a spreadsheet: two tables, read in full, rows upserted
by `id`. All maths (downline, cuts, sectors, leaderboard, milestones, decrees) runs
on the client from the full `players` table, so the backend stores rows and nothing else.

**players** — one row per citizen

| column | meaning |
| --- | --- |
| id | player id, generated client-side |
| code | this player's referral code |
| ref | the code that recruited them (null if nobody) |
| name, dept | as entered at registration; name can be changed later from the ✎ next to it. Identity is `id` and `code`, so a rename never moves runners or cuts |
| total, meals | lifetime credits and deliveries |
| rank | 0 Runner … 4 Supreme Ministry of Eating |
| shopName | null until they open a shop |
| buildings | comma list: `depot,plant,factory,ministry` |
| stamps | Ration Stamps held, shown as ★ on the leaderboard |
| played | Active seconds while the tab is visible, capped at one second per frame after suspension |
| paceVersion, pace0…N | Version 1 minute history: JSON objects mapping complete active minute to lifetime credits, 500 minutes per column (`pace` + floor(minute / 500)). Includes offline earnings; never backfills missed history. Legacy `sprint` is ignored |
| offer | JSON of a franchise offer while one is out: id, shop name, gear, upgrades, income |
| franchiseOf, franchiseName | for a franchisee: the id and name of the player whose business they took |
| claimedBy, claimedName, claimedAt, claimedOffer | written onto the franchisor's row by the colleague who claims the offer, never by the owner. The owner's client only ever upserts its own columns, so a merge-by-id upsert must leave unknown columns alone |
| lastSeen | ms timestamp of last heartbeat |

**events** — the company feed

| column | meaning |
| --- | --- |
| id, ts, pid, who | event id, ms timestamp, player id and name |
| kind | `join`, `shop`, `build`, `fine`, `rank`, `handover`, `franchise`, `milestone`, `retire`, `decree` |
| amount, of | milestones only: the figure passed (`1M`) and the franchisor's name |
| arg | one plain-text argument for the kind: recruiter name, shop name, building, fine amount, rank, stamps |
| text | plain-text rendering for other readers of the sheet. The feed renders from kind and arg, never from text as HTML |
| effect | decrees only: `feast` or `audit` |

**ledger** — the audit trail. One row per credited cut or royalty, written by the player who received it

| column | meaning |
| --- | --- |
| id, ts | row id, ms timestamp |
| from, fromName | the runner or franchisee whose earnings the cut came from |
| to, toName | who was credited |
| level | 1, 2, 3 for downline cuts, F for a franchise royalty |
| kind | `cut` or `royalty` |
| amount | credits credited in this sync |

`ledger.html` reads the three tables and shows top earners from runners, biggest contributors, who pays whom, high scores and the most recent entries. It refreshes itself. In local mode it reads the same browser sheet; with a backend it reads the same endpoints as the game. The leaderboard in the game shows a "From runners" column from the same table.

### Wire the Google Sheet (the GitHub Pages version)

GitHub Pages is static, so on its own every browser is its own company. `backend/Code.gs` turns a
Google Sheet into the shared backend:

1. Create a blank Google Sheet. Extensions > Apps Script. Replace the contents of Code.gs with
   `backend/Code.gs` and save.
2. Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy, authorise
   it once, copy the URL ending in `/exec`.
3. Paste that URL into `CONFIG.SHEET_API` in `index.html` and `ledger.html`. Commit, push, done.
   The tabs `players`, `events` and `ledger` appear in the sheet on the first sync, with headers.

Every browser that opens the page now shares one company. Invite links stop carrying a dev slot.
If the sheet is unreachable the game falls back to local mode and says so in the log.

Redeploy the web app (Deploy > Manage deployments > edit > new version) after changing Code.gs;
the URL stays the same.

The client makes one POST per sync (every 30 seconds per open tab) that upserts the player row,
flushes queued feed and ledger rows, and returns all three tables, plus one GET per intro. Apps
Script runtime is capped per day (about 90 minutes on a personal account, 6 hours on a Workspace
one); at a few hundred milliseconds a call that is comfortably a working day of thirty people on a
Workspace account, and tight on a personal one. `CONFIG.SYNC_S` is the lever.

Strings that would turn into formulas or numbers in a cell (`=1+1`, `007`) are stored with a
zero-width-space prefix and stripped on the way out, so a name cannot become a formula.

`test/sheetmock.js` is the same contract in Node, in memory. `node test/sheetmock.js` serves the
game at http://127.0.0.1:8787/ already wired to itself: open it in two different browsers (or a
normal and a private window) to play a shared company locally. `PORTING.md` has the full contract
for moving to another database.

## Mechanics in one place

- Ten gear tiers from Hazmat Trainers (₵60) to the Ministry Lunch Portal (₵1.5T), each 10 to 20× the cost and ~7× the output of the last. Cost grows 15% per level. Only the next tier and one classified one after it are shown. Buy ×1 / ×10 / ×100.
- Upgrades: each gear tier has four ×2 doublers (unlocked at 1 / 5 / 25 / 50 owned, priced at 10 / 100 / 5,000 / 100,000× the gear's base cost), five tap upgrades (each tap earns +2% of income per second), seven global +10% upgrades unlocked by delivery counts, and Advanced Cryptochain Bookkeeping (₵10K, three minutes in) which adds a per-line revenue readout to the gear list, with a reveal sequence when bought.
- Commendations: 37 achievements, each +2% income forever. The top one, "Every Upgrade. Every Single One.", sorts first and larger in the commendations card, gilds your name in the header, and pins a full-width gold trophy at the top of the cabinet. Same +2%; the rest is for show.
- Unmarked ration crates appear every 5 to 15 minutes for 13 seconds: Lunch Rush (income ×7 for 77s), Panic Buying (taps ×777 for 13s) or a lump sum (15% of cash, capped at 15 minutes of income). Collecting one is a moment: a gold burst at the crate, the crate folds away, the screen edges glow for a beat, and the reward lands in a loot strip between the order line and the effect chips (the page scrolls there only if it is off screen), which shimmers once. No toast.
- The first crate is the hook: it lands 30 to 45 seconds after registration, stays for 30 seconds with a "take it" label, always pays at least ₵60 (enough for Hazmat Trainers) plus a Lunch Rush, and opens a modal that explains crates.
- Franchising (prestige that recruits): once you have a shop and gear, "Franchise to a colleague" copies a first-come Slack message with a `?fr=CODE` link. You keep playing. The first colleague to register through it gets your gear, upgrades and shop name (numbered, "Kebabsolute Zero №2") as they stand at that moment, and becomes your level 1 runner. On your next sync you get Ration Stamps = cbrt(lifetime earnings / 10M) minus what you already hold, a trophy in the Portfolio tab, and 25% of everything they ever earn instead of the usual 10%. Your clone keeps name, runners, buildings, commendations, cash and stamps, and loses gear, upgrades, drone and contracts. Income × sqrt(1 + 0.2 × stamps).
- Sell to the Ministry is the solo fallback: half the stamps, no royalty, and only enabled when it would raise income by at least a quarter.
- A franchisee posts to the feed each time the franchise passes ₵100K, ₵1M, ₵10M and so on, naming who gets the 25%.
- What a franchisor keeps earning: 25% of the franchisee's lifetime total (which includes the franchisee's own runner cuts), plus the normal 5% and 2.5% from anyone the franchisee recruits (levels 2 and 3). Runners never transfer: they belong to a code, not a shop. A Ministry sale pays stamps only.
- Two folder tabs, OPERATIONS and PORTFOLIO. The Portfolio tab opens with your empire: headcount by level, credits earned by other people's work, the share of your income that is someone else's, and the pyramid itself (you on top, one row per level, idle runners faded, franchisees gold).
- The Portfolio tab then lists your runners' businesses: each downline member with their shop, level, lifetime earnings and rate, and your cut from them, all time and per second.
- The Portfolio tab is also the trophy cabinet: every franchise with the gear and buildings it had, income at handover, live total earned, revenue per minute (from the last few syncs), royalty owed to you, and whether the franchisee is still open. Under the businesses is the Runners shelf: one card per downline member, in order of what has been taken from them, with their shop or "runs for you", direct or via whom, when they first appeared under you, taken all time (from your ledger, exact), taking now (rate over the last syncs), your rate and idle status. People as trophies.
- Runners pay 10% to their shop owner until they open a shop (₵5,000).
- Everyone with no runners pays 15% to the Sector 7 Provisional Gang on top. Recruit one runner and the gang moves on to them. This is the hook: the only way out of the tax is to send the link.
- Neither cut is announced for the first two minutes of play (`CONFIG.REVEAL_S`, on the active-play clock, so only while the tab is open). Then a letter under the airlock door from the recruiter (from head office, for a franchisee), and a minute later a knock from the gang: one-shot modals with what has been paid so far, retroactively. After that a quiet protection tab opens a side drawer, or a bottom sheet on phones. The expandable notices live inside it. Escape and backdrop clicks close it; focus is trapped and restored. It does not reopen on render or interrupt the delivery button. Recruiting a runner before the knock marks the gang as met, so it never knocks about a threat that has already left.
- The (−N%) beside Per second is a quiet button from minute one: click for where the cut goes (who, how much a second, how much all time), a closing line per case, and Open a shop / Copy invite. "Next ration in" gets the same treatment, explaining the ration drop. The pattern (`.help`) is a faint rounded highlight on hover and a modal on click, for anything on screen that is a mechanic in disguise.
- Shop owners get 10% / 5% / 2.5% of level 1 / 2 / 3 downline lifetime earnings, forever.
- Buildings need a shop, the previous building, a company-wide citizen count, and people:
  Depot 1 direct runner, Kitchen Plant 2 downline, Nutrient Factory 3 downline, Ministry seat
  3 direct runners one of whom has a Depot. Each helps the people below (faster deliveries,
  higher zone, more value) and pays the owner more (bigger cuts). Scaled for a company of tens.
- Milestones at 2 / 3 / 4 / 6 / 10 citizens declassify each blueprint and the Hoverbike subsidy.
- Ranks: Shop Owner on opening a shop, District Overlord at 2 in your downline, Regional Nutrient Baron at 4, Supreme Ministry of Eating at 8.
- Sectors: each department belongs to the shop with the most runners from it.
- Nudges (idle runners), complaints (runners against owners), vouchers (₵200 to give a
  named colleague ₵250) and share messages are all copy-to-clipboard for Slack. "Copy invite" first opens a picker: three innocent favours about a Toqan app (Lawful neutral, Lawful evil, Chaotic evil), none of which mention the game or the cut, with the live total cut filled into the KPI one, plus the old rank line as a dimmed True neutral option. The alignment label is the only tell, and only the sender sees it. Where the
  clipboard is blocked (iframes, app shells) the text opens in a selectable box instead. No prompt() or confirm() anywhere.
- Registration applies referral and franchise codes automatically from the URL, with no code field or manual entry. It asks for "Your alias" and previews it in the main header as you type; the alias is saved only when registration is submitted. The invite-sharing dialog still displays your own public referral code.
- Ration drops pay 10 minutes of base income (minimum ₵50). Each claim draws a new 3–15 minute cooldown in whole minutes; `rationDue` persists the deadline across reloads and recovery codes. Old hour-long schedules and saves without a deadline draw one new cooldown from the last claim time, so overdue drops become claimable. The countdown explains itself on click.
- Playtime scores: the clock runs only while the tab is visible (capped at one second per frame). Each crossed full minute records immutable lifetime earnings, including offline income. Both leaderboards compare the same selected minute across everyone with that checkpoint, including players now further ahead. Missing checkpoints are unranked, ties share a place, and your own row remains visible outside the top 15/30. Existing saves begin recording at the next full minute; legacy sprint scores are not converted. Lifetime rankings remain a separate view.
- Airlock contracts: a free Airlock Permit appears in Upgrades after 90 active seconds plus 10 taps or any technology. Claiming it saves `dispatch.unlocked`, reveals the contract section with a cyan ripple and access stamp, and costs no credits. Hidden/offline time cannot earn the permit. Existing active or completed contracts retain access without claiming it. Accepting fixes a quota of max(25, base deliveries/sec × 120) and reward of max(100, base income/sec × 45). All subsequent deliveries count, including offline work. Claim once, then accept another. Every three completions adds 1% income, capped at 20%; the permit and progress survive franchises, recovery and reloads. No deadlines or recruitment requirements.
- The first crate pays credits immediately, but its 77-second rush starts only after TAKEN. The unstarted rush survives reloads. The active rush has a countdown beside the delivery button.
- Technology follows the delivery controls directly. The Your next milestone card sits below Upgrades with a muted border and neutral background, buys one unit regardless of bulk quantity, and only recommends contracts after unlocking them. It is hidden while a contract is active, including when payment is ready; progress and collection stay in Airlock Contracts. It returns after payment is collected. A short trainers hint above Technology disappears once any gear is owned and stays hidden after franchising. Basic net income gained from a technology purchase is always visible; bookkeeping unlocks the detailed revenue/share breakdown. The operation scene and recruitment summary live at the top of Portfolio, with best-tech, zone and automatic delivery-rate labels. The scene and permit effects honour reduced motion.
- Ministry seat holders issue one decree per day: Mandatory Feast (everyone ×2 for
  10 minutes) or Company-wide Audit (+25 suspicion for everyone outside their chain).
- Ministry suspicion, inspections, acid rain, outbreaks, JustBreathe, bribes, Compliance
  Drone and Exclusive Contracts are unchanged from v1.

## Citizen identity and recovery

New citizens use 128 random bits from `crypto.getRandomValues` for their ID. Existing IDs and saves are preserved. Names and public invite codes are not login credentials. `musteat_save` belongs to the current browser profile and origin, with optional test-slot suffixes; the company sheet is shared across all clients. A local file and the HTTPS site have separate personal saves. File URL storage is browser-dependent, so regular play should use a hosted address.

The **your save** panel shows the loaded citizen and provides a self-contained recovery string. `MUSTEAT1G.<base64url>.<sha256>` contains a gzip-compressed UTF-8 JSON snapshot; `MUSTEAT1J` is the uncompressed fallback when compression is unavailable. The payload includes the original ID, referral code, purchases, progress, contracts, franchise portfolio and minute histories. The checksum detects corruption; it is not encryption or proof of ownership. The code is private because anyone holding it can read or restore the game. It is not an automatically updating cloud save.

Decoding is local and bounded to 4 MiB of expanded JSON. The state is validated before a preview asks the player to confirm replacement. Imported logs become safe text. Restore removes referral/voucher/franchise parameters from the current URL, keeps test-slot selection, and retains the replaced local save under `musteat_save_before_restore` (or its slot equivalent); **your save** can recover that backup too. Startup then applies ordinary offline earnings and syncs the existing citizen. Close the previous browser's game when switching: simultaneous copies share one ID and can overwrite the public row.

Reset, wipe and restore suppress the old page's closing autosave so it cannot resurrect or overwrite the save being removed/replaced. `test/recovery.js` covers separate browser IDs, return visits, self-contained cross-browser recovery, malformed codes, preserved identity, safe imported text, reset and the five-second intro.

The header lockdown counter starts at 336,041 and adds one fictional day per five real seconds since the saved `created` timestamp. Changed digits roll upward with a brief amber highlight; reduced motion shows the new number immediately. It includes time away and survives reloads and recovery; it does not change the active-minute leaderboard or advance the displayed year. The subtitle ends “Survivors must eat.”

Airlock contracts use ice cyan headings, brackets and a top border (01 / DISPATCH). Your shop & runners and Supply chain retain their original layouts, borders and spacing, with only dirty amber and muted violet heading text respectively. Contract readiness triggers a brief section scan; pending effects wait up to 60 seconds for the section to become visible and never move the page. Reduced motion uses a static heading border. The separate, more decorated design study remains in `dev/section-style-preview.html`.

A one-second white rabbit transmission opens the five-second splash and the recruiter/head-office letter terminal: a local SVG silhouette, green ghost fragments and a CRT line collapse. Letter typing starts as the rabbit vanishes. Decorative layers never intercept clicks and are removed on timeout, dismissal or dialog replacement. Reduced motion skips the rabbit and shows the letter copy immediately.

Opening a shop now costs ₵25K, with no recruitment requirement. The purchase explains the Shop Owner ×1.1 income rank, removal of the recruiter deduction, and any remaining gang tax or franchise royalty. The saved purchase is followed by a brief shutter rise and illuminated shop-name sign: “YOUR NAME ON THE DOOR. YOUR PROBLEM NOW.” Back to work is immediately usable; reduced motion shows the open storefront and text without animation. Existing shops remain owned.

The standalone high-scores page loads player scores independently of ledger transactions. Initial panels show loading states and unknown totals rather than blank panels and false zeroes. Requests have a 12-second deadline and validate table responses; failed refreshes retain previously loaded data with a visible warning and retry button. Ranking and minute controls use the loaded player data immediately without another network request. `node test/ledger.js` covers delayed tables, HTTP errors, invalid responses, timeouts, retry, preserved data, empty states and mobile layout.
