# TeamLeave — Staff Leave Scheduling System

A complete leave management system for small teams, built with React + Firebase + Netlify.

## Features
- 📅 Team calendar with Cayman Islands public holidays
- 🌴 6 leave types: Annual, Sick, Lieu Days, Remote Work, Unpaid, Maternity/Paternity
- ✂️ Half-day support (morning or afternoon)
- ⚡ Auto-calculates working days (excludes weekends & holidays)
- ⚠️ Conflict detection when multiple people request same days
- 📊 Reports & CSV export for payroll
- 👥 Admin console: approve/decline, manage employees, manage holidays
- 🔒 Role-based access: admin vs employee views

---

## STEP 1 — Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → name it (e.g. `teamleave`)
3. Disable Google Analytics (not needed) → **Create project**

---

## STEP 2 — Enable Authentication

1. In Firebase Console → **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, enable **Email/Password**
4. Click **Save**

---

## STEP 3 — Create Firestore Database

1. In Firebase Console → **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → select your region (closest to Cayman: `us-central1`)
4. Click **Enable**

---

## STEP 4 — Set Firestore Security Rules

1. In Firestore → **Rules tab**
2. Replace everything with the contents of `firestore.rules` (included in this project)
3. Click **Publish**

---

## STEP 5 — Get Your Firebase Config

1. In Firebase Console → **Project Settings** (gear icon)
2. Scroll to **"Your apps"** → click **"</>  Web"**
3. Register app name (e.g. `teamleave-web`) → **Register app**
4. Copy the `firebaseConfig` values

---

## STEP 6 — Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=yourproject
VITE_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## STEP 7 — Create Your First Admin User

**Option A (recommended) — Firebase Console:**

1. Firebase Console → **Authentication → Users → Add user**
   - Enter your email & a strong password
   - Copy the **UID** that appears

2. Firebase Console → **Firestore → Start collection** → ID: `users`
   - Document ID: paste your UID
   - Add these fields:

| Field | Type | Value |
|-------|------|-------|
| uid | string | your-uid |
| name | string | Your Full Name |
| email | string | your@email.com |
| role | string | admin |
| isActive | boolean | true |
| isHidden | boolean | false |
| department | string | Management |

   - Add a **Map** field called `leaveAllowances` with:
     - annual: number → 20
     - sick: number → 10

3. Sign in to the app with your email/password. You're an admin!

---

## STEP 8 — Deploy to Netlify

### Via Netlify CLI (easiest):
```bash
npm install -g netlify-cli
netlify login
npm run build
netlify deploy --prod --dir=dist
```

### Via Netlify UI:
1. Go to https://app.netlify.com → **Add new site → Import from Git**
2. Connect your GitHub repo (push this project first)
3. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Go to **Site settings → Environment variables** → add all your `VITE_*` variables
5. Trigger a new deploy

---

## STEP 9 — Add Cayman Public Holidays

Once deployed and logged in as admin:

1. Go to **Admin Console → Holidays tab**
2. Click **"Seed Cayman Holidays"**
3. Done — 2024, 2025 & 2026 holidays are pre-loaded!

---

## STEP 10 — Add Your Team

In the **Admin Console → Employees tab**:
1. Click **"Add Employee"**
2. Enter their name, email, department, and a temporary password
3. Share the URL and temp credentials with them
4. They can sign in immediately

---

## Leave Types & Limits

| Type | Annual Cap | Notes |
|------|-----------|-------|
| Annual Leave | 20 working days | Excludes weekends & holidays |
| Sick Leave | 10 days | |
| Lieu Days (TOIL) | Unlimited | Tracked only |
| Remote Work | Unlimited | Tracked only |
| Unpaid Leave | Unlimited | Tracked only |
| Maternity | Unlimited | Tracked only |
| Paternity | Unlimited | Tracked only |

---

## Usage Notes

- **Leave year:** January – December (no carry-over)
- **Working days only:** system auto-excludes weekends and public holidays from all requests
- **Half days:** employees can request morning or afternoon half-days
- **Conflict alerts:** employees are warned if teammates are already off on the same days
- **CSV export:** available in Reports for payroll use

---

## Local Development

```bash
npm install
cp .env.example .env   # fill in your Firebase credentials
npm run dev            # starts at http://localhost:5173
```
