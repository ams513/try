# Stark free trials

The free browser trials of 18 Stark apps, served at https://starkforall.com/try/. Each app is a static folder: open it in a tab and it runs.

## How to check the apps

The apps run entirely in the browser with no network calls. Open an app's `index.html` and read its Content-Security-Policy: it sets `connect-src 'none'`, so the page cannot send anything anywhere. Or open the browser's Network tab while you use an app: nothing leaves the page.

Stark makes software you own: pay once, works offline, your data stays yours.

- Free browser trials: https://starkforall.com/try/
- Apex Protocol: https://starkforall.com/apex/
- Stark: https://starkforall.com/
