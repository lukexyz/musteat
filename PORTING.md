# Porting the storage to Toqan

MustEat keeps all of its shared state in three flat tables and touches them through one small
adapter. Porting to the Toqan DB inside OpenClaw means writing that adapter against Toqan and
nothing else. This file is the contract.

## What the game needs from a database

Three tables. Every row is a flat object of strings and numbers. No joins, no transactions, no
server-side logic: every calculation (downlines, cuts, ranks, sectors, milestones, high scores)
runs in the browser from the full `players` table.

| table | rows | written by | read by |
| --- | --- | --- | --- |
| `players` | one per citizen, keyed by `id` | the citizen's own client (upsert), plus one franchise-claim upsert by the colleague who takes an offer | everyone, in full, every sync |
| `events` | append-only company feed | whoever did the thing | everyone, newest 12 shown |
| `ledger` | append-only, one row per credited cut or royalty | the client that received the credit | everyone; `ledger.html` and the "From runners" column |

Column meanings are in `NOTES.md` under "The sheet". The columns that matter for a port:

- `players.id` is the primary key. `players.code` is the referral code and must stay unique.
- `players.ref` is the code of the recruiter. The whole pyramid is this one column.
- `players.sprint` and `players.played` are the 30-minute sprint score and the seconds of play behind it.
- `players.claimedBy / claimedName / claimedAt / claimedOffer` are written onto a row by a
  *different* player than the row's owner. See "merge semantics" below.
- `events.kind` and `events.arg` are what the feed renders from. `events.text` is a plain-text
  copy for anything else that reads the table. Nothing from these tables is ever rendered as HTML.

## The three operations

```
read(table)          -> Promise<row[]>        the whole table
upsert(table, row)   -> Promise<row>          insert or merge by row.id
append(table, row)   -> Promise<row>          insert; id is client-generated and unique
```

That is the entire surface. `index.html` has them on the `Sheet` object under
`// ---------------- Sheet adapter ----------------`, and `ledger.html` has a two-line `read`.
Both pages carry a `CONFIG.SHEET_API` string: empty means the localStorage mock, anything else
means the adapter talks to that base URL.

### Merge semantics for upsert

`upsert` must **merge by id and leave unknown columns alone**. A player's client only ever writes
its own columns; the franchise-claim path writes four extra columns onto someone else's row. If
upsert replaced the whole row, either the owner would wipe the claim or the claimer would wipe the
owner. A merge (Object.assign, a SQL `ON CONFLICT DO UPDATE SET` for the supplied columns, a
document `$set`) is what the local mock does and what the port must do.

### Ordering and consistency

- Reads are eventually consistent. Clients sync every 30 seconds and after their own writes.
  Seeing a row a few seconds late is fine. Seeing it never is not.
- `append` rows carry a client timestamp `ts` in ms. Readers sort by it. Server time is not needed.
- Ids are generated client-side: a letter prefix plus 8 base-36 characters. Collisions are not
  handled because they are not expected in a company-sized game. If Toqan needs its own key, keep
  the client id as a unique column and return the row unchanged.

### Sizes

Local mode caps `events` at 300 rows and `ledger` at 3,000 to fit localStorage. A real database
does not need the cap, but `ledger` grows by one row per (payer, sync) whenever anything is owed,
so it is the only table that gets large. Fifty players syncing every 30 seconds for a week is
roughly 100K rows if everyone always has runners earning. Reading it in full on every sync is what
the code does today; if that gets slow, the two readers only need `ledger` for sums per `to`
(the "From runners" column) and the latest 10 rows, so a server-side aggregate would replace it.

## How to port

1. Decide the shape Toqan gives you: REST endpoints, a client SDK, or a document store.
2. In `index.html`, replace the bodies of `Sheet.read`, `Sheet.upsert` and `Sheet.append` (or the
   `Sheet.remote` helper if it is REST with a different shape). Keep `Sheet.guarded`: any failure
   falls back to the local mock so the game never breaks in front of a colleague.
3. In `ledger.html`, replace `read(table)`.
4. Set `CONFIG.SHEET_API` on both pages to anything non-empty. It is only ever tested for truthiness
   and passed to your adapter, so a base URL, a database name or the string `toqan` all work.
5. Run `cd test && node smoke.js`. It drives the real page and a second player in another tab
   through registration, recruiting, cuts, a franchise handover and the ledger page. It uses the
   local mock, so also open two browsers against the real backend and recruit one from the other.

### Skeleton

```js
const Sheet = {
  async read(table) {
    return this.guarded(() => toqan.collection(table).all(), () => this.local()[table] || []);
  },
  async upsert(table, row) {
    return this.guarded(() => toqan.collection(table).merge(row.id, row), () => { /* local mock as today */ });
  },
  async append(table, row) {
    return this.guarded(() => toqan.collection(table).insert(row), () => { /* local mock as today */ });
  },
  // guarded, local, putLocal unchanged
};
```

Whatever `toqan.collection(...)` really looks like, those three lines are the whole port.

## Things the port must not change

- Rows are data. The feed and every table render through `esc()` and from `kind` + `arg`, never
  from `text` as HTML. Keep that: a shared table anyone can write to is untrusted input.
- The owner of a `players` row is the only client that writes its game columns. Do not add a
  server-side "fix-up" that rewrites totals; the ledger is self-reported by design and the joke
  depends on it.
- `ledger.html` reads the same three tables as the game. It has no other data source.
