# TODO — Realtime Likes across Pages (Supabase)

## Step 1: Add DB schema (Supabase)
- Create table `public.objection_likes`
- Enable RLS
- Add policies for public read/insert/update
- Enable realtime on `public.objection_likes`


## Step 2: Add shared JS module
- ✅ Created `assets/likes-realtime.js`
- Functions:
  - subscribe to realtime changes for likes
  - render/update like buttons based on `data-like-key`
  - handle click toggle


## Step 3: Update `index.html`
- Replace localStorage likes with Supabase likes
- Ensure like button uses `data-like-key` = stable `objection_key`

## Step 4: Update `products.html` and all `courses/*.html`
- Add like button HTML for each product page
- Load the shared JS and pass stable product keys

## Step 5: Testing
- Open two tabs and verify realtime sync
- Verify refresh persistence
- Verify UI does not break accordion/other interactions

