import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

const projectId = process.env.GOOGLE_PROJECT_ID;
const location = process.env.GOOGLE_PROCESSOR_LOCATION || process.env.GOOGLE_LOCATION || 'us';
const processorId = process.env.GOOGLE_PROCESSOR_ID;
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const client = new DocumentProcessorServiceClient({
  keyFilename: credentialsPath,
});

export async function extractInvoiceDataWithGoogleDocAI(filePath: string) {
  try {
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeType(filePath);

    const request = {
      name,
      rawDocument: {
        content: fileBuffer,
        mimeType,
      },
    };

    const [result] = await client.processDocument(request);
    const { document } = result;
    // You may need to parse document.entities for invoice fields
    // This is a simplified example
    const invoiceData = {};
    if (document && document.entities) {
      document.entities.forEach((entity: any) => {
        (invoiceData as any)[entity.type?.toLowerCase() || ''] = entity.mentionText;
      });
    }
    return invoiceData;
  } catch (error) {
    logger.error('Google Document AI extraction failed:', error);
    throw new Error(`Google Document AI extraction failed: ${(error as any).message}`);
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || 'application/pdf';
}
