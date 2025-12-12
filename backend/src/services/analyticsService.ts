import prisma from '../config/database';
import logger from '../config/logger';
import OpenAI from 'openai';
import { subDays, subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY;

/**
 * Get comprehensive inventory analytics
 */
export async function getInventoryAnalytics(days: number = 30) {
  try {
    const startDate = subDays(new Date(), days);

    // Parallel data fetching for performance
    const [
      totalProducts,
      _totalValue,
      lowStockCount,
      outOfStockCount,
      recentTransactions,
      topProducts,
      categoryDistribution,
      supplierStats,
      monthlyTrends,
    ] = await Promise.all([
      // Total active products
      prisma.product.count(),

      // Total inventory value
      prisma.product.aggregate({
        _sum: {
          currentStock: true,
        },
      }),

      // Low stock items
      prisma.product.count({
        where: {
          currentStock: {
            lte: prisma.product.fields.reorderLevel,
            gt: 0,
          },
        },
      }),

      // Out of stock items
      prisma.product.count({
        where: { currentStock: 0 },
      }),

      // Recent inventory transactions
      prisma.inventoryTransaction.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          product: {
            select: {
              name: true,
              category: true,
              unitPrice: true,
            },
          },
        },
      }),

      // Top selling/moving products
      prisma.inventoryTransaction.groupBy({
        by: ['productId'],
        where: {
          transactionType: 'SALE',
          createdAt: { gte: startDate },
        },
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 10,
      }),

      // Products by category
      prisma.product.groupBy({
        by: ['category'],
        _count: {
          id: true,
        },
        _sum: {
          currentStock: true,
        },
      }),

      // Supplier performance
      prisma.supplier.findMany({
        where: {
          activeStatus: 1,
        },
        select: {
          id: true,
          name: true,
          rating: true,
          _count: {
            select: {
              products: true,
              purchaseBills: true,
            },
          },
        },
        orderBy: {
          rating: 'desc',
        },
        take: 10,
      }),

      // Monthly transaction trends
      getMonthlyTrends(6),
    ]);

    // Calculate total value
    const products = await prisma.product.findMany({
      select: {
        currentStock: true,
        unitPrice: true,
      },
    });
    const inventoryValue = products.reduce((sum, p) => sum + p.currentStock * p.unitPrice, 0);

    // Get product details for top products
    const topProductDetails = await Promise.all(
      topProducts.map(async (tp) => {
        const product = await prisma.product.findUnique({
          where: { id: tp.productId },
          select: {
            name: true,
            category: true,
            currentStock: true,
            unitPrice: true,
          },
        });
        return {
          ...product,
          totalSold: tp._sum.quantity || 0,
          revenue: (tp._sum.quantity || 0) * (product?.unitPrice || 0),
        };
      })
    );

    // Calculate velocity metrics
    const velocityMetrics = calculateVelocity(recentTransactions);

    return {
      overview: {
        totalProducts,
        inventoryValue,
        lowStockCount,
        outOfStockCount,
        totalTransactions: recentTransactions.length,
        healthScore: calculateHealthScore({
          totalProducts,
          lowStockCount,
          outOfStockCount,
        }),
      },
      topProducts: topProductDetails,
      categoryDistribution,
      supplierStats,
      monthlyTrends,
      velocityMetrics,
      recommendations: await generateRecommendations({
        lowStockCount,
        outOfStockCount,
        topProducts: topProductDetails,
        velocityMetrics,
      }),
    };
  } catch (error) {
    logger.error('Error generating analytics:', error);
    throw new Error('Failed to generate analytics');
  }
}

/**
 * Calculate monthly trends for the last N months
 */
