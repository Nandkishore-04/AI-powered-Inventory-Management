# Quick Start Guide - AI Inventory Management System

## Phase 2 Complete - Chat Interface Ready! ✅

---

## Prerequisites

- Node.js 20+ installed
- npm or yarn
- SQLite (automatically included with Prisma)

---

## Installation & Setup (First Time Only)

### 1. Install Dependencies

```bash
# Install all packages at once
npm install

# Or install individually:
cd backend && npm install
cd ../frontend && npm install
```

### 2. Set Up Database

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations (creates SQLite database)
npx prisma migrate dev

# Seed with sample data
npx prisma db seed
```

This creates:
- 2 Users (admin and manager)
- 10 Suppliers
- 50 Products
- Stock alerts

---

## Running the Application

### Option 1: Run Both Services Together (Recommended)

From the root directory:

```bash
# This will start both backend and frontend
npm run dev
```

### Option 2: Run Services Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## Accessing the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/health

---

## Default Login Credentials

### Admin Account (Full Access)
- **Email:** admin@inventory.com
- **Password:** admin123
- **Role:** ADMIN

### Manager Account (Limited Access)
- **Email:** manager@inventory.com
- **Password:** manager123
- **Role:** MANAGER

---

## Testing the Chat Interface (Phase 2)

### 1. Access the Chat

1. Login with admin credentials
2. Click "AI Assistant" in the sidebar
3. Click "New Conversation" button

### 2. Try These Commands

**Get Help:**
```
help
```

**Check Low Stock:**
```
show low stock
```

**Search for Products:**
```
search product laptop
search product cable
find item mouse
```

**Check Specific Stock:**
```
check stock of laptop
what is the stock for USB cable
```

**View Inventory Value:**
```
show total inventory value
```

**List Suppliers:**
```
show all suppliers
list suppliers
```

**Search Suppliers:**
```
search supplier Dell
find supplier HP
```

**Filter by Category:**
```
show products in Electronics
list items in Accessories
```

---

## Available Pages

1. **Dashboard** (`/dashboard`)
   - Inventory statistics
   - Low stock alerts
   - Quick actions

2. **Products** (`/products`)
   - Full product CRUD
   - Search and filters
   - Stock management

3. **Suppliers** (`/suppliers`)
   - Supplier management
   - GSTIN validation
   - Contact information

4. **AI Assistant** (`/chat`) **← NEW in Phase 2!**
   - Real-time chat interface
   - Natural language commands
   - Session management
   - Typing indicators

5. **Invoices** (`/invoices`)
   - Coming in Phase 4

---

## Database Management

### View Database (Prisma Studio)

```bash
cd backend
npx prisma studio
```

Opens GUI at http://localhost:5555

### Reset Database

```bash
cd backend
npx prisma migrate reset
```

This will:
- Drop all tables
- Run migrations
- Re-seed data

### Create New Migration

```bash
cd backend
npx prisma migrate dev --name your_migration_name
```

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List products (paginated)
- `GET /api/products/:id` - Get product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/low-stock` - Low stock items
- `GET /api/products/categories` - All categories

### Suppliers
- `GET /api/suppliers` - List suppliers
- `GET /api/suppliers/:id` - Get supplier
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/:id` - Update supplier
- `DELETE /api/suppliers/:id` - Delete supplier

### Chat (Phase 2 - NEW!)
- `GET /api/chat/sessions` - Get user sessions
- `GET /api/chat/sessions/:id` - Get session with messages
- `POST /api/chat/sessions` - Create session
- `PUT /api/chat/sessions/:id` - Update session title
- `DELETE /api/chat/sessions/:id` - Delete session
- `GET /api/chat/sessions/:id/messages` - Get messages

### WebSocket Events (Socket.io)
- `join_session` - Join/create chat session
- `send_message` - Send a message
- `typing` - Toggle typing indicator
- `get_sessions` - Load session history
- `delete_session` - Remove session

---

## Development Tools

### Build for Production

```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build
```

### Run Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Code Formatting

```bash
# Backend
cd backend && npm run format

# Frontend
cd frontend && npm run format
```

---

## Troubleshooting

### Port Already in Use

**Backend (Port 5000):**
1. Check what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :5000

   # Linux/Mac
   lsof -i :5000
   ```

