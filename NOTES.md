# MustEat

Year 3019. Lockdown day 328,500. Going outside is illegal. Everyone must eat.

A single-file idle game where every player starts as a delivery runner for whoever
sent them the link, buys gear, opens a shop, recruits colleagues to run for them,
and then builds a supply chain (Depot, Kitchen Plant, Nutrient Factory, Ministry
seat) that is gated on headcount rather than credits. It is a pyramid scheme. That
is the joke. That is also the growth strategy.

`index.v1.html` is the previous build (shop and runners only, four-endpoint
backend). `index.html` is the current one.

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

### Wire the real backend

Set `CONFIG.SHEET_API` at the top of the script. The client then calls:

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/players`, `/events`, `/ledger` | | array of rows |
| POST | `/players` | `{upsert: row}` | anything 2xx |
| POST | `/events`, `/ledger` | `{append: row}` | anything 2xx |

If the platform API has a different shape, change `Sheet.read`, `Sheet.upsert` and
`Sheet.append` only. Any failure falls back to the local sheet so the game never breaks.

## Mechanics in one place

- Ten gear tiers from Hazmat Trainers (₵60) to the Ministry Lunch Portal (₵1.5T), each 10 to 20× the cost and ~7× the output of the last. Cost grows 15% per level. Only the next tier and one classified one after it are shown. Buy ×1 / ×10 / ×100.
- Upgrades: each gear tier has four ×2 doublers (unlocked at 1 / 5 / 25 / 50 owned, priced at 10 / 100 / 5,000 / 100,000× the gear's base cost), five tap upgrades (each tap earns +2% of income per second), seven global +10% upgrades unlocked by delivery counts, and Advanced Cryptochain Bookkeeping (₵10K, three minutes in) which adds a per-line revenue readout to the gear list, with a reveal sequence when bought.
- Commendations: 33 achievements, each +2% income forever.
- Unmarked ration crates appear every 5 to 15 minutes for 13 seconds: Lunch Rush (income ×7 for 77s), Panic Buying (taps ×777 for 13s) or a lump sum (15% of cash, capped at 15 minutes of income).
- Franchising (prestige that recruits): once you have a shop and gear, "Franchise to a colleague" copies a first-come Slack message with a `?fr=CODE` link. You keep playing. The first colleague to register through it gets your gear, upgrades and shop name (numbered, "Kebabsolute Zero №2") as they stand at that moment, and becomes your level 1 runner. On your next sync you get Ration Stamps = cbrt(lifetime earnings / 10M) minus what you already hold, a trophy in the Portfolio tab, and 25% of everything they ever earn instead of the usual 10%. Your clone keeps name, runners, buildings, commendations, cash and stamps, and loses gear, upgrades, drone and contracts. Income × sqrt(1 + 0.2 × stamps).
- Sell to the Ministry is the solo fallback: half the stamps, no royalty, and only enabled when it would raise income by at least a quarter.
- A franchisee posts to the feed each time the franchise passes ₵100K, ₵1M, ₵10M and so on, naming who gets the 25%.
- What a franchisor keeps earning: 25% of the franchisee's lifetime total (which includes the franchisee's own runner cuts), plus the normal 5% and 2.5% from anyone the franchisee recruits (levels 2 and 3). Runners never transfer: they belong to a code, not a shop. A Ministry sale pays stamps only.
- The Portfolio tab starts with your runners' businesses: each downline member with their shop, level, lifetime earnings and rate, and your cut from them, all time and per second.
- The Portfolio tab is also the trophy cabinet: every franchise with the gear and buildings it had, income at handover, live total earned, revenue per minute (from the last few syncs), royalty owed to you, and whether the franchisee is still open.
- Runners pay 10% to their shop owner until they open a shop (₵5,000).
- Everyone with no runners pays 15% to the Sector 7 Provisional Gang on top. Recruit one runner and the gang moves on to them. This is the hook: the only way out of the tax is to send the link.
- Shop owners get 10% / 5% / 2.5% of level 1 / 2 / 3 downline lifetime earnings, forever.
- Buildings need a shop, the previous building, a company-wide citizen count, and people:
  Depot 1 direct runner, Kitchen Plant 2 downline, Nutrient Factory 3 downline, Ministry seat
  3 direct runners one of whom has a Depot. Each helps the people below (faster deliveries,
  higher zone, more value) and pays the owner more (bigger cuts). Scaled for a company of tens.
- Milestones at 2 / 3 / 4 / 6 / 10 citizens declassify each blueprint and the Hoverbike subsidy.
- Ranks: Shop Owner on opening a shop, District Overlord at 2 in your downline, Regional Nutrient Baron at 4, Supreme Ministry of Eating at 8.
- Sectors: each department belongs to the shop with the most runners from it.
- Nudges (idle runners), complaints (runners against owners), vouchers (₵200 to give a
  named colleague ₵250) and share messages are all copy-to-clipboard for Slack. Where the
  clipboard is blocked (iframes, app shells) the text opens in a selectable box instead. No prompt() or confirm() anywhere.
- The intro has a "who sent you" box for the referral code, for links that lost their query string. When the link carried a code the box is sealed (read-only): affiliate codes cannot be removed from invites. The copy suggests recruiting your own runner instead.
- Daily ration pays 10 minutes of income once per 20h, only if you open the page.
- Ministry seat holders issue one decree per day: Mandatory Feast (everyone ×2 for
  10 minutes) or Company-wide Audit (+25 suspicion for everyone outside their chain).
- Ministry suspicion, inspections, acid rain, outbreaks, JustBreathe, bribes, Compliance
  Drone and Exclusive Contracts are unchanged from v1.
