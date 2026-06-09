# CareerPilot 🚀

Your 24/7 AI-powered career intelligence platform — built for the Bangladesh job market.

## Quick Start

### 1. Environment Setup
cp .env.example .env
# Fill in POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

### 2. Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Run twice — once for JWT_ACCESS_SECRET, once for JWT_REFRESH_SECRET

### 3. Start Docker (Postgres + Redis)
docker-compose up -d

### 4. Start Backend
cd backend
npm install
npm run dev
# API → http://localhost:5000
# Health → http://localhost:5000/api/v1/health

### 5. Start Frontend
cd frontend
npm install
npm run dev
# App → http://localhost:5173# CareerPilot
