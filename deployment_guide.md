# Deployment Guide: AI Stampede Prevention System

To get a URL that works **anywhere, anytime** (24/7), you need to host your application on a cloud server. We will use **Render.com** as it is free and easy to use.

## Prerequisites
1.  **GitHub Account**: You need to push your code to a GitHub repository.
2.  **Render Account**: Sign up at [render.com](https://render.com).

## Step 1: Push Code to GitHub
1.  Initialize a git repository in your project folder (if not already done):
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    ```
2.  Create a new repository on GitHub.
3.  Link your local repo to GitHub and push:
    ```bash
    git remote add origin <YOUR_GITHUB_REPO_URL>
    git branch -M main
    git push -u origin main
    ```

## Step 2: Deploy on Render
1.  Log in to your **Render Dashboard**.
2.  Click **"New +"** and select **"Web Service"**.
3.  Connect your GitHub account and select the repository you just pushed.
4.  **Configure the Service**:
    *   **Name**: `stampede-prevention` (or any name)
    *   **Region**: Closest to you (e.g., Singapore, Frankfurt)
    *   **Branch**: `main`
    *   **Runtime**: `Python 3`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
5.  Select the **Free** plan.
6.  Click **"Create Web Service"**.

## Step 3: Access Your App
*   Render will take a few minutes to build and deploy.
*   Once finished, it will give you a URL like: `https://stampede-prevention.onrender.com`.
*   **This URL will work anywhere, anytime!**

> [!NOTE]
> **Important Limitation**: Cloud servers **cannot access your laptop's webcam**.
> When running on the cloud, the app will show a "CAMERA UNAVAILABLE" message or a black screen unless you connect it to an **IP Camera** stream instead of a USB webcam.
>
> To test with your **real webcam** remotely, use **ngrok** on your laptop instead (see below).

---

## Alternative: ngrok (For Webcam Streaming)
If you need to see your **laptop's webcam** from another device:
1.  Keep your laptop **ON** and the app **RUNNING**.
2.  Install **ngrok** and sign up.
3.  Run: `ngrok http 8000`
4.  Use the generated URL.
