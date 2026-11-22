# IBEAU Student Progress Report

A static website (no build step) with a staff login. After logging in, staff choose a batch, see that batch's students, and open the progress-report form. Each student is saved to Google Drive, and results are sent to the parent or student by WhatsApp.

**Flow:** Login → Select batch → Student list of that batch → Main form

## Folder structure

```
ibeau-progress-report/
├── index.html                  the page (login, batch, student list and form screens)
├── css/style.css               all styling (responsive + print / A4 rules)
├── js/
│   ├── config.js               ← the only file you edit before deploying
│   ├── api.js                  talks to the Google script (session handling)
│   ├── app.js                  the report form, saving, sharing
│   └── auth.js                 login → batch → student list screens
├── assets/favicon.svg          browser-tab icon
├── google-apps-script/Code.gs  the server part (paste into Google Apps Script)
├── robots.txt                  asks search engines not to index the site
└── README.md
```

## 1. Prepare your Google Sheet

One spreadsheet with these tabs. The first row of each tab holds the column names.

| Tab | Columns | Notes |
|---|---|---|
| **Users** | `Email`, `Password`, `Batch` | `Batch` = the batch the person may open. Several: `Batch A, Batch B` (comma, semicolon or new line). `ALL` = every batch in the Batches tab |
| **Batches** | `Batch Name` | The list of all batches. A user's batch is only offered if it is listed here |
| **Students** *(optional)* | `Reg No`, `Name`, `Batch`, `Student Phone`, `Parent Phone`, `Place` | The roster that is shown for a batch. Students saved from the form also appear in their batch, even if this tab does not exist |

Tips

- Format the **Password** column as *Plain text* so passwords such as `0123` keep their leading zero.
- Passwords can be stored as plain text, or better as a SHA-256 hash (64 characters). In the script editor, put the password in the `hashPassword` function, run it, and copy the value from the log into the Password column. Staff still type their normal password.
- The spreadsheet ID is the long text in its address: `docs.google.com/spreadsheets/d/`**`THIS-PART`**`/edit`.

## 2. Deploy the Google script

Do this once, signed in to the Google account whose Drive should keep the marklists (it must be able to open the sheet above).

1. Go to https://script.google.com and choose **New project**.
2. Delete the sample code and paste in `google-apps-script/Code.gs`.
3. Paste your spreadsheet ID into `SPREADSHEET_ID` at the top.
4. **Deploy → New deployment → Web app**. *Execute as*: **Me**. *Who has access*: **Anyone**. Approve the permissions Google asks for (Sheets and Drive).
5. Copy the web-app link.
6. Open `js/config.js` and paste the link into `BACKUP_URL`.

After changing `Code.gs` later use **Deploy → Manage deployments → edit → New version**.

### What the script keeps in Drive

- Folder **IBEAU Marklists** → one sub-folder per batch → `RegNo - Name.pdf` and `.json`
- Inside each batch folder, a **Shared** folder with the PDFs made for WhatsApp links (a new file each time, so earlier links keep working)
- Sheet **IBEAU Marklist Log** (a separate file, one row per student, with a Batch column). It never contains passwords.

Earlier files saved directly in *IBEAU Marklists* (before batches existed) are not shown in any batch.

## 3. Deploy the website

Upload the folder to any static host:

- **Netlify** – drag the folder onto https://app.netlify.com/drop
- **GitHub Pages** – push to a repository, Settings → Pages
- **Vercel / Cloudflare Pages** – no build command, output folder is the project root
- **Any web host** – upload the contents to `public_html`

The page is fully responsive (phone, tablet, desktop) and the printed / saved PDF is always A4.

## How login and access work

- The password is sent once, over HTTPS, to your Google script. The script checks it against the Users tab. The password list never reaches the browser.
- A correct login returns a temporary session code (valid for up to 6 hours, kept only until the browser tab is closed) and the batches that user may open.
- Every later request (student list, save, find, share) must carry that code **and** a batch the user is allowed to open. The server checks this each time, so a user cannot read or save another batch's students.
- After 5 wrong passwords an e-mail address is locked for 10 minutes.
- The login screen is only the front door of the page. The protection is on the server: without a valid session no student data can be read or saved, whatever is changed in the browser.

## Using the form

| Feature | Notes |
|---|---|
| Module selector | Enter marks, dates and attendance for Module 1–4 one at a time; earlier entries are kept |
| Total sessions | Counted from the module's start and end date (class days under *Optional: class days*; the number can be overwritten) |
| Module 4 marks | Management (700) + Assessment (300) + Classroom points (2,500) = 3,500; the grade comes from this total |
| RTC assessment score | Out of 50, shown separately; not part of the 3,500 |
| At a Glance and parent note | Use only the Module 4 result; attendance is the total of all modules |
| Saving | Opening the student list, changing batch, logging out or changing the student name saves the student on screen |
| Find saved marks | Search window for a register number inside the chosen batch |
| Share result | **WhatsApp → Parent** / **WhatsApp → Student** open `wa.me/<number>` with the result and a link to the PDF report |

### Grade scale

Edit the `GRADES` line near the top of `js/app.js`:

```js
const GRADES=[[90,"A+"],[80,"A"],[70,"B+"],[60,"B"],[50,"C"],[40,"D"],[0,"F"]];
```

### Running without login

For local testing only, set `REQUIRE_LOGIN = false` in `js/config.js`. The form then opens directly, without any cloud features.

## Notes

- The PDF library loads from the internet (CDN), so saving or sharing a PDF needs a connection.
- **WhatsApp links:** the PDF behind a WhatsApp link can be opened by anyone who has that link (it is long and cannot be guessed, but it is not password-protected). Delete files in the batch's *Shared* folder to switch a link off. WhatsApp cannot attach a file from a web link, which is why the message carries a link. If the PDF link cannot be made, the message is still opened with the result text only.
- `robots.txt` and a `noindex` tag ask search engines to stay away; they do not password-protect the page itself.
