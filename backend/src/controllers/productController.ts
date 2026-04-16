import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export const getAllProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, category, supplierId, page = '1', limit = '50' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { hsnCode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              gstin: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    successResponse(res, {
      products,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getProductById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        supplier: true,
        stockAlerts: {
          where: { isActive: 1 },
        },
      },
    });

    if (!product) {
      errorResponse(res, 'Product not found', 404);
      return;
    }

    successResponse(res, product);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    errorResponse(res, 'Manual product creation is disabled. Upload an invoice to add products.', 403);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    errorResponse(res, 'Manual product updates are disabled. Edit invoice line items instead.', 403);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    errorResponse(res, 'Manual product deletion is disabled. Remove the source invoice if needed.', 403);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getLowStockProducts = async (req: AuthRequest, res: Response): Promise<void> => {
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

    successResponse(res, products);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const updateStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    errorResponse(res, 'Manual stock updates are disabled. Stock is managed from invoice workflow.', 403);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getProductCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.product.findMany({
      where: {
        category: {
          not: null,
        },
      },
      select: {
        category: true,
      },
      distinct: ['category'],
    });

    const categoryList = categories
      .map((p) => p.category)
      .filter((c): c is string => c !== null);

    successResponse(res, categoryList);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};
