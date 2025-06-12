/* eslint-disable max-classes-per-file */

export class AppError extends Error {
  public readonly name: string;
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ConfigError extends AppError {}
export class ApiError extends AppError {} 