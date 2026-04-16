import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import logger from '../config/logger';

const execFileAsync = promisify(execFile);

export interface PaddleOCRResult {
  text: string;
  avgConfidence: number;
  lineCount: number;
  lang?: string;
}

const pythonCommand = process.env.PADDLE_OCR_PYTHON_CMD || 'python3';
const scriptPath = path.resolve(__dirname, '../../scripts/paddle_ocr_extract.py');

export function isPaddleOCRAvailable(): boolean {
  return fs.existsSync(scriptPath);
}

export async function extractTextWithPaddleOCR(filePath: string): Promise<PaddleOCRResult> {
  if (!isPaddleOCRAvailable()) {
    throw new Error(`Paddle OCR script not found at ${scriptPath}`);
  }

  const { stdout, stderr } = await execFileAsync(pythonCommand, [scriptPath, filePath], {
    env: process.env,
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (stderr && stderr.trim()) {
    logger.warn('PaddleOCR stderr output', { stderr: stderr.trim() });
  }

  const output = stdout?.trim();
  if (!output) {
    throw new Error('PaddleOCR returned empty output');
  }

  let parsed: PaddleOCRResult;
  try {
    parsed = JSON.parse(output) as PaddleOCRResult;
  } catch (error: any) {
    throw new Error(`PaddleOCR returned invalid JSON: ${error?.message || 'parse error'}`);
  }

  return {
    text: parsed.text || '',
    avgConfidence: Number(parsed.avgConfidence || 0),
    lineCount: Number(parsed.lineCount || 0),
    lang: parsed.lang,
  };
}
