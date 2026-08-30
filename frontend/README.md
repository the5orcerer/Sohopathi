# Sohopathi - Frontend (React + TypeScript + Vite)

Multi-tenant school management web application designed for high performance, zero latency, and separate edge deployment on Vercel.

## 🚀 Standalone Vercel Deployment

You can host this frontend repository completely separately on Vercel (or Cloudflare Pages / Netlify):

1. **Push to GitHub**:
   - Push this `frontend` directory as its own GitHub repository.
2. **Deploy on Vercel**:
   - Import the repository in Vercel.
   - Framework Preset: **Vite**
   - Root Directory: `./` (or leave default if standalone repository)
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Environment Variables**:
   - Add environment variable in Vercel Project Settings:
     ```env
     VITE_API_URL=https://your-backend-api.vercel.app
     ```
   - (For local development, leave `VITE_API_URL` empty; it automatically uses the Vite proxy to `http://localhost:3000`).

## 🛠️ Local Development

```bash
npm install
npm run dev
```

## 📦 Production Build

```bash
npm run build
npm run preview
```

