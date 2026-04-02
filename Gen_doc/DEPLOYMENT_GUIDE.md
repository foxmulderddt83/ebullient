# Deployment Guide: Vercel (Frontend) + Fly.io (Backend)

## 🎯 Architecture

```
┌─────────────────┐
│  Vercel         │
│  (Frontend)     │
│  React/Next.js  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Fly.io         │
│  (Backend)      │
│  Python Flask   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  (Database)     │
└─────────────────┘
```

---

## Part 1: Deploy Backend to Fly.io

### Step 1: Install Fly.io CLI

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

### Step 2: Login to Fly.io

```bash
fly auth login
```

### Step 3: Prepare Your Backend

Create these files in your backend directory:

**File: `fly.toml`** (already created for you)

**File: `requirements.txt`**
```txt
reportlab==4.0.7
pillow==10.1.0
flask==3.0.0
flask-cors==4.0.0
supabase==2.3.0
python-dotenv==1.0.0
gunicorn==21.2.0
```

**File: `Procfile`**
```
web: gunicorn api_with_supabase:app --bind 0.0.0.0:$PORT
```

**File: `runtime.txt`** (optional, specify Python version)
```
python-3.11
```

### Step 4: Update Flask App for Production

Modify `api_with_supabase.py`:

```python
import os

# At the bottom, change to:
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

### Step 5: Launch App on Fly.io

```bash
cd backend  # Your backend directory

# Initialize Fly.io app
fly launch

# It will ask:
# - App name: onedaypilot-pdf-api
# - Region: Singapore (sin) - closest to Malaysia
# - Deploy now? No (we need to set secrets first)
```

### Step 6: Set Environment Secrets

```bash
# Set your Supabase credentials
fly secrets set SUPABASE_URL=https://your-project.supabase.co
fly secrets set SUPABASE_KEY=your-anon-key

# Optional: Set other env vars
fly secrets set PDF_OUTPUT_DIR=/app/outputs
```

### Step 7: Deploy!

```bash
fly deploy
```

Your API will be live at: `https://onedaypilot-pdf-api.fly.dev`

### Step 8: Test Backend

```bash
# Health check
curl https://onedaypilot-pdf-api.fly.dev/health

# Generate PDF
curl https://onedaypilot-pdf-api.fly.dev/api/generate-pdf/YL11002/invoice_paid --output test.pdf
```

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Update Frontend to Use Fly.io API

**File: `.env.local`** (for local development)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**File: `.env.production`** (for production)
```env
NEXT_PUBLIC_API_URL=https://onedaypilot-pdf-api.fly.dev
```

**Update your React component:**

```javascript
// BookingPDFGenerator.jsx
const API_URL = process.env.NEXT_PUBLIC_API_URL || 
                process.env.REACT_APP_API_URL || 
                'http://localhost:5000';
```

### Step 4: Configure CORS on Backend

Update `api_with_supabase.py`:

```python
from flask_cors import CORS

app = Flask(__name__)

# Allow Vercel domain
CORS(app, origins=[
    'http://localhost:3000',
    'http://localhost:5173',
    'https://*.vercel.app',
    'https://your-domain.com'
])
```

### Step 5: Deploy to Vercel

```bash
cd frontend  # Your frontend directory

# Deploy
vercel

# Or for production
vercel --prod
```

Vercel will give you a URL like: `https://onedaypilot.vercel.app`

### Step 6: Set Environment Variables on Vercel

Via Vercel Dashboard:
1. Go to your project
2. Settings → Environment Variables
3. Add:
   - `NEXT_PUBLIC_API_URL` = `https://onedaypilot-pdf-api.fly.dev`

Or via CLI:
```bash
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://onedaypilot-pdf-api.fly.dev
```

### Step 7: Redeploy Frontend

```bash
vercel --prod
```

---

## 🎉 You're Live!

**Frontend:** `https://onedaypilot.vercel.app`  
**Backend:** `https://onedaypilot-pdf-api.fly.dev`

---

## 💰 Pricing

