# Vercel Environment Setup Guide

## Required Environment Variables for Production

To deploy this project to Vercel, add the following environment variables to your Vercel project:

### Supabase Configuration
- `VITE_SUPABASE_URL` = `https://kjukdoqkunuifiorcdpz.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqdWtkb3FrdW51aWZpb3JjZHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTE5NjYsImV4cCI6MjA4NTg4Nzk2Nn0.piJhInicK1y_9e6jSmRpm-hpg-grR7w0iTJN3zTUWFM`

### hCaptcha Configuration (Admin Login Security)
- `VITE_HCAPTCHA_SITEKEY` = `e5e095d8-8c9e-4dfc-9170-47ea2d70b01e`

## How to Add to Vercel

### Option 1: Via Vercel Web Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable from the list above
5. Set the environment to "Production"
6. Save changes

### Option 2: Via Vercel CLI
```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_HCAPTCHA_SITEKEY
```

### Option 3: Via .env.production File (Local)
The `.env.production` file in the project root contains all required variables for local testing before deployment.

## Features Protected by These Variables

- **Supabase Integration**: Database access, authentication, storage, real-time features
- **Admin Panel**: User authentication and CAPTCHA verification on login
- **Image Storage**: Supabase storage for images and documents
- **Email Verification**: Email-based authentication workflows

## Security Notes

- Never commit actual secret keys to git (they're in .env.production which should be gitignored in production)
- The VITE_SUPABASE_ANON_KEY is public by design (used in browser) but should still be protected
- Keep the hCaptcha site key consistent across all deployments
- Rotate keys periodically in Supabase dashboard if compromised

## Deployment

After adding environment variables to Vercel:
1. Push changes to your repository
2. Vercel will automatically detect and rebuild
3. Environment variables will be available to the build and runtime

```bash
git push
# Vercel automatically deploys and loads environment variables
```

## Testing

To verify environment variables are properly set:
1. Check Vercel Function logs in the dashboard
2. Verify that Supabase queries work in the admin panel
3. Test login page CAPTCHA functionality
