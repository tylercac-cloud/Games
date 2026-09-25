Coinbase View-only key (optional)
=================================

Put the key file Coinbase gives you in THIS folder. Any single .json file here is used.
Never paste the key into a chat, email or backup. Never commit or share this folder.

Create the key
1. (Recommended) In Coinbase, create a separate portfolio named "Fable 5k" and move the
   experiment funds into it. The key only sees one portfolio, so the app's equity and
   loss limits then measure the experiment money only.
2. Go to the Coinbase Developer Platform > API keys > Create API key (Secret API key).
3. Portfolio: select "Fable 5k". Permissions: View ONLY. Leave Trade and Transfer OFF.
4. Optional: IP allowlist = your home IP address.
5. Download the key JSON and save it here, e.g. private/coinbase-view-key.json
6. Restart START-WINDOWS.bat. The window should print: Account · OK View-only key accepted.

Safety
- The launcher refuses keys that can trade or transfer.
- The key is read by the local launcher only. The browser never receives it.
- To disconnect: delete the file and restart the launcher. To revoke: delete the key in Coinbase.
