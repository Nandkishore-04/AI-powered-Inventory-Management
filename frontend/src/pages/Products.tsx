import { useEffect, useState } from 'react';
import { Search, AlertTriangle, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { Product } from '../types';
import toast from 'react-hot-toast';
import ForecastModal from '../components/analytics/ForecastModal';
import { useLanguage } from '../contexts/LanguageContext';

export default function Products() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [forecastModal, setForecastModal] = useState<{ productId: string; productName: string } | null>(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await api.getProducts({ search, category: selectedCategory });
      setProducts(response.data.products || []);
    } catch (error) {
      toast.error(t('Failed to load products'));
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.getProductCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSearch = () => {
    loadProducts();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('Products')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('Products are auto-created from processed invoices')}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
        {t('Manual product changes are disabled. Upload and process invoices to add or update products.')}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder={t('Search products...')}
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <select
            className="input md:w-48"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setTimeout(loadProducts, 100);
            }}
          >
            <option value="">{t('All Categories')}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleSearch}>
            {t('Search')}
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Name')}</th>
                <th>{t('Category')}</th>
                <th>{t('Stock')}</th>
                <th>{t('Reorder Level')}</th>
                <th>{t('Unit Price')}</th>
                <th>{t('GST Rate')}</th>
                <th>{t('Supplier')}</th>
                <th>{t('Insights')}</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    {t('No products found yet. Upload an invoice to populate products.')}
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-t dark:border-gray-700">
                    <td className="font-medium">{product.name}</td>
                    <td>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {product.category || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.currentStock <= product.reorderLevel
                            ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                            : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                        }`}
                      >
                        {product.currentStock}
                        {product.currentStock <= product.reorderLevel && (
                          <AlertTriangle className="inline ml-1" size={12} />
                        )}
                      </span>
                    </td>
                    <td>{product.reorderLevel}</td>
                    <td>₹{product.unitPrice.toLocaleString('en-IN')}</td>
                    <td>{product.gstRate}%</td>
                    <td>{product.supplier?.name || 'N/A'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-indigo-600"
                          title={t('View Forecast')}
                          onClick={() =>
                            setForecastModal({
                              productId: product.id,
                              productName: product.name,
                            })
                          }
                        >
                          <TrendingUp size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forecast Modal */}
      {forecastModal && (
        <ForecastModal
          productId={forecastModal.productId}
          productName={forecastModal.productName}
          onClose={() => setForecastModal(null)}
        />
      )}
    </div>
  );
}
