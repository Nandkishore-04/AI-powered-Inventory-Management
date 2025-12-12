// import OpenAI from 'openai';
import { extractInvoiceDataWithGoogleDocAI } from './googleDocumentAIService';
import logger from '../config/logger';
import { validateGSTINFormat } from '../utils/gstValidation';
import prisma from '../config/database';

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY || '',
// });

const isConfigured = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

export interface ExtractedInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierGSTIN?: string;
  supplierAddress?: string;
  subtotal: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalAmount: number;
  items: Array<{
    name: string;
    hsnCode?: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    amount: number;
  }>;
  confidence: number;
  rawText?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
  canAutoApprove?: boolean;
  confidenceScore?: number;
  fieldConfidence?: {
    invoiceNumber: number;
    amounts: number;
    items: number;
    gstin: number;
  };
}

export interface CorrectionSuggestion {
  field: string;
  originalValue: any;
  suggestedValue: any;
  reason: string;
  confidence: number;
}

/**
 * Extract invoice data using Google Document AI
 */
export async function extractInvoiceDataWithAI(
  filePath: string
): Promise<ExtractedInvoiceData> {
  if (!isConfigured) {
    throw new Error('Google Document AI is not configured. Please add GOOGLE_APPLICATION_CREDENTIALS to .env file.');
  }
  try {
    logger.info('Processing invoice with Google Document AI', { filePath });
    // result is an object with keys from entity.type (lowercase)
    // fallback: try to extract known fields
    const result = await extractInvoiceDataWithGoogleDocAI(filePath);
    // Fallback for items extraction
    let items: any[] = [];
    const r: any = result;
    if (Array.isArray(r.items)) {
      items = r.items;
    } else if (Array.isArray(r.lineitems)) {
      items = r.lineitems;
    } else if (Array.isArray(r.entities)) {
      items = r.entities.filter((e: any) => e.type && e.type.toLowerCase().includes('item'));
    }
    return {
      invoiceNumber: (r as any)['invoiceNumber'] || (r as any)['invoicenumber'] || '',
      invoiceDate: (r as any)['invoiceDate'] || (r as any)['invoicedate'] || '',
      supplierName: (r as any)['supplierName'] || (r as any)['suppliername'] || '',
      supplierGSTIN: (r as any)['supplierGSTIN'] || (r as any)['suppliergstin'] || '',
      supplierAddress: (r as any)['supplierAddress'] || (r as any)['supplieraddress'] || '',
      subtotal: Number((r as any)['subtotal']) || 0,
      cgst: Number((r as any)['cgst']) || 0,
      sgst: Number((r as any)['sgst']) || 0,
      igst: Number((r as any)['igst']) || 0,
      totalAmount: Number((r as any)['totalAmount']) || Number((r as any)['totalamount']) || 0,
      items,
      confidence: 85,
      rawText: JSON.stringify(result),
    };
  } catch (error: any) {
    logger.error('Error extracting invoice data with Google Document AI:', error);
    throw new Error(`Failed to extract invoice data: ${error.message}`);
  }
}

/**
 * Simple OCR fallback using basic pattern matching
 * (Useful when OpenAI is not available)
 */
export async function extractInvoiceDataSimple(
  _imagePath: string
): Promise<Partial<ExtractedInvoiceData>> {
  // This is a simplified version that would work with pre-processed text
  // In a real scenario, you'd use Tesseract.js or similar for OCR
  return {
    confidence: 30, // Low confidence for manual verification
    items: [],
  };
}

/**
 * Detect duplicate invoices
 */
export async function checkDuplicateInvoice(
  invoiceNumber: string,
  supplierName: string,
  prisma: any
): Promise<{
  isDuplicate: boolean;
  existingInvoice?: any;
}> {
  const existing = await prisma.purchaseBill.findFirst({
    where: {
      invoiceNumber,
      supplier: {
        name: {
          contains: supplierName,
        },
      },
    },
    include: {
      supplier: true,
    },
  });

  return {
    isDuplicate: !!existing,
    existingInvoice: existing,
  };
}

/**
 * Advanced validation with field-level confidence scoring
 */
