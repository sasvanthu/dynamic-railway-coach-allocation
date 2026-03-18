# Getting Started

This project can run locally without Encore using a plain Node.js backend with MongoDB.

## Prerequisites

You need Node.js and access to a MongoDB database.

## Running the Application

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Set your MongoDB connection string (and optional DB name):
   ```bash
   set MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
   set MONGODB_DB_NAME=railmind
   ```

3. Start the local backend server:
   ```bash
   npm run dev:local
   ```

The backend will be available at `http://localhost:4000`.



### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173` (or the next available port).


### Optional Encore Setup
If you still want to run through Encore CLI, keep using `encore run` in the `backend` folder.

## Deployment

### Self-hosting
See the [self-hosting instructions](https://encore.dev/docs/self-host/docker-build) for how to use encore build docker to create a Docker image and
configure it.

### Encore Cloud Platform

#### Step 1: Login to your Encore Cloud Account

Before deploying, ensure you have authenticated the Encore CLI with your Encore account (same as your Leap account)

```bash
encore auth login
```

#### Step 2: Set Up Git Remote

Add Encore's git remote to enable direct deployment:

```bash
git remote add encore encore://dynamic-railway-coach-allocation-4oo2
```

#### Step 3: Deploy Your Application

Deploy by pushing your code:

```bash
git add -A .
git commit -m "Deploy to Encore Cloud"
git push encore
```

Monitor your deployment progress in the [Encore Cloud dashboard](https://app.encore.dev/dynamic-railway-coach-allocation-4oo2/deploys).

## GitHub Integration (Recommended for Production)

For production applications, we recommend integrating with GitHub instead of using Encore's managed git:

### Connecting Your GitHub Account

1. Open your app in the **Encore Cloud dashboard**
2. Navigate to Encore Cloud [GitHub Integration settings](https://app.encore.cloud/dynamic-railway-coach-allocation-4oo2/settings/integrations/github)
3. Click **Connect Account to GitHub**
4. Grant access to your repository

Once connected, pushing to your GitHub repository will automatically trigger deployments. Encore Cloud Pro users also get Preview Environments for each pull request.

### Deploy via GitHub

After connecting GitHub, deploy by pushing to your repository:

```bash
git add -A .
git commit -m "Deploy via GitHub"
git push origin main
```

## Additional Resources

- [Encore Documentation](https://encore.dev/docs)
- [Deployment Guide](https://encore.dev/docs/platform/deploy/deploying)
- [GitHub Integration](https://encore.dev/docs/platform/integrations/github)
- [Encore Cloud Dashboard](https://app.encore.dev)



