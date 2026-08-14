# Trip Guide — Site

Encrypted offline trip guide, published to GitHub Pages, installed to the home
screen on both phones.

Live at **https://codegreens.github.io/trip-guide/**

---

## The security model in one paragraph

GitHub Pages on the free plan publishes only from **public** repositories, so
this repository is public and anyone can read every byte of it. That is fine,
because everything of substance lives in `docs/guide.enc`, which is AES-256-GCM
ciphertext. `docs/index.html` contains no trip data; it is a reader that fetches
the blob, derives a key from a passphrase typed on the device, decrypts in the
browser, and renders. Nothing is ever sent anywhere.

Two rules make or break this:

1. **`content/` is gitignored and must stay that way.** One plaintext commit is
   permanent, because git history survives deletion. `trip-guide-publish.py`
   refuses to run if the data file is not ignored, but do not rely on that alone.
2. **The passphrase carries all the security.** Long and unique. If it leaks, the
   published ciphertext is readable by anyone who has already downloaded it, and
   rotating it means re-encrypting and republishing.

### What the PIN is and is not

The PIN does not protect anything on the server. After the first passphrase
unlock, the master key is wrapped with a PIN-derived key and stored in
`localStorage` on that device only. The PIN unlocks that local copy.

Someone who takes an unlocked phone and extracts `localStorage` can brute force
the PIN offline: 10,000 combinations at 4 digits against 300,000 PBKDF2
iterations is roughly an hour of compute, 6 digits is roughly four days, 8 digits
is roughly a year. Ten wrong entries in the app wipes the stored key, but that
control only applies to someone typing into the app, not to someone with the raw
storage. Pick the digit count with that in mind.

---

## Layout

```
Site/
├─ .gitignore
├─ README.md
├─ content/                        PLAINTEXT — gitignored, never committed
│  └─ 2608-bj_guide-data.json      source of truth for what the site shows
└─ docs/                           published by GitHub Pages
   ├─ index.html                   unlock screen + reader + renderer
   ├─ guide.enc                    ciphertext, written by the publish script
   ├─ sw.js                        service worker, precaches for offline
   ├─ manifest.webmanifest         makes Add to Home Screen behave like an app
   └─ *.png                        icons
```

GitHub Pages serves from the `docs/` folder on `main`.

---

## Division of labour

Building the guide content is judgment work: which facts belong on a timeline,
what becomes a warning flag, how a day summarises. A script cannot re-derive that
from prose, so it is not automated.

| Job | Who |
|---|---|
| Turn the trip markdowns into `content/*guide-data.json` | Claude, in a session |
| Encrypt, bump the cache, commit, push | `Tools/trip-guide-publish.py` |
| Create the repo, enable Pages, install on phones | Joe |

When bookings firm up, ask Claude to update the guide, then run the publish
script.

---

## Publishing

```
pip install cryptography          # one time
python3 Tools/trip-guide-publish.py
```

It prompts for the passphrase twice, encrypts `content/*guide-data.json` into
`docs/guide.enc`, verifies the round trip before writing, bumps the service
worker cache version, commits and pushes.

```
--dry-run       show the plan, change nothing
--no-push       encrypt and commit, do not push
--verify-only   confirm a passphrase opens the CURRENT guide.enc
```

**Without git installed**, the script still works: it encrypts and bumps the
cache, then says so. Upload the two changed files (`docs/guide.enc` and
`docs/sw.js`) to GitHub by hand.

### Why the cache bump matters

`sw.js` precaches by filename. A phone that already installed the service worker
will keep serving the old `guide.enc` indefinitely unless `CACHE` changes, so the
publish script increments it every run. Do not edit that line by hand.

New data reaches a phone on its next **online** open. An offline phone keeps the
last copy it cached, which is the correct behaviour.

---

## Installing on a phone

1. Open the URL in **Safari** (not the Files app, which blocks JavaScript).
2. Enter the passphrase. Choose a PIN length. Set the PIN.
3. Share → **Add to Home Screen**. Open it from the icon from then on.
4. Turn on Airplane Mode and open it once to confirm offline works.

"Forget this device" at the bottom of the app clears the stored key and forces
the passphrase again. Use it if a phone is lost and you still have it in hand,
or before handing a device to anyone.

---

## Known limitations

- **iOS can evict web app storage under disk pressure.** For a home screen app
  this is generally durable, but it is not a guarantee. If a phone forgets the
  device record, the passphrase re-unlocks it. If it evicts the cached payload
  while offline, the guide will not open until back online. A PDF fallback is the
  answer if that risk matters; it has not been built yet.
- **PBKDF2 at 600,000 iterations takes a moment** on an older phone. That delay
  is the point.
- **`tel:` links need a signal.** The numbers are stored locally; dialling is not.
