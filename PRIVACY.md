# DevDeck — Privacy Policy

_Last updated: 2026-10-19_

DevDeck is a new-tab page for developers. It has no account, no server and no analytics.

## What DevDeck stores

Everything you set up stays in your own browser (`chrome.storage` and `localStorage`) and is never sent to the developer:
- your sites, categories, quick links, to-dos, reminders and settings;
- your GitHub username, city and greeting name.

Uninstalling the extension deletes all of it.

## Network requests

DevDeck sends requests only to fetch the content you see:

| Service | Purpose | What is sent |
|---|---|---|
| Open-Meteo (`api.open-meteo.com`, `geocoding-api.open-meteo.com`) | Weather and city search | Coordinates or the city name you typed |
| GitHub API, `github-contributions-api.jogruber.de` | Your public GitHub activity | The GitHub username you entered |
| Hacker News (Algolia), dev.to, RemoteOK, Remotive | Tech news and job feeds | Nothing personal |
| Wikipedia (`en.wikipedia.org`) | "On this day" tech history | Today's month and day |
| DummyJSON (`dummyjson.com`) | Daily quote | Nothing personal |
| Google Suggest (`suggestqueries.google.com`) | Search suggestions while you type | The text in the search bar |
| Your chosen search engine (Google, Bing, DuckDuckGo, Brave Search, Startpage or Ecosia) | Opens your search in a new tab or window | The text you search for |
| Google favicon service | Site icons | The domain of each saved site |

## Permissions

| Permission | Why |
|---|---|
| `storage` | Keeps your deck and settings. |
| `bookmarks` | Shows and edits your browser bookmarks in the Bookmarks panel. |
| `alarms` | Fires to-do and site reminders on time, even when DevDeck isn't open (shown as DevDeck pop-ups). |
| `scripting`, host access to all sites | Shows a reminder banner at the top of the page you're on, and fetches feeds and icons without browser errors. DevDeck never reads or changes page content. |
| `geolocation` | Local weather, only if you choose "Use my location". |
| `favicon` | Site icons from the browser's own cache. |
| `nativeMessaging` | Talks to the optional DevDeck terminal helper on your computer, only if you install it. |
| `system.cpu`, `system.memory` | Shows CPU and RAM use next to the Settings button. Read on your computer only; never sent anywhere. |

## Sharing

DevDeck does not sell, share or transfer your data, and does not use it for anything except the features above.

## Contact

Questions: open an issue on the project's GitHub repository.
