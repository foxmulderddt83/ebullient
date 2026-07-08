# Vercel Deployment Security Guide

## ⚠️ BEFORE DEPLOYING TO VERCEL

### 1. Environment Variables Setup

**DO NOT** add secrets directly to `.env` in production. Use Vercel's Environment Variables dashboard:

#### Steps:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings → Environment Variables**
4. Add each sensitive variable:

| Variable | Value | Scope | Sensitivity |
|----------|-------|-------|------------|
| `VITE_SUPABASE_URL` | Your Supabase URL | Production | 🟢 PUBLIC |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | Production | 🟢 PUBLIC* |
| `VITE_SUPABASE_BUCKET` | `media` | Production | 🟢 PUBLIC |
| `POSTGRES_URL` | Connection string | Production | 🔴 SENSITIVE |
| `POSTGRES_URL_NON_POOLING` | Connection string | Production | 🔴 SENSITIVE |
| `POSTGRES_USER` | `postgres` | Production | 🟡 SEMI-PUBLIC |
| `POSTGRES_PASSWORD` | Your DB password | Production | 🔴 SENSITIVE |
| `POSTGRES_HOST` | DB host | Production | 🟡 SEMI-PUBLIC |
| `POSTGRES_DATABASE` | `postgres` | Production | 🟢 PUBLIC |
| `POSTGRES_PRISMA_URL` | Connection string | Production | 🔴 SENSITIVE |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Production | 🔴 SENSITIVE |
| `SUPABASE_JWT_SECRET` | JWT secret | Production | 🔴 SENSITIVE |
| `SUPABASE_SECRET_KEY` | Secret key | Production | 🔴 SENSITIVE |

> *Note: `VITE_SUPABASE_ANON_KEY` is exposed in frontend code. Use Row Level Security (RLS) policies to restrict access.

### 2. Security Best Practices

#### ✅ DO:
- [ ] Use different credentials for dev/staging/production
- [ ] Rotate credentials every 3-6 months
- [ ] Enable Row Level Security (RLS) in Supabase
- [ ] Use API keys with minimal required scopes
- [ ] Store secrets in Vercel, NOT in code
- [ ] Use VITE_ prefix only for public variables
- [ ] Review .gitignore before every push
- [ ] Keep secrets out of error messages and logs

#### ❌ DON'T:
- [ ] Hardcode secrets in source code
- [ ] Commit .env files to git
- [ ] Share credentials in Slack/email/docs
- [ ] Use same credentials for multiple environments
- [ ] Log sensitive values (especially passwords)
- [ ] Expose service role keys to the frontend
- [ ] Commit API keys even if "revoked"

### 3. Vercel-Specific Security

#### Protected Routes
Certain environment variables are only available on the server:
- Variables with `NEXT_PUBLIC_` prefix → available in browser
- All other variables → server-side only (not accessible from frontend)

#### Frontend Exposure Risk
In this Vite/React app, only use these in browser:
```javascript
// ✅ SAFE (public, read-only)
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

// ❌ DANGEROUS (never expose)
POSTGRES_URL
SUPABASE_SERVICE_ROLE_KEY
POSTGRES_PASSWORD
```

### 4. Supabase Security Checklist

- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Create restrictive RLS policies for public access
- [ ] Use separate API keys for different scopes
- [ ] Rotate anon key if ever exposed
- [ ] Rotate service role key regularly
- [ ] Monitor Supabase audit logs
- [ ] Enable MFA for Supabase account
- [ ] Review Supabase API access logs monthly

### 5. Deploy Safely

```bash
# 1. Verify no .env is committed
git status

# 2. Verify .gitignore blocks sensitive files
git ls-files | grep -E "\.env|secret|password"  # Should return nothing

# 3. Push to Vercel (secrets managed via dashboard)
git push

# 4. Configure environment variables in Vercel Dashboard
# Settings → Environment Variables → Add each secret

# 5. Redeploy after adding variables
# Deployments → Select latest → Redeploy
```

### 6. If Secrets Are Accidentally Exposed

**IMMEDIATE ACTION REQUIRED:**

1. **Revoke Exposed Credentials**
   - Supabase: Reset API keys in Project Settings
   - Database: Change user password
   - JWT: Generate new secret

2. **Check for Unauthorized Access**
   - Review Supabase logs for unauthorized queries
   - Check database audit logs
   - Monitor your project for unexpected changes

3. **Update Vercel**
   - Update environment variables with new credentials
   - Redeploy all applications

4. **Communicate**
   - Alert team members
   - Update any dependent services
   - Document the incident

### 7. Local Development Setup

```bash
# 1. Copy the example file
cp .env.example .env.local

# 2. Get your actual secrets from Supabase Dashboard
# Project Settings → API Keys

# 3. Fill in .env.local with YOUR credentials
# (This file is in .gitignore, never committed)

# 4. Start development
npm run dev
```

### 8. Credential Rotation Schedule

- **Quarterly (Every 3 months)**
  - Rotate anon key
  - Rotate service role key
  - Rotate JWT secret

- **Immediately**
  - If exposed/leaked
  - After employee departure
  - After security incident
  - If compromise suspected

### 9. Monitoring & Alerts

Consider setting up alerts for:
- Failed authentication attempts (Supabase audit logs)
- Unusual query patterns
- New user role creation
- RLS policy changes
- API key usage anomalies

### 10. Additional Resources

- [Vercel Secrets Documentation](https://vercel.com/docs/environment-variables)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [OWASP Secrets Management](https://owasp.org/www-community/Secrets_Management)

---

## Pre-Deployment Checklist

- [ ] All secrets removed from source code
- [ ] .env file is in .gitignore
- [ ] .env.example created for reference
- [ ] Environment variables configured in Vercel Dashboard
- [ ] No console.log() statements logging sensitive data
- [ ] API keys use minimal required scopes
- [ ] Row Level Security enabled on all Supabase tables
- [ ] Staging environment tested before production deploy
- [ ] Team members notified of new environment setup
- [ ] Backup credentials stored securely (password manager)
- [ ] Incident response plan documented

---

**Last Updated:** 2026-07-09  
**Status:** ✅ Ready for Secure Deployment
