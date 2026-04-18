# Deployment Guide: Vercel + Render

## Step 1: Set up MongoDB Atlas (Production Database)

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up / Log in
3. Create a **Free Tier Cluster** (M0)
4. Under "Connect", choose "Connect with MongoDB URI" and copy the connection string
5. Replace `<password>` with your actual password (URL-encode special chars)
6. Format: `mongodb+srv://username:password@cluster.mongodb.net/url-shortener?retryWrites=true&w=majority`

**Add to Render environment later as `MONGO_URI`**

---

## Step 2: Set up Redis on Upstash (Production Cache)

1. Go to [https://console.upstash.com](https://console.upstash.com)
2. Sign up / Log in
3. Create a **Redis Database** (Free tier available)
4. Copy the **UPSTASH_REDIS_REST_URL** or use the **Redis CLI** connection string
5. Format (for standard Redis): `redis://:password@hostname:port`

**Add to Render environment later as `REDIS_URL`**

---

## Step 3: Deploy Backend on Render

### Option A: Connect via GitHub (Recommended)

1. Go to [https://render.com](https://render.com)
2. Sign in with GitHub
3. Click **"New +"** → **"Web Service"**
4. Select your `url-shortner-new` repository
5. Configure:
   - **Name**: `url-shortener-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (from `server-app/` if not auto-detected)
   - **Region**: Choose closest to you

6. Add **Environment Variables** in Render dashboard:
   ```
   NODE_ENV = production
   PORT = 5000
   MONGO_URI = <your MongoDB Atlas URI>
   REDIS_URL = <your Upstash Redis URL>
   BASE_URL = <your Render app URL once deployed>
   SHORT_ID_LENGTH = 7
   ALLOWED_ORIGINS = https://your-vercel-app.vercel.app
   ```

7. Click **"Create Web Service"**
8. Wait for build to complete (5-10 min)
9. Copy your Render URL (will be like `https://url-shortener-api.onrender.com`)

---

## Step 4: Deploy Frontend on Vercel

### Option A: Import from GitHub (Recommended)

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Add New..."** → **"Project"**
3. Select **"Import Git Repository"**
4. Choose `url-shortner-new`
5. Under **"Root Directory"**, select `./client-app`
6. Click **"Continue"**

7. Add **Environment Variables**:
   ```
   VITE_BACKEND_URL = https://your-render-url.onrender.com/api
   ```

8. Click **"Deploy"**
9. Wait for deployment to complete
10. Your frontend URL will be like `https://url-shortener-xxx.vercel.app`

---

## Step 5: Update ALLOWED_ORIGINS on Render

1. Go back to Render dashboard
2. Select your API service
3. Go to **"Environment"** tab
4. Update `ALLOWED_ORIGINS`:
   ```
   https://your-vercel-app.vercel.app
   https://your-vercel-app.netlify.app (if using Netlify)
   ```

5. Manual redeploy triggers a new build

---

## Step 6: Test Your Deployment

```bash
# Test backend health
curl https://your-render-url.onrender.com/health

# Test frontend
Open https://your-vercel-app.vercel.app in browser
```

---

## Troubleshooting

### Build fails on Render
- Check that `package.json` exists in `server-app/`
- Verify `npm start` works locally: `cd server-app && npm start`

### CORS errors
- Update `ALLOWED_ORIGINS` on Render backend
- Restart Render service (Manual Deploy)

### Redis connection fails
- Verify `REDIS_URL` format is correct
- Check Upstash dashboard for active database

### MongoDB connection fails
- Verify `MONGO_URI` has correct password (URL-encoded)
- Add your Render IP to MongoDB Atlas IP Whitelist (should be "0.0.0.0/0" for free tier)

---

## Optional: Custom Domain

### Vercel
1. In Vercel Project Settings → **"Domains"**
2. Add your domain
3. Follow DNS instructions

### Render
1. In Render Service Settings → **"Custom Domains"**
2. Add your domain
3. Follow CNAME setup

---

## Local Testing Before Deploy

```bash
# Backend
cd server-app
NODE_ENV=production npm start

# Frontend (in another terminal)
cd client-app
VITE_BACKEND_URL=http://localhost:5000/api npm run dev
```

Good luck! 🚀
