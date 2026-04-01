# Full Portal Clone & Firebase Setup Guide
**TechFlow Solutions — Written from hard lessons learned**
**Last Updated: 2026-03-29**

---

## Overview

This guide covers cloning `techflow-client-portal` into a new branded portal from scratch — correctly, with zero wasted steps. Every section reflects a real mistake made and fixed.

---

## PHASE 1 — Create GitHub Repo (Do This FIRST)

> ⚠️ You must create the GitHub repo BEFORE running anything locally.

1. Go to: https://github.com/new
2. Set repository name (e.g. `demo-contractor-portal`)
3. Set to **Public** or **Private** (your choice)
4. ❌ Do NOT check "Initialize with README"
5. ❌ Do NOT check "Add .gitignore"
6. ❌ Do NOT check "Choose a license"
7. Click **Create repository**

---

## PHASE 2 — Create Firebase Project (Do This SECOND)

> ⚠️ You need the Firebase project created before you can configure your code.

1. Go to: https://console.firebase.google.com
2. Click **Add project**
3. Name it (e.g. `demo-contractor-portal`)
4. Disable Google Analytics (not needed for portals)
5. Click **Create project**

### 2a — Enable Firestore

1. In the Firebase Console → **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode**
4. Select region: `us-central1`
5. Click **Enable**

### 2b — Enable Authentication

1. In the Firebase Console → **Authentication**
2. Click **Get started**
3. Click **Email/Password** → Enable it → Save

### 2c — Register Your Web App

1. In **Project Settings** (gear icon) → **Your apps**
2. Click the `</>` web icon
3. Give it a nickname (e.g. `demo-portal-web`)
4. ❌ Do NOT check "Also set up Firebase Hosting"
5. Click **Register app**
6. **COPY the firebaseConfig object** — you need it in Phase 4

```js
// It looks like this — save it somewhere:
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "1:...:web:..."
};
```

---

## PHASE 3 — Clone the Repo Locally

Open CMD and navigate to your projects folder:

```cmd
cd C:\Users\Reggie\Documents\Websites
```

### 3a — Copy the source folder

```cmd
xcopy techflow-client-portal demo-contractor-portal /E /I
```

### 3b — Enter the new folder

```cmd
cd demo-contractor-portal
```

### 3c — Remove ONLY these items

```cmd
rmdir /s /q node_modules
rmdir /s /q .git
del /q .firebaserc
```

> ✅ Keep `firebase.json` — you need it
> ✅ Keep `functions/` — you need it
> ✅ Keep `firestore.rules` — you need it
> ✅ Keep `firestore.indexes.json` — you need it
> ✅ Keep `.github/workflows/deploy.yml` — you need it

---

## PHASE 4 — Update Config Files

### 4a — Update Firebase credentials

Open `src/config/firebase.js` and replace the config object with the one you copied in Phase 2c:

```js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "PASTE_NEW_VALUE",
  authDomain: "PASTE_NEW_VALUE",
  projectId: "PASTE_NEW_VALUE",
  storageBucket: "PASTE_NEW_VALUE",
  messagingSenderId: "PASTE_NEW_VALUE",
  appId: "PASTE_NEW_VALUE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
```

### 4b — Update `.firebaserc`

Open `.firebaserc` and replace the project ID:

```json
{
  "projects": {
    "default": "your-new-project-id"
  }
}
```

### 4c — Update CNAME file for custom domain

Open `public/CNAME` and make sure it contains your new domain:

```
demo.techflowsolutions.ca
```

> ⚠️ This file is what tells GitHub Pages which custom domain to serve on. If it still says the old domain (e.g. `portal.techflowsolutions.ca`) the site will 404 on the new domain even if everything else is correct.

If the file doesn't exist, create it:
```cmd
echo demo.techflowsolutions.ca > public\CNAME
```

### 4d — Update white-label config

Open `src/config/client.js` and update for the new client/demo:

```js
const clientConfig = {
  companyName: "Demo Construction Company",
  companyTagline: "Professional Contractor Invoice System",
  companyPhone: "(555) 123-4567",
  companyEmail: "demo@techflowsolutions.ca",
  primaryColor: "#2563eb",
  secondaryColor: "#1e40af",
  logoUrl: "/logo.png",
};
```

