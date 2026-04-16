import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export const getAllSuppliers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, activeOnly = 'false' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { gstin: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (activeOnly === 'true') {
      where.activeStatus = true;
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
            purchaseBills: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    successResponse(res, suppliers);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getSupplierById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            currentStock: true,
            unitPrice: true,
          },
          orderBy: { name: 'asc' },
        },
        purchaseBills: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            status: true,
          },
          orderBy: { invoiceDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!supplier) {
      errorResponse(res, 'Supplier not found', 404);
      return;
    }

    successResponse(res, supplier);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const createSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    errorResponse(res, 'Manual supplier creation is disabled. Upload an invoice to add suppliers.', 403);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const updateSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    errorResponse(res, 'Manual supplier updates are disabled. Edit invoice details instead.', 403);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    errorResponse(res, 'Manual supplier deletion is disabled. Remove the source invoice if needed.', 403);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};
