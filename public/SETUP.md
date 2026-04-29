# FieldOps v2 — Airtable + Netlify Backend Setup Guide

## Overview

This upgrade replaces the localStorage-only data store with a real backend:
- **Airtable** — stores all work orders (free tier is plenty)
- **Netlify Functions** — serverless API endpoints
- **SendGrid** — email notifications (optional but recommended)

---

## Step 1: Create Your Airtable Base

1. Go to [airtable.com](https://airtable.com) and create a free account
2. Create a new **Base** called `FieldOps`
3. Rename the default table to **`Work Orders`**
4. Add the following fields (delete any auto-created ones first):

| Field Name       | Field Type        | Notes                              |
|------------------|-------------------|------------------------------------|
| WO ID            | Single line text  | Your work order reference (WO-xxx) |
| Title            | Single line text  |                                    |
| Description      | Long text         |                                    |
| Service Type     | Single line text  | Repair, Inspection, etc.           |
| Priority         | Single line text  | Normal, High, Urgent, etc.         |
| Status           | Single line text  | new, dispatched, in_progress, etc. |
| Company          | Single line text  |                                    |
| Customer Name    | Single line text  |                                    |
| Customer Email   | Email             |                                    |
| Customer Phone   | Phone number      |                                    |
| Site Address     | Single line text  |                                    |
| Preferred Date   | Single line text  |                                    |
| Assigned Tech    | Single line text  |                                    |
| Progress         | Number            | Percent (0–100)                    |
| Notes            | Long text         | Stored as JSON string              |
| Updates          | Long text         | Stored as JSON string (timeline)   |
| Attachments      | Attachment        | Files uploaded from portals        |
| Created At       | Single line text  | ISO date string                    |

5. Get your **Base ID**: go to [airtable.com/api](https://airtable.com/api), click your base — the Base ID starts with `app...` (e.g. `appXXXXXXXXXXXXXX`)
6. Get your **API Key**: go to [airtable.com/create/tokens](https://airtable.com/create/tokens), create a Personal Access Token with:
   - Scopes: `data.records:read`, `data.records:write`, `data.attachments:write`
   - Access: your `FieldOps` base

---

## Step 2: Set Up SendGrid (Optional — for email notifications)

1. Sign up at [sendgrid.com](https://sendgrid.com) (free tier: 100 emails/day)
2. Create an API key under Settings → API Keys (Full Access)
3. Verify a sender email address under Settings → Sender Authentication

---

## Step 3: Deploy to Netlify

### Option A: Drag & Drop (quickest)
1. Go to [netlify.com](https://netlify.com) → Add new site → Deploy manually
2. Drag the entire `fieldops-v2` folder into the deploy zone

### Option B: GitHub (recommended for ongoing use)
1. Push this folder to a GitHub repo
2. Connect it in Netlify → New site from Git

---

## Step 4: Set Environment Variables in Netlify

In your Netlify dashboard → Site → Environment Variables, add:

| Variable             | Value                          | Required |
|----------------------|--------------------------------|----------|
| `AIRTABLE_API_KEY`   | Your Airtable Personal Token   | ✅ Yes   |
| `AIRTABLE_BASE_ID`   | Your Base ID (appXXX...)       | ✅ Yes   |
| `SENDGRID_API_KEY`   | Your SendGrid API Key          | Optional |
| `NOTIFY_EMAIL`       | Dispatcher's email address     | Optional |
| `FROM_EMAIL`         | Verified sender email          | Optional |

---

## Step 5: Redeploy & Test

After adding env vars, trigger a redeploy in Netlify.

Test each portal:
1. **Customer Portal** → Submit a work order → check Airtable for the new record
2. **Dispatcher Dashboard** → Should load work orders from Airtable
3. **Technician Portal** → Start a job, update progress → check Airtable updates
4. **Email** → If SendGrid is configured, check inbox on submission + status changes

---

## File Structure

```
fieldops-v2/
├── netlify.toml                    # Netlify config (functions + redirects)
├── package.json
├── public/
│   ├── index.html
│   ├── app.js                      # Updated — uses real API calls
│   └── styles.css
└── netlify/
    └── functions/
        ├── get-orders.js           # GET  /api/get-orders
        ├── create-order.js         # POST /api/create-order  (+ email on create)
        ├── update-order.js         # PATCH /api/update-order (+ email on status change)
        └── upload-file.js          # POST /api/upload-file
```

---

## API Endpoints

| Method | Path                  | Description                        |
|--------|-----------------------|------------------------------------|
| GET    | /api/get-orders       | Fetch all work orders from Airtable|
| POST   | /api/create-order     | Create a new work order            |
| PATCH  | /api/update-order     | Update status, progress, notes     |
| POST   | /api/upload-file      | Upload attachment to Airtable      |

---

## Email Notifications Triggered

| Event                      | Recipient            |
|----------------------------|----------------------|
| New work order submitted   | Dispatcher (NOTIFY_EMAIL) + Customer |
| Status → Dispatched        | Customer             |
| Status → In Progress       | Customer             |
| Status → Completed         | Customer             |
