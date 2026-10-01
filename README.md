# Payroll Transaction list, Sprint 2 — workshop demo page

This is the practice website for **Playwright Part 2: from requirements to bugs**, the follow-up to
*Playwright for beginners*. It is the same payroll screen you tested in Part 1, one sprint later:
the developers have fixed what you reported and built the next set of features. It is the page you
will be testing during the session.

> ### 🚧 Under construction
> The page is not here yet. It will be published before the workshop, and this README will be
> updated with the build stamp at the same time. Until then, this repository holds only this file.

> ### ⚠️ This is not a real system
> Everything here is invented — every name, every amount, every company. It is not a Visma product,
> there is no database behind it, and nothing you do on this page is sent anywhere. You cannot
> break it.

---

## 👉 The quickest way: just open the link

**<https://armands-kiritis.github.io/vl-playwright-course-2/>**

Nothing to download. Nothing to install. Once the page is published, if that link opens a payroll
screen, **you are ready** — skip to [Signing in](#signing-in).

Use this link unless the facilitator tells you otherwise.

> **Coming from Part 1?** This is a different address from the Part 1 page. Part 1's page stays as
> it was; the tests you kept from Part 1 can be pointed at this one.

---

## What is new in Sprint 2

The release brings the screen up to the **Phase 2 requirements**. You will get the full
requirements as a handout in the session; in short:

| Requirement | What it adds |
|---|---|
| **FR-10 — Saved views** | Save your filters and columns as a named view and pick it again later |
| **FR-11 — Inline amount edit** | Correct the amount on a Pending transaction without leaving the screen |
| **FR-12 — Reject with reason** | Reject a Pending transaction, with a mandatory reason that shows in its history |
| **FR-13 — Paging** | Choose 25, 50 or 100 rows per page |
| **FR-14 — Sorting** | Sort by any column |

There is also more data than in Part 1 — a bigger payroll run, so paging has something to page
through.

Whether all of it works as the requirements say is what the workshop is for.

---

## If the link does not work

Some office networks block external websites. If the link above gives you an error, you can run the
same page on your own computer instead. It takes about five minutes.

You need to do three things: **download the folder**, **start a small program that serves the
page**, and **open it in your browser**.

> **Short on time or unsure?** If you already have Claude set up with access to your files, you can
> skip most of this. Download and unzip the folder (steps 1 and 2), then ask Claude:
> *"Start a web server in this folder and tell me the address to open."*

### Step 1 — Download the folder

1. Go to <https://github.com/Armands-Kiritis/vl-playwright-course-2>
2. Click the green **`< > Code`** button near the top right.
3. Choose **Download ZIP**.
4. The file lands in your **Downloads** folder as `vl-playwright-course-2-main.zip`.

### Step 2 — Unzip it properly

**This step is where most people get stuck, so it is worth doing carefully.**

Right-click the downloaded ZIP file → **Extract All…** → **Extract**.

> **Why this matters:** on Windows, double-clicking a ZIP file shows you what is inside it, and it
> looks exactly like a normal folder. It is not. If you open the page from in there, Windows quietly
> copies it to a hidden temporary place and the page will not work properly. **Always extract
> first.**

You should now have a real folder called `vl-playwright-course-2-main` containing `index.html`,
`app.js`, `data.js` and `styles.css`.

### Step 3 — Start the page

The page needs to be *served* rather than just opened. Open **PowerShell** (press the Windows key,
type `powershell`, press Enter) and check what you have:

```
node --version
```

A version number like `v22.14.0` means you have **Node.js** — use option A. An error? Try
`python --version`; a version number means you have **Python** — use option B. If neither works,
install Node.js from <https://nodejs.org> (the **LTS** version), close and reopen PowerShell, and
use option A.

#### Option A — you have Node.js

```
cd "$env:USERPROFILE\Downloads\vl-playwright-course-2-main"
npx serve -l 8000
```

The first time, it asks `Ok to proceed? (y)` — type **y** and press Enter.

#### Option B — you have Python

```
cd "$env:USERPROFILE\Downloads\vl-playwright-course-2-main"
python -m http.server 8000
```

Then open **<http://localhost:8000>** in your browser.

### Step 4 — Leave it running

The PowerShell window has to **stay open** while you use the page. It looks frozen — that is
normal. Minimise it; do not close it. Press **Ctrl + C** in it when you are finished.

> **Did Part 1 on your own computer?** Part 1's copy also used port 8000. Stop it first, or use
> `8001` for this one and open `http://localhost:8001`.

---

## Signing in

The username and password are printed on the sign-in page, so there is nothing to remember. They
are fake; there is nothing real behind them.

---

## Checking you are on the right version

Look at the **bottom left** of the page for the build stamp. Sprint 2's stamp starts with
**`sprint2`** — if yours shows `2026-09-18a`, you are on the Part 1 page.

If the facilitator asks you to *"read back your build stamp"*, that is the line they mean. If yours
does not match theirs, press **Ctrl + Shift + R** to force the browser to refresh, or download the
folder again.

---

## Other versions of the page

During the session you may be asked to switch to a later build. You do that by adding a bit to the
end of the web address:

| Add this to the address | What it is |
|---|---|
| *(nothing)* | The version you start on |
| `?variant=b` | A later build where something visibly changed |
| `?variant=c` | A later build where something changed that you cannot see |

The version you are on is always shown in the footer, next to the build stamp.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| The page is blank or unstyled | You probably opened it from inside the ZIP. Go back to [Step 2](#step-2--unzip-it-properly) and extract it first. |
| `The term 'node' is not recognized` | Node.js is not installed, or you did not reopen PowerShell after installing it. |
| `Port 8000 is already in use` | Something else — perhaps your Part 1 copy — is using it. Use port `8001` instead. |
| The address starts with `file:///` | You opened the file directly. Serve it (Step 3); the address must start with `http://`. |
| The build stamp says `2026-09-18a` | That is the Part 1 page. Use the link at the top of this README. |

Still stuck? Bring it to the session — getting everyone onto the page is the first thing we do.

---

## What is in this folder

Once the page is published:

| File | What it is |
|---|---|
| `index.html` | The page itself |
| `styles.css` | How it looks |
| `data.js` | The payroll data — fixed values, identical on every machine |
| `app.js` | How the page behaves |

Plain HTML, CSS and JavaScript. No build step, no dependencies, and no internet needed once you
have the folder.

---

## Good to know

- **Approvals, rejections and edits are not kept.** Reload and the payroll data is back to the
  start.
- **Your own settings are kept in your browser** — which columns you show and the views you save.
  That is part of what Sprint 2 promises. To start completely fresh, open the page in a private
  window.
- It works in Chrome, Edge, Firefox and Safari.
