# Quick Setup Guide

## For Windows Users

### Prerequisites Installation

1. **Install Node.js 20+**
   - Download from: https://nodejs.org/
   - Verify: `node --version` and `npm --version`

2. **Install PostgreSQL**
   - Download from: https://www.postgresql.org/download/windows/
   - During installation, remember your password
   - Default port: 5432

3. **Install Redis**
   - Download from: https://github.com/microsoftarchive/redis/releases
   - Or use Docker: `docker run -d -p 6379:6379 redis:7-alpine`

### Quick Start

1. **Clone and setup**
   \`\`\`bash
   cd Inventory
   cp .env.example .env
   \`\`\`

2. **Edit .env file**
   - Update DATABASE_URL with your PostgreSQL password
   - Keep other defaults for development

3. **Install dependencies**
   \`\`\`bash
   cd backend
   npm install
   cd ../frontend
   npm install
   \`\`\`

4. **Setup database**
   \`\`\`bash
   cd backend
   export SEED_ADMIN_EMAIL="your-admin-email"
   export SEED_ADMIN_PASSWORD="your-admin-password"
   export SEED_MANAGER_EMAIL="your-manager-email"
   export SEED_MANAGER_PASSWORD="your-manager-password"
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   \`\`\`

5. **Start development servers**

   Terminal 1 (Backend):
   \`\`\`bash
   cd backend
   npm run dev
   \`\`\`

   Terminal 2 (Frontend):
   \`\`\`bash
   cd frontend
   npm run dev
   \`\`\`

6. **Open browser**
   - Go to: http://localhost:5173
   - Login with the admin or manager credentials you configured in the seed environment variables

## Using Docker (Easier)

\`\`\`bash
docker-compose up -d postgres redis
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
\`\`\`

Then start frontend in another terminal.

## Common Issues

### Port 5432 already in use
Another PostgreSQL instance is running. Either:
- Stop it: `net stop postgresql-x64-16` (Windows)
- Or change port in .env

### Port 5000 already in use
Change PORT in .env to 5001 and update frontend/vite.config.ts proxy

### Prisma Client Error
Run: `npx prisma generate` in backend folder

### Module not found
Delete node_modules and package-lock.json, then `npm install` again

## Development Tips

1. **View Database**
   \`\`\`bash
   cd backend
   npx prisma studio
   \`\`\`
   Opens GUI at http://localhost:5555

2. **Reset Database**
   \`\`\`bash
   cd backend
   npx prisma migrate reset
   \`\`\`

3. **Check Logs**
   Backend logs are in: `backend/logs/`

4. **Hot Reload**
   Both frontend and backend auto-reload on file changes

## Next Steps

1. Explore the dashboard at http://localhost:5173/dashboard
2. Try adding a product
3. Check low stock alerts
4. View the API docs at docs/API.md
5. Start building Phase 2 features!
