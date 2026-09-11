```text
 __  __ _   _ ____ _____ _____    _  _____
|  \/  | | | / ___|_   _| ____|  / \|_   _|
| |\/| | | | \___ \ | | |  _|   / _ \ | |
| |  | | |_| |___) || | | |___ / ___ \| |
|_|  |_|\___/|____/ |_| |_____/_/   \_\_|

        [ YEAR 2099 / COURIER UPLINK ]
        NO SUNLIGHT. NO REFUNDS. EAT.
```

# MustEat

Year 2099. Going outside is illegal. Everyone must eat.

An idle food-delivery game that is also a pyramid scheme. Run deliveries, buy technology, open a shop, recruit runners with a link, take a cut of everything they earn.

**Play:** [https://lukexyz.github.io/musteat/](https://lukexyz.github.io/musteat/?game=new)

## Devnotes

### The look

- Black screens, cold terminals, desolate streets. Noir with a very dry sense of humour.
- **Occasional purple emphasis on a word or payout.** It should feel fancy, illicit and a little hacker-ish. Use it sparingly so it lands.
- The Federation news card uses neutral text, no controls, a slow scrolling label and one headline every 45 seconds.
- Cyan for production and dispatch, amber for the operation and support gear, violet for the dossier. Green means progress; red belongs to the gang.
- Keep the interface dense and readable on mobile. Machinery belongs at the bottom of Portfolio, in a grid.
- Reveals should be short: blinking cursors, fleeting white rabbits, falling digits and stripped redactions. Keep the text steady and respect reduced motion.
- Technology sprites are optional. The footer toggle starts **off**; the original letter badges remain the default.

### New games, old citizens

The README's Play link targets `?game=new`. Every visit through that link creates a fresh browser save and runs the full opening: the 2099 intro, the white rabbit, then citizen registration.

The game replaces `game=new` with a unique `slot` in the address bar. Refreshing or bookmarking that resulting address resumes that instance. It does **not** erase an existing save. High scores and their return links preserve the current instance, and resetting a game resets only that instance.

Opening the [normal game address](https://lukexyz.github.io/musteat/) resumes the browser's default save. To return to a game started from the README, bookmark its instance URL; **save game** also provides that link.

Progress lives in `localStorage`, separately for each browser, website origin and game instance. Autosave runs every five seconds. **Save game → Create recovery code** exports a compressed snapshot; **Restore from code** imports it on another browser, including before registration. Copy a fresh code after making progress. **Replay intro** reruns the opening without resetting anything.

### What lives where

| File | Job |
| --- | --- |
| [`index.html`](index.html) | The game: UI, economy, saves, animations and sheet adapter. No build step. |
| [`index.html#highscores`](index.html#highscores) | In-game high scores, payments and who pays whom. `ledger.html` redirects old links here. |
| [`backend/Code.gs`](backend/Code.gs) | Google Apps Script backend for the shared company sheet. |
| [`NOTES.md`](NOTES.md) | Setup instructions and detailed development notes. |
| [`PORTING.md`](PORTING.md) | Storage contract for moving to another backend. |
| [`dev/`](dev/) | Standalone visual previews and sprite-processing scripts. |
| [`test/`](test/) | Browser checks and a local mock of the shared sheet. |

The sheet stores public player summaries, score snapshots, recruitment relationships, events and credited payments. It is **not** a full cloud save. The game syncs approximately every 15 seconds; the player's detailed setup stays in the browser and recovery code.

### Progression notes

- Technology sits directly under the delivery controls, followed by Upgrades and the quieter next-milestone card.
- Opening a shop costs **₵25K**. It removes the recruiter deduction; the gang's 15% protection tax ends when the first runner joins.
- Portfolio is a **free unlock at ₵20K lifetime earnings**. It records your empire, runners, franchises and owned technology.
- Per-tech earnings record automatic income after deductions, including offline work. Historical earnings from before tracking began are kept in the lifetime total, never invented for individual technologies. Support equipment boosts producers rather than receiving duplicate earnings.
- After 90 active seconds, plus ten taps or any technology purchase, a free Airlock Permit unlocks solo contracts. Every three completed contracts add 1% permanent income, capped at 20%.
- High scores open inside the game at `#highscores`. Back to game restores your previous tab and scroll position; earnings and sync continue while you browse. Direct links work without registration.
- High scores default to **same playtime**: compare recorded lifetime earnings at a chosen active minute. Offline income counts toward earnings; time spent away does not advance active minutes. Missing snapshots are never guessed. Lifetime rankings are also available.

### Run and check

Open `index.html` directly for a quick look. For development with a local shared company and no production sheet writes:

```sh
cd test
npm ci
node sheetmock.js
```

Open `http://127.0.0.1:8787/index.html?game=new`. The mock serves the game and handles player, event and payment records in memory.

Run the browser checks from `test/`:

```sh
node smoke.js
node experience.js
node recovery.js
node portfolio.js
node portfolio-tech.js
node tech-discovery.js
node airlock-terminal.js
node crate-terminal.js
node new-game.js
node federation-news.js
```

`remote.js` checks the shared-sheet protocol against the local mock. Production backend setup is documented in [`NOTES.md`](NOTES.md).

### The original brief

> Make me a single-file browser idle game for a work competition. It is the year 2099, the Ministry has made going outside illegal, and everyone must eat, so food delivery is the only legal job. Tap to run deliveries, buy technology that earns per second, open a shop, and recruit colleagues with an invite link that carries your code, taking 10% of everything they ever earn. Buildings unlock on headcount, not credits. A shared high-score table that doubles as a ledger of who is paying whom. Dark, noir, monospace, funny. It is a pyramid scheme and the game should know it.

Everything after that was arguing about the numbers.
