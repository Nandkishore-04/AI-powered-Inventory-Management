# AI-Powered Inventory Management System

A comprehensive stock management application with conversational AI interface and intelligent invoice processing capabilities. Built for a 10-week final year CSE project.

## Features

### Phase 1 - Foundation (✅ Completed)
- 🔐 JWT-based authentication with role-based access control
- 📦 Complete Product CRUD with search and filtering
- 🏢 Supplier management system
- 📊 Dashboard with inventory insights
- 🔍 Low stock alerts and monitoring
- 💾 PostgreSQL database with Prisma ORM
- 🎨 Responsive UI with Tailwind CSS and dark mode

### Phase 2 - Chat Interface (Upcoming)
- 💬 Real-time chat with WebSocket integration
- 🤖 Simple regex-based command parser
- 📝 Message history and context preservation
- 🔄 Real-time inventory updates

### Phase 3 - AI Integration (Upcoming)
- 🧠 GPT-4 powered natural language processing
- 📈 Complex query handling and insights
- 🛒 Purchase order creation via chat
- 🎯 Intelligent supplier recommendations

### Phase 4 - Invoice Processing (Upcoming)
- 📄 OCR with Google Document AI
- ✅ Intelligent invoice data extraction
- 🔍 GSTIN validation and GST calculations
- ⚡ Batch invoice processing
- 🔄 Duplicate detection and reconciliation

### Phase 5 - Analytics & Deployment (Upcoming)
- 📊 Demand forecasting and analytics
- 🤖 Automated reorder suggestions
- 🎤 Voice input support
- 🐳 Docker deployment
- 🚀 CI/CD pipeline

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS for styling
- Zustand for state management
- Socket.io-client for real-time communication
- Recharts for analytics
- React Hot Toast for notifications

**Backend:**
- Node.js with Express
- Socket.io for WebSocket
- JWT for authentication
- Bcrypt for password hashing
- Winston for logging

**Database:**
- PostgreSQL (primary database)
- Prisma ORM for type-safe queries
- Redis for session management and caching

**AI Services:**
- OpenAI GPT-4 API
- Google Document AI for OCR

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 16+
- Redis 7+
- OpenAI API key (for Phase 3)
- Google Cloud account with Document AI (for Phase 4)

## Installation

### 1. Clone the repository

\`\`\`bash
git clone <repository-url>
cd Inventory
\`\`\`

### 2. Set up environment variables

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` and configure:

\`\`\`env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/inventory_db"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# OpenAI (for Phase 3)
OPENAI_API_KEY=sk-your-openai-api-key

# Google Document AI (for Phase 4)
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PROCESSOR_ID=your-processor-id
\`\`\`

### 3. Start PostgreSQL and Redis

**Option A: Using Docker Compose (Recommended)**

\`\`\`bash
docker-compose up -d postgres redis
\`\`\`

**Option B: Local Installation**

Make sure PostgreSQL and Redis are running on your system:

\`\`\`bash
# PostgreSQL (varies by OS)
sudo service postgresql start

# Redis
redis-server
\`\`\`

### 4. Install dependencies

\`\`\`bash
# Install all packages (root, frontend, backend, ai-services)
npm run install:all
\`\`\`

Or install individually:

\`\`\`bash
cd backend && npm install
cd ../frontend && npm install
cd ../ai-services && npm install
\`\`\`

### 5. Set up the database

\`\`\`bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database with sample data
npx prisma db seed
\`\`\`

This will create:
- 2 demo users (admin and manager)
- 10 suppliers
- 50 products with realistic data

### 6. Start the development servers

**Option A: Start both together (from root directory)**

\`\`\`bash
npm run dev
\`\`\`

**Option B: Start separately**

Terminal 1 - Backend:
\`\`\`bash
cd backend
npm run dev
\`\`\`

Terminal 2 - Frontend:
\`\`\`bash
cd frontend
npm run dev
\`\`\`

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- API Health Check: http://localhost:5000/health

## Seed Credentials

User credentials are now read from environment variables during seeding.

Set these values before running `npx prisma db seed`:
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_MANAGER_EMAIL`
- `SEED_MANAGER_PASSWORD`

Optional:
- `SEED_ADMIN_NAME`
- `SEED_MANAGER_NAME`

## Project Structure

\`\`\`
Inventory/
├── backend/                 # Express API server
│   ├── src/
│   │   ├── config/         # Database, Redis, Logger configs
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Helper functions
│   │   └── index.ts        # Entry point
│   ├── database/
│   │   └── seed.ts         # Database seeding
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── package.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client, Socket.io
│   │   ├── store/          # Zustand state management
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Helper functions
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   └── package.json
├── ai-services/            # AI integration services
│   ├── src/
│   │   ├── openai/         # GPT-4 integration
│   │   └── documentai/     # Google Document AI
│   └── package.json
├── docs/                   # Documentation
├── docker-compose.yml      # Docker services
├── .env.example           # Environment template
└── README.md
\`\`\`

## Available Scripts

### Root Directory

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run test` - Run all tests
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services

