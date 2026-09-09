# MustEat

Year 2099. Going outside is illegal. Everyone must eat.

An idle food-delivery game that is also a pyramid scheme. Run deliveries, buy technology, open a shop, recruit runners with a link, take a cut of everything they earn.

**Play:** https://lukexyz.github.io/musteat/

## The prompt

The whole thing came out of one prompt, more or less:

> Make me a single-file browser idle game for a work competition. It is the year 2099, the Ministry has made going outside illegal, and everyone must eat, so food delivery is the only legal job. Tap to run deliveries, buy technology that earns per second, open a shop, and recruit colleagues with an invite link that carries your code, taking 10% of everything they ever earn. Buildings unlock on headcount, not credits. A shared high-score table that doubles as a ledger of who is paying whom. Dark, noir, monospace, funny. It is a pyramid scheme and the game should know it.

Everything after that was arguing about the numbers.

Technology sits directly beneath the delivery controls; your next purchase follows the tech list. Portfolio shows your delivery operation and colleague earnings. Protection notices live in a side drawer (a bottom sheet on mobile). After 90 active seconds and ten taps or any technology purchase, claim a free Airlock Permit in Upgrades to unlock solo contracts. Complete delivery quotas for credits and earn +1% permanent income every three contracts, up to +20%.

High scores default to **same playtime**: choose an active minute and compare everyone's recorded lifetime earnings at that minute, including income earned while away. A player at minute 80 can compete using their saved minute-12 score. Gameplay keeps running normally. New snapshots start at the next full minute for existing saves; missing history is never guessed. Lifetime rankings remain available.

Single HTML file, no build, saves in your browser. To make every browser share one company, put `backend/Code.gs` behind a Google Sheet as an Apps Script web app and paste its URL into `CONFIG.SHEET_API` (steps in `NOTES.md`). `ledger.html` is the high-score table, with the ledger of who is paying whom underneath. Technical notes in `NOTES.md`. Storage contract for moving it onto another database in `PORTING.md`.

```
cd test && npm install && node smoke.js
```

Additional checks: `cd test && node remote.js && node experience.js && node recovery.js`.

Your citizen has a random invisible ID. The same browser profile and website automatically resume its local save; everyone shares the company and leaderboard. Use **your save → Create recovery code** to copy a portable snapshot, then **Restore from code** on another browser (also available before registration). The long code contains the compressed game state, so it restores the progress at the time you copied it, without a cloud lookup. Keep it private and copy a fresh code after more progress. Close the old browser's game when switching. **replay intro** shows the five-second 2099 opening without resetting your citizen.
