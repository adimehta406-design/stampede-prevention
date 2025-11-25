# Quick Deployment Guide for Render.com

Follow these steps to get your **permanent public URL** in under 10 minutes! 🚀

## Step 1: Push to GitHub

1. **Open PowerShell** in your project folder (`c:\Users\Aditya\OneDrive\tex`)

2. **Initialize Git** (if not already done):
   ```powershell
   git init
   git add .
   git commit -m "Prepare for Render deployment"
   ```

3. **Create a GitHub Repository**:
   - Go to [github.com/new](https://github.com/new)
   - Name it: `stampede-prevention`
   - Keep it **Public**
   - Click "Create repository"

4. **Push your code**:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/stampede-prevention.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Deploy on Render

1. **Sign up/Login** at [render.com](https://render.com)

2. **Create New Web Service**:
   - Click **"New +"** → **"Web Service"**
   - Click **"Connect GitHub"** and authorize Render
   - Select your `stampede-prevention` repository

3. **Configure Settings**:
   - **Name**: `stampede-prevention` (or any name you like)
   - **Region**: Choose closest to you (e.g., Singapore)
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

4. **Select Plan**:
   - Choose **"Free"** plan
   - Click **"Create Web Service"**

---

## Step 3: Wait for Deployment

- Render will build your app (~5 minutes)
- Watch the logs for any errors
- Once you see **"Deploy live"**, your app is ready! ✅

---

## Step 4: Get Your Permanent URL

- Render will give you a URL like: `https://stampede-prevention.onrender.com`
- **This URL is permanent and works 24/7!**
- Share it with anyone, anywhere

---

## Important Notes

> [!WARNING]
> **Camera Limitation**: The cloud server cannot access your laptop's webcam. You'll see "CAMERA UNAVAILABLE" on the video feed. This is expected and normal for cloud deployments.

> [!TIP]
> **Free Plan Sleep**: Render's free plan puts your app to sleep after 15 minutes of inactivity. The first request after sleep takes ~30 seconds to wake up. Upgrade to a paid plan ($7/month) for 24/7 uptime.

---

## Troubleshooting

**Build Failed?**
- Check the build logs on Render
- Make sure all files are pushed to GitHub
- Verify `requirements.txt` is in the root folder

**App Not Loading?**
- Wait a few more minutes (first deploy can take 5-10 minutes)
- Check if the start command is correct
- Look for errors in the Render logs

---

## Next Steps

Once deployed, you can:
- ✅ Access your app from any device
- ✅ Share the permanent URL
- ✅ Toggle features via the UI
- ✅ Monitor system status

**Need help?** Let me know! 🚀