### Backend

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests with Jest
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:seed` - Seed database with sample data
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

### Frontend

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - Get all products (with pagination, search, filters)
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (ADMIN/MANAGER)
- `PUT /api/products/:id` - Update product (ADMIN/MANAGER)
- `DELETE /api/products/:id` - Delete product (ADMIN)
- `GET /api/products/low-stock` - Get low stock products
- `GET /api/products/categories` - Get all categories
- `POST /api/products/stock/update` - Update stock (ADMIN/MANAGER)

### Suppliers
- `GET /api/suppliers` - Get all suppliers
- `GET /api/suppliers/:id` - Get supplier by ID
- `POST /api/suppliers` - Create supplier (ADMIN/MANAGER)
- `PUT /api/suppliers/:id` - Update supplier (ADMIN/MANAGER)
- `DELETE /api/suppliers/:id` - Delete supplier (ADMIN)

## Database Schema

The application uses 11 main models:

1. **Users** - User accounts with role-based access
2. **Products** - Inventory items with stock tracking
3. **Suppliers** - Supplier information with GSTIN
4. **PurchaseBills** - Invoice records with GST details
5. **BillLineItems** - Individual items in purchase bills
6. **PurchaseOrders** - Purchase order management
7. **POLineItems** - Items in purchase orders
8. **ChatSessions** - AI chat conversation sessions
9. **ChatMessages** - Individual chat messages
10. **InventoryTransactions** - Stock movement history
11. **StockAlerts** - Low stock and reorder alerts

See `backend/prisma/schema.prisma` for complete schema details.

## Docker Deployment

### Development Environment

\`\`\`bash
docker-compose up -d
\`\`\`

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Backend API on port 5000
- Frontend on port 80

### Production Build

\`\`\`bash
docker-compose -f docker-compose.prod.yml up -d
\`\`\`

## Testing

### Backend Tests

\`\`\`bash
cd backend
npm test
\`\`\`

### Frontend Tests

\`\`\`bash
cd frontend
npm test
\`\`\`

## Troubleshooting

### Database Connection Issues

1. Verify PostgreSQL is running:
   \`\`\`bash
   docker ps  # Check if postgres container is running
   # OR
   sudo service postgresql status  # For local installation
   \`\`\`

2. Check DATABASE_URL in `.env` matches your setup

3. Try resetting the database:
   \`\`\`bash
   cd backend
   npx prisma migrate reset
   \`\`\`

### Redis Connection Issues

1. Check if Redis is running:
   \`\`\`bash
   redis-cli ping  # Should return "PONG"
   \`\`\`

2. Verify REDIS_HOST and REDIS_PORT in `.env`

### Port Already in Use

Change the port in `.env`:
\`\`\`env
PORT=5001  # Or any available port
\`\`\`

And update frontend proxy in `frontend/vite.config.ts`

## Development Workflow

1. **Create a new feature branch**
   \`\`\`bash
   git checkout -b feature/your-feature-name
   \`\`\`

2. **Make changes and test**
   - Backend: Add tests in `backend/src/__tests__`
   - Frontend: Add tests in component files

3. **Commit with meaningful messages**
   \`\`\`bash
   git commit -m "feat: add product search functionality"
   \`\`\`

4. **Push and create PR**

## Next Steps (Upcoming Phases)

### Phase 2 - Chat Interface (Week 3-4)
- [ ] Implement Socket.io chat backend
- [ ] Create chat UI components
- [ ] Add regex-based command parser
- [ ] Implement message history
- [ ] Add real-time updates

### Phase 3 - AI Integration (Week 5-6)
- [ ] Set up OpenAI GPT-4 integration
- [ ] Implement NLP for inventory queries
- [ ] Add purchase order creation via chat
- [ ] Build supplier recommendation system
- [ ] Add conversation memory

### Phase 4 - Invoice Processing (Week 7-8)
- [ ] Integrate Google Document AI
- [ ] Build file upload system
- [ ] Create OCR processing pipeline
- [ ] Add GSTIN validation
- [ ] Implement duplicate detection

### Phase 5 - Analytics & Deployment (Week 9-10)
- [ ] Add demand forecasting
- [ ] Build analytics dashboard
- [ ] Implement voice input
- [ ] Performance optimization
- [ ] Production deployment
- [ ] Comprehensive testing

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is created for educational purposes as a final year CSE project.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Search existing issues on GitHub
3. Create a new issue with detailed information

## Acknowledgments

- OpenAI for GPT-4 API
- Google Cloud for Document AI
- Prisma for excellent ORM
- React and Node.js communities

---

**Project Status:** Phase 1 Complete ✅ | Current Phase: Phase 2 Development 🚧

Built with ❤️ for CSE Final Year Project 2024
