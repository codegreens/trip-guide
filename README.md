# Trip Guide — Site

Static site published via GitHub Pages. Serves the offline trip guide to phones.

**Current state: smoke test only.** No trip data is in this repo yet.

## Why the content will be encrypted

GitHub Pages on the free plan publishes only from **public** repositories. The
guide holds booking references, ticket numbers, hotel PINs and traveler names,
which is enough for someone to modify or cancel a reservation. So the content is
encrypted on the desktop before it is ever committed, and decrypted in the
browser after an unlock. The repository is public; the ciphertext is not useful
without the passphrase.

Two rules that make or break this:

1. **`content/` is gitignored from the first commit.** One accidental plaintext
   commit lives in the history permanently, even after a delete.
2. **The passphrase carries all the security.** Long and unique. The four digit
   PIN only unlocks the key already stored on a phone; it protects nothing on the
   server.

## Layout

```
Site/
├─ .gitignore
├─ README.md
├─ content/        plaintext guide data — GITIGNORED, never committed
└─ docs/           published by GitHub Pages
   ├─ index.html
   ├─ sw.js                  service worker, precaches for offline
   ├─ manifest.webmanifest   makes Add to Home Screen behave like an app
   └─ *.png                  icons
```

GitHub Pages is configured to serve from the `docs/` folder on `main`.

## Publishing

Nothing to run yet. Once the real guide exists, `Tools/trip-guide-publish.py`
will read the data file, encrypt it, commit and push.

## Cache busting

`sw.js` precaches by filename. After changing any file in `docs/`, bump `CACHE`
at the top of `sw.js` or phones will keep serving the old copy from cache.