async function getMonthlyTrends(months: number = 6) {
  const trends = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i));
    const monthEnd = endOfMonth(subMonths(new Date(), i));

    const [purchases, sales, value] = await Promise.all([
      prisma.inventoryTransaction.aggregate({
        where: {
          transactionType: 'PURCHASE',
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          quantity: true,
        },
      }),

      prisma.inventoryTransaction.aggregate({
        where: {
          transactionType: 'SALE',
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          quantity: true,
        },
      }),

      prisma.purchaseBill.aggregate({
        where: {
          invoiceDate: {
            gte: monthStart,
            lte: monthEnd,
          },
          status: 'APPROVED',
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    trends.push({
      month: format(monthStart, 'MMM yyyy'),
      purchases: purchases._sum.quantity || 0,
      sales: sales._sum.quantity || 0,
      value: value._sum.totalAmount || 0,
    });
  }

  return trends;
}

/**
 * Calculate inventory velocity metrics
 */
function calculateVelocity(transactions: any[]) {
  const sales = transactions.filter((t) => t.transactionType === 'SALE');
  const purchases = transactions.filter((t) => t.transactionType === 'PURCHASE');

  const totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
  const totalPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0);

  const avgDailySales = totalSold / 30;
  const avgDailyPurchases = totalPurchased / 30;

  // Calculate turnover rate (sales/purchases)
  const turnoverRate = totalPurchased > 0 ? (totalSold / totalPurchased) * 100 : 0;

  return {
    totalSold,
    totalPurchased,
    avgDailySales: Math.round(avgDailySales * 10) / 10,
    avgDailyPurchases: Math.round(avgDailyPurchases * 10) / 10,
    turnoverRate: Math.round(turnoverRate * 10) / 10,
    trend: totalSold > totalPurchased ? 'decreasing' : 'increasing',
  };
}

/**
 * Calculate inventory health score (0-100)
 */
function calculateHealthScore(data: {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
}) {
  const { totalProducts, lowStockCount, outOfStockCount } = data;

  if (totalProducts === 0) return 0;

  const lowStockRatio = lowStockCount / totalProducts;
  const outOfStockRatio = outOfStockCount / totalProducts;

  // Perfect score = 100, deduct points for issues
  let score = 100;
  score -= lowStockRatio * 30; // -30 points max for low stock
  score -= outOfStockRatio * 50; // -50 points max for out of stock

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Generate AI-powered recommendations
 */
async function generateRecommendations(data: any): Promise<string[]> {
  const recommendations: string[] = [];

  // Rule-based recommendations
  if (data.outOfStockCount > 0) {
    recommendations.push(
      `⚠️ ${data.outOfStockCount} products are out of stock - create purchase orders immediately`
    );
  }

  if (data.lowStockCount > 5) {
    recommendations.push(
      `📦 ${data.lowStockCount} products are low on stock - review and reorder soon`
    );
  }

  if (data.velocityMetrics.turnoverRate < 50) {
    recommendations.push(
      `📉 Low inventory turnover (${data.velocityMetrics.turnoverRate}%) - consider reducing purchase quantities`
    );
  } else if (data.velocityMetrics.turnoverRate > 90) {
    recommendations.push(
      `📈 High turnover rate (${data.velocityMetrics.turnoverRate}%) - excellent inventory management!`
    );
  }

  // AI-powered insights (if OpenAI configured)
  if (isOpenAIConfigured && data.topProducts.length > 0) {
    try {
      const topProductNames = data.topProducts.slice(0, 5).map((p: any) => p.name);

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an inventory management expert. Provide 2-3 brief, actionable recommendations based on sales data.',
          },
          {
            role: 'user',
            content: `Top selling products: ${topProductNames.join(', ')}.
                      Turnover rate: ${data.velocityMetrics.turnoverRate}%.
                      Low stock items: ${data.lowStockCount}.
                      Out of stock: ${data.outOfStockCount}.

                      Give 2-3 specific recommendations.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const aiRecommendations = aiResponse.choices[0].message.content
        ?.split('\n')
        .filter((line) => line.trim().length > 0)
        .slice(0, 3);

      if (aiRecommendations) {
        recommendations.push(...aiRecommendations.map((r) => `🤖 ${r}`));
      }
    } catch (error) {
      logger.warn('Failed to get AI recommendations:', error);
    }
  }

  return recommendations;
}

/**
 * AI-Powered Demand Forecasting
 */
export async function forecastDemand(productId: string, days: number = 30) {
  try {
    // Get historical sales data
    const historicalData = await prisma.inventoryTransaction.findMany({
      where: {
        productId,
        transactionType: 'SALE',
        createdAt: {
          gte: subDays(new Date(), 90), // Last 90 days
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        quantity: true,
        createdAt: true,
      },
    });

    if (historicalData.length < 5) {
      return {
        forecast: null,
        confidence: 0,
        message: 'Insufficient historical data for forecasting (need at least 5 sales)',
      };
    }

    // Group by day
    const dailySales = groupByDay(historicalData);

    // Calculate simple moving average
    const avgDailySales = dailySales.reduce((sum, day) => sum + day.quantity, 0) / dailySales.length;

    // Linear regression for trend
    const trend = calculateTrend(dailySales);

    // Forecast next N days
    const forecastedDemand = Math.round(avgDailySales * days * (1 + trend));

    // Get product details
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        currentStock: true,
        reorderLevel: true,
        unitPrice: true,
      },
    });

    // AI-enhanced forecast (if configured)
    let aiInsights = null;
    if (isOpenAIConfigured) {
      aiInsights = await getAIForecastInsights({
        productName: product?.name || 'Product',
        avgDailySales,
        trend,
        forecastedDemand,
        currentStock: product?.currentStock || 0,
      });
    }

    // Calculate confidence based on data consistency
    const confidence = calculateForecastConfidence(dailySales);

    // Determine if reorder is needed
    const daysUntilStockout = product?.currentStock
      ? Math.floor(product.currentStock / avgDailySales)
      : 0;

    const needsReorder = daysUntilStockout < days;

    return {
      forecast: {
        productId,
        productName: product?.name,
        currentStock: product?.currentStock,
        avgDailySales: Math.round(avgDailySales * 10) / 10,
        forecastedDemand,
        trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
        trendPercentage: Math.round(trend * 100 * 10) / 10,
        daysUntilStockout,
        needsReorder,
        suggestedOrderQuantity: needsReorder
          ? Math.ceil(forecastedDemand - (product?.currentStock || 0))
          : 0,
      },
      confidence,
      aiInsights,
      historicalDataPoints: dailySales.length,
    };
  } catch (error) {
    logger.error('Error forecasting demand:', error);
    throw new Error('Failed to forecast demand');
  }
}

/**
 * Group transactions by day
 */
function groupByDay(transactions: any[]) {
  const grouped: { [key: string]: number } = {};

  transactions.forEach((t) => {
    const day = format(new Date(t.createdAt), 'yyyy-MM-dd');
    grouped[day] = (grouped[day] || 0) + t.quantity;
  });

  return Object.entries(grouped).map(([date, quantity]) => ({
    date,
    quantity,
  }));
}

/**
 * Calculate trend using simple linear regression
 */
function calculateTrend(data: Array<{ date: string; quantity: number }>) {
  if (data.length < 2) return 0;

  const n = data.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;

  data.forEach((point, index) => {
    sumX += index;
    sumY += point.quantity;
    sumXY += index * point.quantity;
    sumX2 += index * index;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgY = sumY / n;

  // Return trend as percentage change
  return avgY > 0 ? slope / avgY : 0;
}

/**
 * Calculate forecast confidence (0-100)
 */
function calculateForecastConfidence(data: Array<{ date: string; quantity: number }>) {
  if (data.length < 5) return 30;
  if (data.length < 10) return 50;
  if (data.length < 20) return 70;

  // Calculate coefficient of variation
  const quantities = data.map((d) => d.quantity);
  const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
  const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 1;

  // Lower CV = higher confidence
  const confidence = Math.max(50, Math.min(95, 100 - cv * 50));

  return Math.round(confidence);
}

/**
 * Get AI insights for forecast
 */
async function getAIForecastInsights(data: any) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are an inventory forecasting expert. Provide brief, actionable insights.',
        },
        {
          role: 'user',
          content: `Product: ${data.productName}
                    Current stock: ${data.currentStock}
                    Avg daily sales: ${data.avgDailySales.toFixed(1)}
                    Trend: ${data.trend > 0 ? '+' : ''}${(data.trend * 100).toFixed(1)}%
                    Forecasted demand (30 days): ${data.forecastedDemand}

                    Provide 1-2 actionable insights.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content;
  } catch (error) {
    logger.warn('Failed to get AI forecast insights:', error);
    return null;
  }
}

/**
 * Get products that need reordering
 */
export async function getReorderSuggestions() {
  try {
    const products = await prisma.product.findMany({
      where: {
        currentStock: {
          lte: prisma.product.fields.reorderLevel,
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        currentStock: 'asc',
      },
    });

    // Get forecasts for each product
    const suggestions = await Promise.all(
      products.map(async (product) => {
        const forecast = await forecastDemand(product.id, 30);

        return {
          product: {
            id: product.id,
            name: product.name,
            currentStock: product.currentStock,
            reorderLevel: product.reorderLevel,
            unitPrice: product.unitPrice,
            supplier: product.supplier,
          },
          forecast: forecast.forecast,
          priority: product.currentStock === 0 ? 'URGENT' : product.currentStock <= product.reorderLevel * 0.5 ? 'HIGH' : 'MEDIUM',
          suggestedOrderQuantity: forecast.forecast?.suggestedOrderQuantity || product.reorderLevel * 2,
          estimatedCost: (forecast.forecast?.suggestedOrderQuantity || product.reorderLevel * 2) * product.unitPrice,
        };
      })
    );

    return suggestions.sort((a, b) => {
      const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2 };
      return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
    });
  } catch (error) {
    logger.error('Error getting reorder suggestions:', error);
    throw new Error('Failed to get reorder suggestions');
  }
}
