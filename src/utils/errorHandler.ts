import chalk from 'chalk';
import { AppError } from '../errors/index.js';

export function logError(err: unknown): void {
  if (err instanceof AppError) {
    console.error(chalk.red(`❌ ${err.name}: ${err.message}`));
    if (err.details) console.error(chalk.yellow(JSON.stringify(err.details, null, 2)));
    if (err.stack) console.error(err.stack);
  } else if (err instanceof Error) {
    console.error(chalk.red(`❌ ${err.message}`));
    if (err.stack) console.error(err.stack);
  } else {
    console.error(chalk.red('❌ Unknown error:'), err);
  }
}

export function setupGlobalHandlers(): void {
  process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('UNHANDLED PROMISE REJECTION'));
    logError(reason);
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    console.error(chalk.red('UNCAUGHT EXCEPTION'));
    logError(err);
    process.exit(1);
  });
} 