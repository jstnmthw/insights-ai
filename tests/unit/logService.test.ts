import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

import {
  getReportFilename,
  saveRawReport,
  readRawReport,
} from '../../src/services/logService.js';

vi.mock('fs');

const mockedFs = vi.mocked(fs);

describe('logService', () => {
  const mockData = { id: 'test' } as any;
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getReportFilename', () => {
    it('should generate a valid filename for a simple URL', () => {
      const url = 'https://example.com';
      const strategy = 'desktop';
      const expected = 'psi-raw-desktop-example.com.json';
      expect(getReportFilename(url, strategy)).toBe(expected);
    });

    it('should handle URLs with paths and trailing slashes', () => {
      const url = 'https://example.com/path/to/page/';
      const strategy = 'mobile';
      const expected = 'psi-raw-mobile-example.com_path_to_page.json';
      expect(getReportFilename(url, strategy)).toBe(expected);
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://example.com/page?foo=bar&baz=qux';
      const strategy = 'desktop';
      const expected = 'psi-raw-desktop-example.com_page_foo=bar&baz=qux.json';
      expect(getReportFilename(url, strategy)).toBe(expected);
    });
  });

  describe('saveRawReport', () => {
    it('should write a file with the given data', () => {
      const filename = 'test.json';
      saveRawReport(filename, mockData);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'logs', filename),
        JSON.stringify(mockData, null, 2)
      );
    });

    it('should log an error if writing fails', () => {
      const filename = 'test.json';
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });
      saveRawReport(filename, mockData);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('readRawReport', () => {
    it('should read and parse a file if it exists', () => {
      const filename = 'test.json';
      const fileContent = JSON.stringify(mockData);
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = readRawReport(filename);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'logs', filename),
        'utf-8'
      );
      expect(result).toEqual(mockData);
    });

    it('should return null if the file does not exist', () => {
      const filename = 'non-existent.json';
      mockedFs.existsSync.mockReturnValue(false);
      const result = readRawReport(filename);
      expect(result).toBeNull();
      expect(mockedFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should log an error and return null if reading fails', () => {
      const filename = 'test.json';
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      const result = readRawReport(filename);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log an error and return null if parsing fails', () => {
      const filename = 'test.json';
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('invalid json');
      const result = readRawReport(filename);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
}); 