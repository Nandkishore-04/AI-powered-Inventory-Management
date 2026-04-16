import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse>) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async register(data: { email: string; password: string; name: string; role?: string }) {
    const response = await this.client.post('/auth/register', data);
    if (response.data.data?.token) {
      localStorage.setItem('token', response.data.data.token);
    }
    return response.data;
  }

  async login(data: { email: string; password: string }) {
    const response = await this.client.post('/auth/login', data);
    if (response.data.data?.token) {
      localStorage.setItem('token', response.data.data.token);
    }
    return response.data;
  }

  async logout() {
    const response = await this.client.post('/auth/logout');
    localStorage.removeItem('token');
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Product endpoints
  async getProducts(params?: { search?: string; category?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/products', { params });
    return response.data;
  }

  async getProduct(id: string) {
    const response = await this.client.get(`/products/${id}`);
    return response.data;
  }

  async createProduct(data: any) {
    const response = await this.client.post('/products', data);
    return response.data;
  }

  async updateProduct(id: string, data: any) {
    const response = await this.client.put(`/products/${id}`, data);
    return response.data;
  }

  async deleteProduct(id: string) {
    const response = await this.client.delete(`/products/${id}`);
    return response.data;
  }

  async getLowStockProducts() {
    const response = await this.client.get('/products/low-stock');
    return response.data;
  }

  async getProductCategories() {
    const response = await this.client.get('/products/categories');
    return response.data;
  }

  async updateStock(data: { productId: string; quantity: number; notes?: string }) {
    const response = await this.client.post('/products/stock/update', data);
    return response.data;
  }

  // Supplier endpoints
  async getSuppliers(params?: { search?: string; activeOnly?: boolean }) {
    const response = await this.client.get('/suppliers', { params });
    return response.data;
  }

  async getSupplier(id: string) {
    const response = await this.client.get(`/suppliers/${id}`);
    return response.data;
  }

  async createSupplier(data: any) {
    const response = await this.client.post('/suppliers', data);
    return response.data;
  }

  async updateSupplier(id: string, data: any) {
    const response = await this.client.put(`/suppliers/${id}`, data);
    return response.data;
  }

  async deleteSupplier(id: string) {
    const response = await this.client.delete(`/suppliers/${id}`);
    return response.data;
  }

  // Analytics endpoints
  async getAnalytics(days: number = 30) {
    const response = await this.client.get('/analytics/dashboard', { params: { days } });
    return response.data;
  }

  async getCategoryAnalytics() {
    const response = await this.client.get('/analytics/categories');
    return response.data;
  }

  async getSupplierPerformance(days: number = 30) {
    const response = await this.client.get('/analytics/suppliers/performance', { params: { days } });
    return response.data;
  }

  async getDemandForecast(productId: string, days: number = 30) {
    const response = await this.client.get(`/analytics/forecast/${productId}`, { params: { days } });
    return response.data;
  }

  async getReorderSuggestions() {
    const response = await this.client.get('/analytics/reorder/suggestions');
    return response.data;
  }

  async getSmartReorderSuggestions(params?: { budgetLimit?: number; priorityOnly?: boolean }) {
    const response = await this.client.get('/analytics/reorder/smart', { params });
    return response.data;
  }

  async createAutoReorderRule(productId: string, rule: any) {
    const response = await this.client.post(`/analytics/reorder/rules/${productId}`, rule);
    return response.data;
  }

  async getAutoReorderRule(productId: string) {
    const response = await this.client.get(`/analytics/reorder/rules/${productId}`);
    return response.data;
  }

  async runAutoReorder() {
    const response = await this.client.post('/analytics/reorder/run');
    return response.data;
  }

  async exportAnalyticsData(type: 'inventory' | 'transactions' = 'inventory') {
    const response = await this.client.get('/analytics/export', {
      params: { type },
      responseType: 'blob',
    });
    return response.data;
  }

  // Invoice endpoints
  async uploadInvoice(formData: FormData, params?: { autoCreate?: boolean; autoApprove?: boolean }) {
    const response = await this.client.post('/invoices/upload', formData, {
      params,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getInvoices(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await this.client.get('/invoices/bills', { params });
    return response.data;
  }

  async getInvoice(id: string) {
    const response = await this.client.get(`/invoices/bills/${id}`);
    return response.data;
  }

  async updateInvoice(billId: string, data: any) {
    const response = await this.client.patch(`/invoices/bills/${billId}`, data);
    return response.data;
  }

  async updateInvoiceLineItem(
    billId: string,
    lineItemId: string,
    data: { itemName?: string; quantity?: number; unitPrice?: number; gstRate?: number; hsnCode?: string | null }
  ) {
    const response = await this.client.patch(`/invoices/bills/${billId}/line-items/${lineItemId}`, data);
    return response.data;
  }

  async deleteInvoice(billId: string) {
    const response = await this.client.delete(`/invoices/bills/${billId}`);
    return response.data;
  }
}

export default new ApiService();
