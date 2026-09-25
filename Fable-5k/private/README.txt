Coinbase View-only key (optional)
=================================

Put the key file Coinbase gives you in THIS folder. Any single .json file here is used.
Never paste the key into a chat, email or backup. Never commit or share this folder.

Create the key
1. (Only if the portfolio holds money outside the challenge) In Coinbase, create a separate portfolio named "Fable 5k" and move the
   experiment funds into it. The key only sees one portfolio, so the app's equity and
   loss limits then measure the experiment money only.
2. Go to the Coinbase Developer Platform > API keys > Create API key (Secret API key).
3. Portfolio: select "Fable 5k". Permissions: View ONLY. Leave Trade and Transfer OFF.
   Advanced Settings > Signature algorithm: ECDSA.
4. Optional: IP allowlist = your home IP address.
5. Download the key JSON and save it here, e.g. private/coinbase-view-key.json
6. Restart START-WINDOWS.bat. The window should print: Account: OK View-only key accepted.

Don't worry about the exact filename or extension. If the download lands as .txt, gets a
" 2" added by your OS, or has no extension at all (common when saving from a phone), Fable
still finds it as long as its content is the Coinbase key JSON (or the file is the only
other thing in this folder besides this README).

Safety
- The launcher refuses keys that can trade or transfer.
- The key is read by the local launcher only. The browser never receives it.
- To disconnect: delete the file and restart the launcher. To revoke: delete the key in Coinbase.

Adding money later
- Put it in the same portfolio, then enter the running total under "Net deposits since start"
  in the Capital plan account panel. Withdrawals are negative.

Crypta's AI (optional)
- Without a brain, Crypta answers from her built-in guide.
- Free option: install Ollama (ollama.com/download), start it, and download a model from Crypta's
  settings. Nothing goes in this folder for that.
- For full answers: create an API key at console.anthropic.com. A Claude Pro subscription does NOT
  include API credits; the API is prepaid/billed separately there, save it in this folder as a text file (e.g. anthropic-key.txt), and restart the launcher.
- Set a monthly cap in Crypta's settings (default $5). Usage is tracked in crypta-usage.json here.
- Same rule as the Coinbase key: never paste it into any chat, including Crypta's.
