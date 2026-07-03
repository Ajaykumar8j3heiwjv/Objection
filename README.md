# Objection Playbook — HCL GUVI Sales

A live, interactive objection-handling reference for the sales team. Built with HTML/CSS/JS + Supabase backend.

## Features

✅ **23+ Pre-loaded objections** organized by category  
✅ **Real-time search & filter** by category  
✅ **Flip cards** to reveal response scripts using the I-C-E-A framework  
✅ **Add objections** — team submissions stored in Supabase  
✅ **Mobile-responsive** design  

---

## Quick Start (Local Testing)

1. **Open in a browser:**
   ```
   open index.html
   ```
   or drag it into your browser.

2. **Supabase is currently optional** — the site works with just the pre-loaded cards. To enable team submissions, follow the "Setup Supabase" section below.

---

## Setup Supabase (Enable Team Submissions)

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Name it (e.g., "objection-playbook")
4. Choose a strong database password
5. Click **Create new project** (takes ~2 mins)

### Step 2: Create the Database Table

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Paste this SQL:

```sql
CREATE TABLE objections (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  cat VARCHAR(5) NOT NULL,
  cat_name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  q TEXT NOT NULL,
  a TEXT,
  submitted_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE objections ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read
CREATE POLICY "Allow public read access" ON objections
  FOR SELECT USING (true);

-- Allow anyone to add submissions
CREATE POLICY "Allow public insert" ON objections
  FOR INSERT WITH CHECK (true);
```

4. Click **Run** and wait for completion

### Step 3: Get Your API Keys

1. Go to **Settings** → **API** (left sidebar)
2. Copy your **Project URL** (starts with `https://`)
3. Copy the **anon public** key (under "Project API keys")

### Step 4: Add Keys to index.html

1. Open `index.html` in your text editor
2. Find the line that says `const SUPABASE_URL = "";`
3. Replace the empty string with your Project URL
4. Find `const SUPABASE_ANON_KEY = "";`
5. Replace with your anon public key

Example:
```javascript
const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_ANON_KEY = "eyJ...your-key...";
```

5. **Save the file**
6. Refresh your browser — the **+ Add objection** button is now live

---

## How to Use the Site

### For Sales Team (Users)

**Searching & Filtering:**
- Type in the search box to find objections by keyword
- Click category chips to filter by topic (Pricing, Trust, Time, etc.)

**Flipping Cards:**
- Click any card to reveal the response script
- Click again to hide
- Each response follows the **I-C-E-A** framework (Identify, Connect, Explore, Advise)

**Adding an Objection:**
- Click **+ Add objection** (top right)
- Fill in:
  - **Category** — pick the best fit
  - **What did the customer say?** — the objection (required)
  - **How did you respond?** — your response or what you wish you'd said (optional)
  - **Your name** — appears as credit (optional)
- Click **Add to board**
- Your submission appears live in seconds on everyone's board

### For Admins/Managers

- Monitor submissions in Supabase → **Table Editor**
- Edit or delete submissions directly in the UI
- Adjust category colors/names by editing `CATEGORIES` array in the script

---

## Deployment on Render

### Option A: Deploy as Static Site (Free, Simple)

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Add Objection Playbook"
   git push origin master
   ```

2. **Create Render account** at [render.com](https://render.com)

3. **Connect GitHub:**
   - Click **New +** → **Static Site**
   - Select your GitHub repo
   - Set **Build Command**: (leave empty, no build needed)
   - Set **Publish directory**: `.` (current folder)
   - Click **Create Static Site**

4. **Site is live** in ~1 minute at `https://your-site-name.onrender.com`

### Option B: Deploy with Custom Backend (Backend-as-a-Service)

If you want server-side validation:

1. Create a simple Node.js backend in a `server.js` file
2. Deploy to Render as a Web Service
3. Point `index.html` to your backend

(For now, Supabase + static site is recommended for simplicity.)

---

## File Structure

```
Objection/
├── index.html           ← All code: HTML + CSS + JS
├── README.md            ← This file
└── .git/                ← Git history
```

To add assets (images, etc.) later:
- Create an `assets/` folder
- Reference as `./assets/image.png` in HTML

---

## Troubleshooting

### "Supabase isn't configured"
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are not empty
- They must start with `https://` and `eyJ...` respectively

### Submissions don't appear
- Check browser console for errors (F12 → Console tab)
- Verify RLS policies were created:
  - Supabase → Table Editor → objections → click icon → Policies
  - Should see "Allow public read access" and "Allow public insert"

### "Couldn't save to Supabase"
- Verify the `objections` table exists (Supabase → Table Editor)
- Check that RLS policies allow INSERT
- Check the error message in the modal — it includes troubleshooting hints

### Render deployment errors
- Push code to GitHub first
- Make sure Git is committed (`git status` should show nothing)
- Render logs appear in the deployment tab

---

## Next Steps

1. ✅ Set Supabase keys
2. ✅ Test adding an objection
3. ✅ Deploy to Render
4. ✅ Share link with your sales team
5. 📝 Start collecting real objections from calls

---

## Architecture

```
┌─────────────────────────────┐
│   Browser (index.html)      │
│  • Search, filter, flip     │
│  • Add objection modal      │
│  • 23 pre-loaded cards      │
└────────────┬────────────────┘
             │
             ├─ Supabase (Backend)
             │  ├─ objections table
             │  ├─ Row Level Security
             │  └─ Real-time sync
             │
             └─ Render (Hosting)
                └─ Static site
```

---

## Built With

- **HTML/CSS/JS** — Frontend (no framework)
- **Supabase** — Database + Auth (via RLS)
- **Render** — Hosting (CDN + static serving)

---

## Support

Questions? Check the console (F12) for error messages — they're detailed by design.
