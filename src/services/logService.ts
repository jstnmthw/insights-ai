import fs from 'fs';
import path from 'path';

/**
 * Save a raw PageSpeed Insights API response to the logs directory.
 *
 * The file name format is `psi-raw-YYYY-MM-DDTHH-MM-SS.json`.
 * Any errors are caught and logged without interrupting the caller.
 */
export function savePsiRaw(data: unknown): void {
  try {
    const logsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filePath = path.join(logsDir, `psi-raw-${timestamp}.json`);

    fs.writeFileSync(filePath, JSON.stringify(data));
  } catch (err) {
    // Logging should never break application execution.
    console.error('Warning: Failed to write raw PSI log', err);
  }
}
