# How to test FYP360

## 1. Open the app
```bash
cd /Users/talha/Desktop/0.232/FYP360-main/V0.1 && npm run dev
```
Open **http://localhost:3001**.

Tip: use one normal window and private (incognito) windows, so each role stays signed in.

## 2. Admin setup (normal window)
1. Sign in as **hajra** (password = `FIRST_ADMIN_PASSWORD` in `.env.local`).
2. **Staff accounts** → create 1 **Supervisor** and 1 **Jury**. Write down each password (shown once).
3. **Students** → add 2–3 students.
4. **Groups** → create a group, add the students, choose a **lead**, assign the supervisor and jury, then **create the group login** (write it down).
5. **Submissions** → **New deliverable** "FYP-1 report", deadline a few days ahead.
6. **Announcements** → post one test message.

## 3. Student (private window 1)
1. Sign in with the **group login**.
2. **Proposals** → write 3 ideas (abstract 200–250 words + "APIs used"), then submit.
3. **Submissions** → upload a PDF.
4. **Change requests** → send one.
5. **Announcements** → your message should be there.

## 4. Supervisor (private window 2)
1. **Proposal reviews** → recommend one idea.
2. **Submission reviews** → open the PDF → **Changes** with a comment.
3. **Class meetings** → record a meeting (present/absent + mark /100) → **Sign declaration**.

## 5. Student again
- Upload the file again (allowed because changes were requested).

## 6. Supervisor, then Jury
- Supervisor: **approve** the new upload.
- Jury: **Evaluation marks** → proposal (/10) + internal (/60). **Change requests** → approve with a comment.

## 7. Admin again
1. **Proposals** → approve the recommended idea.
2. **Change requests** → final approval.
3. **Results** → check the numbers → **Publish FYP-1**.
4. Student window → **Results** shows marks and every step.

## 8. FYP-2 (optional)
- Admin → **Settings** → "Phase running now" = **FYP-2**.
- Repeat meetings + jury marks for FYP-2.
- Admin → **Results → your group** → enter **External** mark → publish FYP-2.
- **Final** tab shows Pass or Fail.

## Rules built in
- FYP-1 = Advisor 30 + Proposal 10 + Internal 60 → ×0.4 = /40
- FYP-2 = Advisor 10 + Internal 30 + External 20 = /60
- Pass = total ≥ 60 **and** FYP-2 ≥ 36
- Uploads: documents 20 MB, video 50 MB. Late uploads blocked (unless changes requested or the admin gives an extension).
- 2 absences allowed per student per phase; more flags the student for the admin.

## Developer scripts (run inside `V0.1`)
| Command | What it does |
|---|---|
| `node scripts/fulltest.mjs` | 55 automatic database checks, then cleans up after itself |
| `node scripts/uiseed.mjs --rich` | Loads ready-made test accounts (`zz-ui-…`) and a full dummy workflow |
| `node scripts/uiseed.mjs --clean` | Removes that test data |
| `node scripts/apply.mjs <file.sql>` | Applies a migration to Supabase |

Everything you create is saved in the real database. Delete test data when you are done.
