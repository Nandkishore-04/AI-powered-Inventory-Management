import { useEffect, useState } from 'react';
import { Package, AlertTriangle, TrendingUp, Users, FileText } from 'lucide-react';
import api from '../services/api';
import { Product, PurchaseBill } from '../types';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export default function Dashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    totalValue: 0,
    supplierCount: 0,
    totalInvoices: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentBills, setRecentBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [productsRes, lowStockRes, suppliersRes, invoicesRes] = await Promise.all([
        api.getProducts({ limit: 1000 }),
        api.getLowStockProducts(),
        api.getSuppliers(),
        api.getInvoices({ limit: 5, offset: 0 }),
      ]);

      const products = productsRes.data.products || [];
      const totalValue = products.reduce(
        (sum: number, p: Product) => sum + p.currentStock * p.unitPrice,
        0
      );

      setStats({
        totalProducts: products.length,
        lowStockCount: lowStockRes.data?.length || 0,
        totalValue,
        supplierCount: suppliersRes.data?.length || 0,
        totalInvoices: invoicesRes.data?.pagination?.total || 0,
      });

      setLowStockProducts(lowStockRes.data?.slice(0, 5) || []);
      setRecentBills(invoicesRes.data?.bills || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('Dashboard')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('Live view based on processed invoices')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('Total Products')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.totalProducts}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Package className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('Suppliers')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.supplierCount}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Users className="text-purple-600 dark:text-purple-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('Total Value')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                ₹{stats.totalValue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('Processed Invoices')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.totalInvoices}
              </p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
              <FileText className="text-amber-600 dark:text-amber-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={24} />
              {t('Low Stock Alerts')}
            </h2>
            <Link
              to="/products?filter=lowStock"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {t('View All')}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Product')}</th>
                  <th>{t('Current Stock')}</th>
                  <th>{t('Reorder Level')}</th>
                  <th>{t('Supplier')}</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((product) => (
                  <tr key={product.id} className="border-t dark:border-gray-700">
                    <td className="font-medium">{product.name}</td>
                    <td>
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded text-xs font-medium">
                        {product.currentStock}
                      </span>
                    </td>
                    <td>{product.reorderLevel}</td>
                    <td>{product.supplier?.name || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('Recent Invoices')}
          </h2>
          <Link
            to="/invoices"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            {t('Open Invoices')}
          </Link>
        </div>

        {recentBills.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('No invoices processed yet. Upload an invoice to start populating products and suppliers.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Invoice')}</th>
                  <th>{t('Supplier')}</th>
                  <th>{t('Date')}</th>
                  <th>{t('Amount')}</th>
                  <th>{t('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {recentBills.map((bill) => (
                  <tr key={bill.id} className="border-t dark:border-gray-700">
                    <td className="font-medium">{bill.invoiceNumber}</td>
                    <td>{bill.supplier?.name || 'N/A'}</td>
                    <td>{new Date(bill.invoiceDate).toLocaleDateString('en-IN')}</td>
                    <td>₹{bill.totalAmount.toLocaleString('en-IN')}</td>
                    <td>{bill.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
