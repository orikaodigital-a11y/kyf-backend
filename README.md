# Know Your Faculty — Backend (Step 1: Auth)

This is the very first slice of the real backend — just enough to create an
account and log in. We'll add more as we go, feature by feature, so nothing
ever feels overwhelming.

## What's in here

```
kyf-backend/
  src/
    index.js           <- starts the server
    db.js               <- connects to your Supabase database
    middleware/auth.js   <- checks that someone is logged in
    routes/auth.js       <- signup and login
    routes/professors.js <- "get my own profile" (proves login works)
  migrations/
    001_professors.sql   <- creates the first database table
  .env.example           <- template for your secret keys
  package.json
```

## Setup — do this once

**1. Create your Supabase project**
- Go to [supabase.com](https://supabase.com), click "New Project"
- Pick any name (e.g. "know-your-faculty"), set a database password (save it somewhere — a password manager or a private note), pick the region closest to India
- Wait ~2 minutes while it sets up

**2. Get your database connection string**
- In your new Supabase project, go to **Project Settings → Database**
- Under "Connection string", copy the **URI** one (starts with `postgresql://`)
- Replace `[YOUR-PASSWORD]` in that string with the database password you set in step 1

**3. Create the first table**
- In Supabase, go to the **SQL Editor** (left sidebar)
- Open `migrations/001_professors.sql` from this project, copy its contents, paste into the SQL Editor, click **Run**
- You should see "Success. No rows returned"

**4. Set up your local environment**
- In this project folder, copy `.env.example` to a new file called `.env`
- Paste your connection string from step 2 into `DATABASE_URL`
- For `JWT_SECRET`, go to [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) and paste the random string it gives you

**5. Install and run**

Open a terminal, navigate into this folder, then:

```bash
npm install
npm run dev
```

You should see:
```
✅ KYF backend running at http://localhost:4000
```

## Testing it works

Open a new terminal tab (keep the server running in the first one) and try:

**Health check** — just confirms the server is alive:
```bash
curl http://localhost:4000/health
```

**Create an account:**
```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Dr. Test Professor","university":"Test University","category":"Science & Technology","email":"test@example.com","username":"drtest","password":"testpass123"}'
```
You should get back a `professor` object and a `token`.

**Log in with what you just created:**
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"drtest","password":"testpass123"}'
```

**Use the token to fetch your own profile** (replace `PASTE_TOKEN_HERE` with the token from the response above):
```bash
curl http://localhost:4000/professors/me \
  -H "Authorization: Bearer PASTE_TOKEN_HERE"
```

If that last one returns your profile data, **the entire chain is working**: database → signup → login → token → protected route. Everything else we build is the same pattern repeated for each feature.

## If something goes wrong

- `npm install` fails → make sure you ran `node -v` earlier and saw a version number. If not, Node.js isn't installed correctly.
- Server won't start / crashes immediately → check your `.env` file exists (not just `.env.example`) and `DATABASE_URL` has your real Supabase password in it, not `[YOUR-PASSWORD]`.
- Signup returns a 500 error → almost always means the SQL migration wasn't run yet, or `DATABASE_URL` is wrong. Double check step 2 and 3 above.

Send me the exact error message if you get stuck and we'll fix it together — don't try to debug it alone.

## What's next

Once this is working end-to-end on your machine, we'll:
1. Push this code to GitHub
2. Deploy it to Render.com so it's live on the internet, not just your laptop
3. Add the next feature (Discover/matching) the same way we just did auth