export function validateInvoiceData(data: ExtractedInvoiceData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Field-level confidence tracking
  const fieldConfidence = {
    invoiceNumber: 0,
    amounts: 0,
    items: 0,
    gstin: 0,
  };

  // Invoice Number Validation
  if (!data.invoiceNumber) {
    errors.push('Invoice number is missing');
    fieldConfidence.invoiceNumber = 0;
  } else {
    // Check if invoice number looks valid (alphanumeric, reasonable length)
    const invoiceNumberRegex = /^[A-Z0-9-/]{3,30}$/i;
    if (invoiceNumberRegex.test(data.invoiceNumber)) {
      fieldConfidence.invoiceNumber = 95;
    } else {
      fieldConfidence.invoiceNumber = 60;
      warnings.push('Invoice number format is unusual - please verify');
    }
  }

  // Date Validation
  if (!data.invoiceDate) {
    errors.push('Invoice date is missing');
  } else {
    const invoiceDate = new Date(data.invoiceDate);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    if (isNaN(invoiceDate.getTime())) {
      errors.push('Invalid invoice date format');
    } else if (invoiceDate > today) {
      warnings.push('Invoice date is in the future');
    } else if (invoiceDate < oneYearAgo) {
      warnings.push('Invoice is more than 1 year old');
    }
  }

  // Supplier Validation
  if (!data.supplierName) {
    errors.push('Supplier name is missing');
  } else if (data.supplierName.length < 3) {
    warnings.push('Supplier name seems too short');
  }

  // Amount Validation with precision
  if (!data.totalAmount || data.totalAmount <= 0) {
    errors.push('Invalid total amount');
    fieldConfidence.amounts = 0;
  } else {
    // Validate amount calculation
    const calculatedSubtotal = data.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const gstTotal = (data.cgst || 0) + (data.sgst || 0) + (data.igst || 0);
    const calculatedTotal = calculatedSubtotal + gstTotal;

    const subtotalDiff = Math.abs(calculatedSubtotal - data.subtotal);
    const totalDiff = Math.abs(calculatedTotal - data.totalAmount);

    if (subtotalDiff <= 1) {
      fieldConfidence.amounts = 95;
    } else if (subtotalDiff <= 10) {
      fieldConfidence.amounts = 75;
      warnings.push(`Subtotal mismatch: Calculated ₹${calculatedSubtotal.toFixed(2)}, Found ₹${data.subtotal.toFixed(2)}`);
    } else {
      fieldConfidence.amounts = 40;
      errors.push(`Significant subtotal mismatch (₹${subtotalDiff.toFixed(2)} difference)`);
    }

    if (totalDiff <= 1) {
      fieldConfidence.amounts = Math.max(fieldConfidence.amounts, 90);
    } else if (totalDiff > 10) {
      warnings.push(`Total amount mismatch: Calculated ₹${calculatedTotal.toFixed(2)}, Found ₹${data.totalAmount.toFixed(2)}`);
    }
  }

  // Items Validation
  if (!data.items || data.items.length === 0) {
    errors.push('No line items found');
    fieldConfidence.items = 0;
  } else {
    let itemScore = 100;
    data.items.forEach((item, index) => {
      if (!item.name) {
        errors.push(`Item ${index + 1}: Name is missing`);
        itemScore -= 20;
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Invalid quantity`);
        itemScore -= 15;
      }
      if (!item.unitPrice || item.unitPrice < 0) {
        errors.push(`Item ${index + 1}: Invalid unit price`);
        itemScore -= 15;
      }
      if (!item.hsnCode) {
        warnings.push(`Item ${index + 1}: HSN code missing`);
        itemScore -= 5;
      }

      // Verify item amount calculation
      const expectedAmount = item.quantity * item.unitPrice;
      if (Math.abs(expectedAmount - item.amount) > 1) {
        warnings.push(`Item ${index + 1}: Amount calculation mismatch`);
        itemScore -= 10;
      }
    });
    fieldConfidence.items = Math.max(0, itemScore);
  }

  // GST Validation
  const hasGST = (data.cgst || 0) + (data.sgst || 0) + (data.igst || 0) > 0;
  if (!hasGST) {
    warnings.push('No GST amount found - verify if this is a GST invoice');
    suggestions.push('If this is a GST invoice, check if GST amounts were clearly visible in the image');
  }

  // CGST + SGST should equal IGST (only one type should be present)
  const hasCGSTSGST = (data.cgst || 0) > 0 || (data.sgst || 0) > 0;
  const hasIGST = (data.igst || 0) > 0;
  if (hasCGSTSGST && hasIGST) {
    warnings.push('Both CGST/SGST and IGST present - should be one or the other');
    suggestions.push('For intra-state: Use CGST+SGST. For inter-state: Use IGST only');
  }

  // GSTIN validation
  if (data.supplierGSTIN) {
    const gstinValidation = validateGSTINFormat(data.supplierGSTIN);
    if (gstinValidation.valid) {
      fieldConfidence.gstin = 95;

      // Cross-verify GST type with state codes
      if (gstinValidation.details) {
        const companyStateCode = process.env.COMPANY_STATE_CODE || '29';
        const supplierStateCode = gstinValidation.details.stateCode;
        const isSameState = companyStateCode === supplierStateCode;

        if (isSameState && hasIGST && !hasCGSTSGST) {
          warnings.push('Intra-state transaction should use CGST+SGST, not IGST');
        } else if (!isSameState && hasCGSTSGST && !hasIGST) {
          warnings.push('Inter-state transaction should use IGST, not CGST+SGST');
        }
      }
    } else {
      fieldConfidence.gstin = 30;
      warnings.push(`Invalid GSTIN format: ${gstinValidation.error}`);
      suggestions.push('Verify GSTIN manually or request corrected invoice from supplier');
    }
  } else {
    fieldConfidence.gstin = 0;
    warnings.push('Supplier GSTIN not found');
    suggestions.push('GSTIN is required for GST compliance - contact supplier for details');
  }

  // Overall confidence calculation
  const overallConfidence = Math.round(
    (fieldConfidence.invoiceNumber * 0.2 +
      fieldConfidence.amounts * 0.35 +
      fieldConfidence.items * 0.3 +
      fieldConfidence.gstin * 0.15)
  );

  // Auto-approval decision
  const canAutoApprove =
    errors.length === 0 &&
    overallConfidence >= 85 &&
    data.confidence >= 85 &&
    fieldConfidence.amounts >= 90 &&
    fieldConfidence.items >= 80;

  if (canAutoApprove) {
    suggestions.push('This invoice meets criteria for auto-approval');
  } else if (errors.length === 0) {
    suggestions.push('Manual review recommended before approval');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    canAutoApprove,
    confidenceScore: overallConfidence,
    fieldConfidence,
  };
}

/**
 * Generate intelligent correction suggestions
 */
export async function generateCorrectionSuggestions(
  data: ExtractedInvoiceData,
  validation: ValidationResult
): Promise<CorrectionSuggestion[]> {
  const suggestions: CorrectionSuggestion[] = [];

  // Suggest GSTIN correction if invalid
  if (data.supplierGSTIN && validation.fieldConfidence?.gstin && validation.fieldConfidence.gstin < 80) {
    // Try to find similar valid GSTIN from existing suppliers
    const existingSuppliers = await prisma.supplier.findMany({
      where: {
        name: { contains: data.supplierName },
        gstin: { not: null },
      },
      select: { gstin: true, name: true },
    });

    if (existingSuppliers.length > 0) {
      suggestions.push({
        field: 'supplierGSTIN',
        originalValue: data.supplierGSTIN,
        suggestedValue: existingSuppliers[0].gstin,
        reason: `Similar supplier "${existingSuppliers[0].name}" has GSTIN: ${existingSuppliers[0].gstin}`,
        confidence: 75,
      });
    }
  }

  // Suggest amount corrections
  if (validation.fieldConfidence?.amounts && validation.fieldConfidence.amounts < 90) {
    const calculatedSubtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
    const gstTotal = (data.cgst || 0) + (data.sgst || 0) + (data.igst || 0);
    const calculatedTotal = calculatedSubtotal + gstTotal;

    if (Math.abs(calculatedTotal - data.totalAmount) > 1) {
      suggestions.push({
        field: 'totalAmount',
        originalValue: data.totalAmount,
        suggestedValue: calculatedTotal,
        reason: 'Calculated from line items and GST amounts',
        confidence: 85,
      });
    }
  }

  // Suggest HSN codes from existing products
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item.hsnCode) {
      const matchingProduct = await prisma.product.findFirst({
        where: { name: { contains: item.name } },
        select: { hsnCode: true },
      });

      if (matchingProduct?.hsnCode) {
        suggestions.push({
          field: `items[${i}].hsnCode`,
          originalValue: null,
          suggestedValue: matchingProduct.hsnCode,
          reason: `Similar product "${item.name}" typically uses HSN: ${matchingProduct.hsnCode}`,
          confidence: 70,
        });
      }
    }
  }

  return suggestions;
}



/**
 * Main function to process invoice
 */
export async function processInvoice(
  filePath: string,
  useAI: boolean = true
): Promise<ExtractedInvoiceData> {
  if (useAI && isConfigured) {
    return await extractInvoiceDataWithAI(filePath);
  } else {
    const simpleData = await extractInvoiceDataSimple(filePath);
    return {
      invoiceNumber: '',
      invoiceDate: '',
      supplierName: '',
      subtotal: 0,
      totalAmount: 0,
      items: [],
      confidence: 30,
      ...simpleData,
    };
  }
}

export { isConfigured as isOCRConfigured };
