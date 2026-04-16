export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  hsnCode?: string;
  gstRate: number;
  currentStock: number;
  reorderLevel: number;
  unitPrice: number;
  supplierId?: string;
  supplier?: Supplier;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  gstin?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  rating?: number;
  activeStatus: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseBill {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierId: string;
  supplier: Supplier;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  filePath?: string;
  uploadedBy?: string;
  lineItems: BillLineItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface BillLineItem {
  id: string;
  billId: string;
  productId?: string;
  itemName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  lineTotal: number;
  confidenceScore?: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier: Supplier;
  orderDate: string;
  expectedDelivery?: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number;
  notes?: string;
  lineItems: POLineItem[];
  createdAt: string;
}

export interface POLineItem {
  id: string;
  poId: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  contextData?: any;
  lastActivity: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'USER' | 'AI';
  content: string;
  metadata?: any;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  products: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Analytics Types
export interface InventoryAnalytics {
  overview: {
    totalProducts: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalTransactions: number;
    healthScore: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    currentStock: number;
    unitPrice: number;
    totalValue: number;
    turnoverRate: number;
    velocity: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    purchases: number;
    sales: number;
    adjustments: number;
    netChange: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
    totalValue: number;
  }>;
  recommendations: string[];
}

export interface CategoryAnalytics {
  categories: Array<{
    category: string;
    productCount: number;
    totalStock: number;
    avgPrice: number;
    totalValue: number;
  }>;
  totalCategories: number;
}

export interface SupplierPerformance {
  suppliers: Array<{
    id: string;
    name: string;
    rating: number;
    productCount: number;
    orderCount: number;
    totalSpent: number;
    avgOrderValue: number;
    performance: 'Excellent' | 'Good' | 'Average';
  }>;
  totalSuppliers: number;
  totalSpent: number;
}

export interface DemandForecast {
  forecast: {
    productId: string;
    productName: string;
    currentStock: number;
    avgDailySales: number;
    forecastedDemand: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number;
    daysUntilStockout: number;
    needsReorder: boolean;
    suggestedOrderQuantity: number;
  };
  confidence: number;
  aiInsights: string | null;
  historicalDataPoints: number;
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  supplierName?: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQuantity: number;
  estimatedCost: number;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  forecast?: any;
  confidence?: number;
  hasAutoRule?: boolean;
}

export interface SmartReorderSuggestions {
  suggestions: ReorderSuggestion[];
  totalEstimatedCost: number;
  totalItems: number;
  aiOptimization: string | null;
}

export interface AutoReorderRule {
  id: string;
  productId: string;
  enabled: boolean;
  minStockLevel: number;
  maxStockLevel: number;
  reorderQuantity: number;
  leadTimeDays: number;
  autoApprove: boolean;
  createdAt: string;
  updatedAt: string;
}
