# Continue Blackjack Buddy with another AI

**How to use:** start a new chat, attach `Blackjack-Buddy-2.2.1.zip`, paste everything in the box below, then
add what you want done on the last line.

---

```
You're taking over "Blackjack Buddy", my Windows desktop game (Electron). The attached zip has the full
source. Before changing anything, read source/blackjack-buddy/HANDOFF.md: it explains the code, the rules,
what's been tested, and which features I've already rejected (don't re-add those without asking).

Key facts:
- Version 2.2.1. Code is in blackjack-buddy/, mostly app.js (game), main.js (window/tray/updates), style.css.
- GitHub: https://github.com/tylercac-cloud/Games, branch claude/happy-lovelace-mv77s0 (the only branch).
  Ignore Fable-5k.zip in that repo; it's a different project.
- Players install from GitHub Releases and get updates automatically. To ship an update: bump "version"
  in package.json, push, then run the "Blackjack Buddy release" workflow in the GitHub Actions tab.
- Nothing has been tested on a real Windows PC yet.

How I like to work:
- Short, plain answers with real numbers. No long explanations while you work; summarize at the end.
- Ask before adding features I didn't ask for. Don't break anything that works.
- Test before you hand anything back, and tell me honestly what you couldn't test.

What I want next:
```

---

**Tips**
- If the AI can't read zip files, attach `HANDOFF.md` and the files it asks for (usually `app.js`).
- If it can use GitHub directly, give it the repo link instead of the zip.
- To install the game yourself: https://github.com/tylercac-cloud/Games/releases/tag/v2.2.1
