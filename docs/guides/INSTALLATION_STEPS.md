# Installation Steps for Windows

Since Docker is not available on your system, you'll need to install PostgreSQL and Redis directly.

## Step 1: Install PostgreSQL

### Option A: Using Chocolatey (Recommended)
If you have Chocolatey installed:
```bash
choco install postgresql
```

### Option B: Manual Installation
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer (version 16 recommended)
3. During installation:
   - Remember the password you set for the `postgres` user
   - Keep the default port: 5432
   - Install pgAdmin (optional GUI tool)

After installation, PostgreSQL should start automatically.

## Step 2: Install Redis

### Option A: Using Chocolatey
```bash
choco install redis-64
```

### Option B: Manual Installation
1. Download Redis for Windows from: https://github.com/tporadowski/redis/releases
2. Extract the zip file to a folder (e.g., `C:\Redis`)
3. Run `redis-server.exe` from that folder

**Note:** Keep the Redis terminal window open while developing.

## Step 3: Configure the Application

1. Copy the environment file:
```bash
cd C:\Users\nkk01\Desktop\Inventory
cp .env.example backend\.env
```

2. Edit `backend\.env` with your PostgreSQL password:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/inventory_db?schema=public"
```

Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

## Step 4: Install Node.js Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

## Step 5: Create Database and Run Migrations

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Create the database and run migrations
npx prisma migrate dev

# Seed with sample data
npx prisma db seed
```

## Step 6: Start the Servers

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

## Step 7: Access the Application

Open your browser and go to: **http://localhost:5173**

Login with:
- **Email:** admin@inventory.com
- **Password:** admin123

---

## Troubleshooting

### PostgreSQL Connection Issues

1. **Check if PostgreSQL is running:**
   - Open Services (Win + R, type `services.msc`)
   - Look for "postgresql-x64-16" (or similar)
   - Make sure it's running

2. **Create database manually if needed:**
   ```bash
   # Open PostgreSQL command line
   psql -U postgres

   # In psql, run:
   CREATE DATABASE inventory_db;
   \q
   ```

### Redis Connection Issues

1. **Make sure Redis is running:**
   - If installed via Chocolatey, it should be a Windows service
   - If manual installation, run `redis-server.exe`

2. **Test Redis connection:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

### Port Already in Use

If port 5000 or 5173 is already in use:

1. For backend (port 5000):
   - Edit `backend\.env` and change `PORT=5000` to `PORT=5001`
   - Update `frontend\vite.config.ts` proxy target to `http://localhost:5001`

2. For frontend (port 5173):
   - Kill the process using that port or it will auto-select another port

---

## Alternative: Use SQLite (No PostgreSQL Required)

If you want to skip PostgreSQL installation for quick testing:

1. Edit `backend\prisma\schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }
   ```

2. Update `backend\.env`:
   ```env
   DATABASE_URL="file:./dev.db"
   ```

3. Run migrations:
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma db seed
   ```

**Note:** SQLite is fine for development but PostgreSQL is recommended for the full feature set.

---

## Quick Test Without Redis

Redis is optional for Phase 1. If you want to start without it:

1. Comment out Redis in `backend\src\index.ts`:
   ```typescript
   // import redis from './config/redis';
   ```

2. Comment out Redis connection in `backend\src\config\redis.ts`

The app will work without Redis, though session management will be limited.

---

## Need Help?

If you run into issues:
1. Check the error messages carefully
2. Verify PostgreSQL and Redis are running
3. Double-check your DATABASE_URL in `.env`
4. Try the SQLite alternative for quick testing
