# Chrome Web Store — submission kit

## Build the upload

```bash
npm run package
```

This writes `release/devdeck-<version>.zip` from `dist/`. Upload that zip in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). Use the plain build (`npm run build`), not `build:demo`.

Before each upload, bump `version` in `public/manifest.json`.

## Listing

- **Name:** DevDeck
- **Summary (≤132 chars):** A developer new tab: your sites by category, to-dos with reminders, GitHub activity, tech news and jobs.
- **Category:** Developer Tools
- **Language:** English

**Description:**

DevDeck replaces the new tab with a dashboard built for developers.

- Your sites in categories and subcategories, with quick links and recently visited sites
- To-dos and site reminders that pop up at the top of any page, even when DevDeck is closed
- GitHub contribution graph, tech news, remote jobs and weather
- "On this day" in tech history and a daily quote
- Your browser bookmarks in a searchable panel and Tree View
- Dark and light themes, accent colours and clock faces

No account and no tracking. Everything stays in your browser.

## Assets you still need to make

- 128×128 icon (already at `public/icons/icon-128.png`)
- At least 1 screenshot, 1280×800 or 640×400 (take them from the built extension)
- Small promo tile, 440×280 (optional)

## Privacy tab

- **Single purpose:** replaces the new-tab page with a developer dashboard.
- **Permission justifications:** copy the table in [PRIVACY.md](PRIVACY.md).
- **Remote code:** No. All code ships in the package; fonts are bundled.
- **Data usage:** no user data is collected or sent to the developer. Tick "I do not sell or transfer user data…".
- **Privacy policy URL:** host [PRIVACY.md](PRIVACY.md) publicly, for example on GitHub, and paste its URL.

## Review notes

Host access to all sites (`<all_urls>`) and `scripting` lead to a longer in-depth review. They are needed for reminders shown on the current page. Narrowing them would mean reminders only appear as system notifications.