2. Change port in `.env`:
   ```
   PORT=5001
   ```

**Frontend (Port 5173):**
- Vite will automatically find next available port

### Database Connection Errors

```bash
cd backend
rm -rf prisma/dev.db  # Delete database
npx prisma migrate dev  # Recreate
npx prisma db seed  # Re-seed
```

### Socket Connection Issues

1. Check backend is running
2. Verify `VITE_SOCKET_URL` in frontend (should be `http://localhost:5000`)
3. Look for CORS errors in browser console
4. Restart both services

### Build Errors

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
cd backend && rm -rf node_modules
cd frontend && rm -rf node_modules
npm install
```

---

## Environment Variables

### Backend (`.env`)

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Redis (Optional for Phase 2)
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI (Phase 3)
OPENAI_API_KEY=sk-your-key-here

# Google Document AI (Phase 4)
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account.json
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PROCESSOR_ID=your-processor-id
```

### Frontend

Vite automatically loads `.env` files. Variables must start with `VITE_`:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

## Project Structure

```
Inventory/
├── backend/                 # Express API
│   ├── src/
│   │   ├── config/         # Database, Redis, Logger
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth, validation
│   │   ├── routes/         # API routes
│   │   ├── services/       # Socket handlers
│   │   ├── utils/          # Command parser, helpers
│   │   └── types/          # TypeScript types
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── dev.db          # SQLite database
│   └── database/
│       └── seed.ts         # Seed data
├── frontend/               # React app
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API, Socket
│   │   ├── store/          # Zustand state
│   │   └── types/          # TypeScript types
└── docs/                   # Documentation
```

---

## Next Development Steps (Phase 3)

### Upcoming Features:
1. **OpenAI GPT-4 Integration**
   - Natural language understanding
   - Complex query handling
   - Context-aware responses

2. **Purchase Order via Chat**
   - Create POs using conversation
   - AI-powered supplier recommendations
   - Automatic product suggestions

3. **Enhanced Chat Features**
   - Conversation memory
   - Multi-turn dialogues
   - Entity extraction

### To Prepare:
1. Get OpenAI API key from https://platform.openai.com
2. Add `OPENAI_API_KEY` to `.env`
3. Review OpenAI pricing and rate limits
4. Familiarize with Function Calling API

---

## Support & Resources

- **Documentation:** See `docs/` folder
- **API Reference:** `docs/API.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Phase 2 Summary:** `PHASE_2_SUMMARY.md`
- **Project Status:** `PROJECT_STATUS.md`

---

## Performance Tips

1. **Use Prisma Studio** for quick database inspection
2. **Enable React DevTools** for debugging
3. **Check Network Tab** for API/Socket issues
4. **Monitor Console** for errors and warnings
5. **Use Dark Mode** to reduce eye strain during development

---

## Common Tasks

### Add a New Product via UI
1. Go to Products page
2. Click "Add Product"
3. Fill in details
4. Save

### Test Chat with All Commands
```
help
show low stock
search product laptop
check stock of laptop
show total inventory value
show all suppliers
search supplier Dell
show products in Electronics
```

### Create a New Chat Session
1. Go to AI Assistant
2. Click "+ New Conversation"
3. Type your query
4. See real-time response

### View Chat History
- All conversations are saved
- Click on any session in left sidebar
- Messages are preserved
- Can delete old sessions

---

## Tips for Demo/Presentation

1. **Start with Dashboard** - Show overview
2. **Navigate to Products** - Demonstrate CRUD
3. **Open AI Assistant** - Most impressive feature!
4. **Try "show low stock"** - Visual results
5. **Search for products** - Show natural language
6. **Create new session** - Demonstrate multi-session
7. **Show typing indicator** - Real-time feature
8. **Check dark mode** - Professional UI

---

**Happy Coding! 🚀**

For questions or issues, check:
- `PROJECT_STATUS.md` for current state
- `CLAUDE.md` for development guidelines
- `PHASE_2_SUMMARY.md` for Phase 2 details

**Current Phase:** 2 of 5 Complete (40%)
**Status:** ✅ Chat Interface Live and Functional!
