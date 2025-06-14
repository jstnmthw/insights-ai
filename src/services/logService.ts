import fs from 'fs';
import path from 'path';
import { URL } from 'url';

import { PsiApiResponse } from '../types/psi.js';

const LOGS_DIR = path.resolve(process.cwd(), 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let sanitized = `${urlObj.hostname}${urlObj.pathname}${urlObj.search}`;
    sanitized = sanitized.replace(/\/$/, '');
    return sanitized.replace(/[^a-zA-Z0-9-._~=&]/g, '_');
  } catch {
    return url.replace(/[^a-zA-Z0-9-._~=&]/g, '_');
  }
}

export function getReportFilename(url: string, strategy: 'desktop' | 'mobile'): string {
  const sanitizedUrl = sanitizeUrl(url);
  return `psi-raw-${strategy}-${sanitizedUrl}.json`;
}

export function saveRawReport(filename: string, data: PsiApiResponse): void {
  try {
    const filePath = path.join(LOGS_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    // Logging should never break application execution.
    console.error('Warning: Failed to write raw PSI log', err);
  }
}

export function readRawReport(filename: string): PsiApiResponse | null {
  try {
    const filePath = path.join(LOGS_DIR, filename);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as PsiApiResponse;
    }
    return null;
  } catch (err) {
    // Logging should never break application execution.
    console.error('Warning: Failed to read raw PSI log', err);
    return null;
  }
}