### Fly.io FREE Tier Includes:
- ✅ 3 shared VMs (1GB RAM each)
- ✅ 160GB bandwidth/month
- ✅ Auto-scale to zero (no charges when idle)
- ✅ Perfect for this use case!

### Vercel FREE Tier Includes:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Automatic SSL
- ✅ Global CDN
- ✅ Perfect for frontend!

**Total cost for small usage: $0/month** 🎉

---

## 🔧 Troubleshooting

### Backend Issues

**Problem:** Fly.io app won't start

**Solution:**
```bash
# Check logs
fly logs

# Common issues:
# 1. Missing requirements.txt
# 2. Wrong PORT binding
# 3. Missing environment variables
```

**Problem:** CORS errors

**Solution:**
```python
# In api_with_supabase.py
CORS(app, origins=['*'])  # Allow all during testing
```

### Frontend Issues

**Problem:** API_URL not found

**Solution:**
```javascript
// Add fallback
const API_URL = process.env.NEXT_PUBLIC_API_URL || 
                'https://onedaypilot-pdf-api.fly.dev';
```

**Problem:** Build fails on Vercel

**Solution:**
```bash
# Check build logs
vercel logs

# Common issues:
# 1. Missing dependencies in package.json
# 2. TypeScript errors
# 3. Environment variable not set
```

---

## 🚀 Advanced: Custom Domain

### Add Custom Domain to Fly.io

```bash
fly certs create api.onedaypilot.com
fly ips list

# Add these IPs to your DNS:
# A record: api.onedaypilot.com → [IPv4]
# AAAA record: api.onedaypilot.com → [IPv6]
```

### Add Custom Domain to Vercel

```bash
vercel domains add onedaypilot.com
vercel domains add www.onedaypilot.com

# Add CNAME record in your DNS:
# CNAME: www.onedaypilot.com → cname.vercel-dns.com
```

---

## 📊 Monitoring

### Fly.io Monitoring

```bash
# Check app status
fly status

# View metrics
fly dashboard

# Scale if needed
fly scale count 2  # Run 2 instances
fly scale vm shared-cpu-1x  # Change VM size
```

### Vercel Analytics

1. Go to Vercel Dashboard
2. Enable Analytics
3. View real-time traffic

---

## 🔄 CI/CD Setup

### Auto-deploy on Git Push

**For Vercel (Frontend):**
1. Connect GitHub repo in Vercel dashboard
2. Auto-deploys on every push to `main`

**For Fly.io (Backend):**

Create `.github/workflows/fly-deploy.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: |
          cd backend
          flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## ✅ Post-Deployment Checklist

- [ ] Backend deployed to Fly.io
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set
- [ ] CORS configured
- [ ] API URL updated in frontend
- [ ] Test PDF generation
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)
- [ ] Enable CI/CD (optional)

---

## 🎯 Quick Commands Reference

```bash
# Fly.io
fly status                    # Check app status
fly logs                      # View logs
fly secrets list              # List secrets
fly scale show               # Show current scale
fly deploy                   # Deploy updates

# Vercel
vercel                       # Deploy preview
vercel --prod                # Deploy production
vercel logs                  # View logs
vercel env ls                # List env vars
vercel domains ls            # List domains
```

---

## 💡 Pro Tips

1. **Use Fly.io regions close to users:**
   - Singapore (`sin`) for Malaysia
   - Hong Kong (`hkg`) for Asia
   - Tokyo (`nrt`) for Japan

2. **Enable auto-scaling:**
   ```toml
   # In fly.toml
   auto_stop_machines = true
   auto_start_machines = true
   min_machines_running = 0
   ```

3. **Monitor costs:**
   - Fly.io: `fly dashboard`
   - Vercel: Dashboard → Usage

4. **Use CDN for PDFs:**
   - Upload generated PDFs to Cloudflare R2 or AWS S3
   - Serve via CDN for faster downloads

---

## 🆘 Support

- **Fly.io:** https://fly.io/docs
- **Vercel:** https://vercel.com/docs
- **Community:** https://community.fly.io

---

**You're all set!** 🚀 Your PDF generation system is now deployed and scalable!
