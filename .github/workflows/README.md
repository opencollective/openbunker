# GitHub Actions Deployment to Coolify

This workflow automatically triggers a deployment to Coolify whenever code is pushed to the `main` branch. Coolify handles the build process using your Dockerfile.

## Setup Instructions

### 1. GitHub Repository Secrets

You need to add the following secrets to your GitHub repository:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add the following secrets:

#### `COOLIFY_TOKEN`

- This is your Coolify API token
- Generate it in Coolify: Settings → API → Create Token

#### `COOLIFY_WEBHOOK`

- This is the webhook endpoint from Coolify
- Get it from: Your Resource → Webhook menu in Coolify

### 2. Coolify Setup

In Coolify, set up your deployment:

1. Create a new application
2. Choose "Dockerfile" as the deployment type (or "Git" if you prefer)
3. Point to your GitHub repository
4. Set the branch to `main`
5. Configure any environment variables needed
6. Get the webhook URL from the Webhook menu

### 3. Workflow Features

- **Automatic triggers**: Runs on push to `main` branch
- **Manual triggers**: Can be run manually via workflow_dispatch
- **Lightweight**: Only triggers the deployment, build happens in Coolify
- **Security**: Uses least-privilege permissions

### 4. How It Works

1. You push code to `main` branch
2. GitHub Actions triggers the workflow
3. Workflow calls Coolify webhook with your token
4. Coolify pulls the latest code and builds using your Dockerfile
5. Coolify deploys the new version

### 5. Troubleshooting

- Check the Actions tab in GitHub for deployment logs
- Verify your secrets are correctly set
- Check Coolify logs for build/deployment issues
- Ensure your Dockerfile builds successfully

## Manual Deployment

You can manually trigger a deployment by:

1. Going to Actions tab in GitHub
2. Selecting "Deploy to Coolify" workflow
3. Clicking "Run workflow"
