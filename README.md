# MustEat

Year 3019. Going outside is illegal. Everyone must eat.

An idle food-delivery game that is also a pyramid scheme. Run deliveries, buy technology, open a shop, recruit runners with a link, take a cut of everything they earn.

**Play:** https://lukexyz.github.io/musteat/

## The prompt

The whole thing came out of one prompt, more or less:

> Make me a single-file browser idle game for a work competition. It is the year 3019, going outside has been illegal since 2099, and everyone must eat, so food delivery is the only legal job. Tap to run deliveries, buy technology that earns per second, open a shop, and recruit colleagues with an invite link that carries your code, taking 10% of everything they ever earn. Buildings unlock on headcount, not credits. A shared high-score table that doubles as a ledger of who is paying whom. Dark, noir, monospace, funny. It is a pyramid scheme and the game should know it.

Everything after that was arguing about the numbers.

Single HTML file, no build, saves in your browser. `ledger.html` is the high-score table, with the ledger of who is paying whom underneath. Technical notes in `NOTES.md`.

```
cd test && npm install && node smoke.js
```