---

## PHASE 5 — Install Dependencies

```cmd
npm install
```

```cmd
cd functions && npm install && cd ..
```

---

## PHASE 6 — Point Firebase CLI at New Project

```cmd
firebase use your-new-project-id
```

Verify it switched correctly — you should see:

```
Now using alias default (your-new-project-id)
```

---

## PHASE 7 — Set Up Secrets

Your functions use secrets stored in Firebase Secret Manager. You need to create them in the new project.

Run each of these and paste in the value when prompted:

```cmd
firebase functions:secrets:set STRIPE_SECRET_KEY
```

```cmd
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

```cmd
firebase functions:secrets:set ZOHO_EMAIL_PASSWORD
```

> 💡 For a DEMO project where you don't need Stripe, type `dummy` as the value for both Stripe secrets. The functions will load but Stripe won't actually work — which is fine for demo purposes.

> ⚠️ If you skip this step, the entire Firebase deploy will fail — not just the Stripe functions. The secrets must exist even if they're dummy values.

---

## PHASE 8 — Deploy to Firebase

```cmd
firebase deploy
```

### What to expect:

- Firestore rules → ✅ compiles and deploys
- Firestore indexes → ✅ deploys
- Functions → creates all 6 functions (takes 3-5 minutes)
- Auth → ✅ deploys

### If prompted about container image cleanup policy:

Type `1` (1 day) for demo/dev projects to avoid storage costs. Type `30` for production.

### If one function fails (e.g. `previewInvoicePDF`):

This is a transient Cloud Build issue on new projects. Just retry that one function:

```cmd
firebase deploy --only functions:previewInvoicePDF
```

---

## PHASE 9 — Copy Firestore Rules From Source Project

> ⚠️ Without correct rules the portal will show "Could not load invoices" even if the data and login are both correct.

### 9a — Get the rules from the source project

Go to:
```
https://console.firebase.google.com/project/techflow-website-2026/firestore/rules
```

Copy everything in the rules editor.

### 9b — Paste into the new project

Go to:
```
https://console.firebase.google.com/project/YOUR-NEW-PROJECT-ID/firestore/rules
```

Paste the rules in and click **Publish**.

> 💡 Using the exact same rules from the original means they are already tested and working. No need to rewrite them from scratch.

---

## PHASE 10 — Backup Firestore Data From Source Project

Before you can restore data into the new project, you need to export it from the original project into a Google Cloud Storage bucket.

### 9a — Make sure the source bucket exists

Go to: https://console.cloud.google.com/storage/browser?project=SOURCE-PROJECT-ID

If you don't already have a backup bucket, create one:

```cmd
gcloud config set project SOURCE-PROJECT-ID
```

```cmd
gcloud storage buckets create gs://YOUR-BACKUP-BUCKET-NAME --location=us-central1 --project=SOURCE-PROJECT-ID
```

> 💡 Bucket name must be globally unique. A good convention is `PROJECT-ID-firestore-backup` e.g. `techflow-website-2026-firestore-backup`

### 9b — Export Firestore data to the bucket

```cmd
gcloud config set project SOURCE-PROJECT-ID
```

```cmd
gcloud firestore export gs://YOUR-BACKUP-BUCKET-NAME --project=SOURCE-PROJECT-ID
```

This will output something like:

```
Done. [https://firestore.googleapis.com/...]
outputUriPrefix: gs://YOUR-BACKUP-BUCKET-NAME/2026-03-29T15:15:43_22600
```

**Copy that full export path** — you need it in Phase 10. It looks like:
`gs://YOUR-BACKUP-BUCKET-NAME/2026-03-29T15:15:43_22600/`

### 9c — Verify the export completed

```cmd
gsutil ls gs://YOUR-BACKUP-BUCKET-NAME/
```

You should see the dated export folder listed. If it's there, your backup is good.

---

## PHASE 11 — Restore Firestore Data Into New Project

If you have a Firestore backup in Google Cloud Storage from another project, follow these steps.

### 10a — Grant the new project's Firestore service agent access to the backup bucket

The service agent email follows this pattern:
`service-{PROJECT_NUMBER}@gcp-sa-firestore.iam.gserviceaccount.com`

Find your project number in: Firebase Console → Project Settings → General → Project number

Switch to the project that OWNS the backup bucket:

```cmd
gcloud config set project SOURCE-PROJECT-ID
```

Grant objectViewer:

```cmd
gcloud storage buckets add-iam-policy-binding gs://YOUR-BACKUP-BUCKET --member=serviceAccount:service-DESTINATION_PROJECT_NUMBER@gcp-sa-firestore.iam.gserviceaccount.com --role=roles/storage.objectViewer --project=SOURCE-PROJECT-ID
```

Grant legacyBucketReader (also required — objectViewer alone is NOT enough):

```cmd
gcloud storage buckets add-iam-policy-binding gs://YOUR-BACKUP-BUCKET --member=serviceAccount:service-DESTINATION_PROJECT_NUMBER@gcp-sa-firestore.iam.gserviceaccount.com --role=roles/storage.legacyBucketReader --project=SOURCE-PROJECT-ID
```

Verify both grants applied:

```cmd
gsutil iam get gs://YOUR-BACKUP-BUCKET
```

### 10b — Provision the Firestore service agent

```cmd
gcloud beta services identity create --service=firestore.googleapis.com --project=DESTINATION-PROJECT-ID
```

### 10c — Switch to destination project and import

```cmd
gcloud config set project DESTINATION-PROJECT-ID
```

```cmd
gcloud firestore import gs://YOUR-BACKUP-BUCKET/YOUR-EXPORT-FOLDER/ --project=DESTINATION-PROJECT-ID
```

---

## PHASE 12 — Set Up GitHub Pages Deployment

### 10a — Push code to GitHub

```cmd
git init
git add .
git commit -m "Initial commit - cloned from techflow-client-portal"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/YOUR-REPO-NAME
git push -u origin main
```

### 10b — Wait for GitHub Action to run

Go to: `https://github.com/YOUR-USERNAME/YOUR-REPO/actions`

Watch the **Deploy to GitHub Pages** workflow run. It should complete in about 60-90 seconds.

### 10c — Configure GitHub Pages source

> ⚠️ This is the step most people miss — GitHub Pages must be set to serve from the `gh-pages` BRANCH, not from `main`.

1. Go to: `https://github.com/YOUR-USERNAME/YOUR-REPO/settings/pages`
2. Under **Build and deployment → Source**, select **`GitHub Actions`**

> Why GitHub Actions and not "Deploy from a branch"? Because setting it to "Deploy from a branch → gh-pages" causes GitHub to run a SECOND automatic builder from `main` (raw source code) that overwrites your built files. Selecting "GitHub Actions" tells GitHub to let your workflow handle everything.

### 10d — Set up Custom Domain (if applicable)

1. In the same Pages settings page, enter your custom domain (e.g. `demo.techflowsolutions.ca`)
2. Make sure your DNS has a CNAME record pointing to `YOUR-USERNAME.github.io`
3. Check **Enforce HTTPS** once DNS propagates

---

## PHASE 13 — Create Test Auth User

The new Firebase project has zero users. Create a test account to log in with:

1. Go to: `https://console.firebase.google.com/project/YOUR-PROJECT-ID/authentication/users`
2. Click **Add user**
3. Enter an email and password
4. Click **Add user**

---

## PHASE 14 — Fix Admin UID in Firestore

> ⚠️ This is the most commonly missed step. The Firestore data was restored from the old project, so the `admins` collection contains the OLD project's UIDs. Your admin user will not have admin access until this is fixed.

### 14a — Get your new UID

Go to:
```
https://console.firebase.google.com/project/YOUR-PROJECT-ID/authentication/users
```
Find your admin email and copy the **User UID** shown next to it.

### 14b — Update the admins collection

Go to:
```
https://console.firebase.google.com/project/YOUR-PROJECT-ID/firestore/data/admins
```

1. Click **Add document**
2. Set Document ID to your **new UID** (paste it exactly)
3. Add a field: `email` = `your-admin@email.com` (string)
4. Click **Save**

### 14c — Delete the old UID document

Click on the document with the OLD UID (the one that was already there) and delete it — it's a dead reference from the old project and serves no purpose.

---

## PHASE 15 — Final Commit and Push

After all config changes:

```cmd
git add .
git commit -m "Configure for new project"
git push
```

If push is rejected with "fetch first" error (happens on fresh repos):

```cmd
git push --force
```

---

## ✅ Done Checklist

- [ ] Firestore export run on source project (`gcloud firestore export`)
- [ ] Export folder path copied (e.g. `gs://bucket/2026-03-29T...`)
- [ ] Export verified with `gsutil ls`
- [ ] Firebase project created
- [ ] Firestore enabled
- [ ] Auth enabled (Email/Password)
- [ ] Web app registered, firebaseConfig copied
- [ ] Folder copied with `xcopy`
- [ ] `node_modules`, `.git`, `.firebaserc` deleted
- [ ] `firebase.json`, `functions/`, `.github/` kept
- [ ] `src/config/firebase.js` updated with new credentials
- [ ] `.firebaserc` updated with new project ID
- [ ] `public/CNAME` updated with new custom domain
- [ ] `src/config/client.js` updated with new branding
- [ ] `npm install` run in root
- [ ] `npm install` run in `functions/`
- [ ] `firebase use NEW-PROJECT-ID` run
- [ ] All secrets set (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ZOHO_EMAIL_PASSWORD`)
- [ ] `firebase deploy` completed successfully
- [ ] Firestore rules copied from source project and published
- [ ] Code pushed to GitHub
- [ ] GitHub Action ran successfully
- [ ] GitHub Pages set to **GitHub Actions** source
- [ ] Custom domain configured in GitHub Pages settings
- [ ] Test auth user created
- [ ] New UID copied from Authentication tab
- [ ] New UID document added to `admins` collection in Firestore
- [ ] Old UID document deleted from `admins` collection
- [ ] Logged in and invoices load correctly
- [ ] Site loads and login works

---

## Common Errors Quick Reference

| Error | Cause | Fix |
|---|---|---|
| `PERMISSION_DENIED` on Firestore import | Service agent missing `legacyBucketReader` | Grant BOTH `objectViewer` AND `legacyBucketReader` to the service agent |
| `Secret Manager API not enabled` | New project, API never used | Enable at console.developers.google.com or run `firebase functions:secrets:set` |
| Blank page on GitHub Pages | Pages serving from wrong branch/source | Set source to **GitHub Actions** in Pages settings |
| `main.jsx 404` in browser console | GitHub serving raw source instead of built files | Set source to **GitHub Actions** (two workflows fighting each other) |
| `git push` rejected "fetch first" | Remote has commits local doesn't | Run `git push --force` (safe on fresh repos) |
| Function deploy fails with build error | Transient Cloud Build issue on new projects | Retry: `firebase deploy --only functions:FUNCTION_NAME` |
| `firebase deploy` exits at secrets error | Secret doesn't exist in new project | Run `firebase functions:secrets:set SECRET_NAME` for each secret |
| Site shows 404 on custom domain | `public/CNAME` has old domain or is missing | Update `public/CNAME` with new domain, commit and push |
| "Could not load invoices" in portal | Firestore rules not set up in new project | Copy rules from source project and publish in new project's Firestore rules tab |
| Logged in but not admin, no admin access | `admins` collection has old UID from source project | Add new UID to `admins` collection, delete old UID document |

---

## Key Things to Remember

1. **Secrets must exist even as dummy values** — missing secrets stop the entire deploy
2. **`legacyBucketReader` + `objectViewer` both required** for Firestore import — `objectViewer` alone fails
3. **GitHub Pages source must be "GitHub Actions"** — "Deploy from a branch" causes two workflows to fight
4. **`.firebaserc` must be deleted and recreated** — it hardcodes the old project ID
5. **`functions/` and `firebase.json` must be kept** — delete these and you lose all your backend logic
6. **`firebase use PROJECT-ID`** is the correct way to switch projects — not deleting Firebase files
7. **Admin UIDs change per project** — always update the `admins` collection with the new UID after restoring data
8. **`public/CNAME` must match your custom domain** — wrong domain in this file causes 404 on the live site
