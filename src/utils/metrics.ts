import chalk from 'chalk';

export type TrafficLightColor = 'green' | 'yellow' | 'red';

// Color helpers based on official Web Vitals thresholds
export function getScoreColor(score: number): TrafficLightColor {
  return score >= 90 ? 'green' : score >= 50 ? 'yellow' : 'red';
}

export function getLcpColor(lcp: number): TrafficLightColor {
  return lcp <= 2500 ? 'green' : lcp <= 4000 ? 'yellow' : 'red';
}

export function getFcpColor(fcp: number): TrafficLightColor {
  return fcp <= 1800 ? 'green' : fcp <= 3000 ? 'yellow' : 'red';
}

export function getClsColor(cls: number): TrafficLightColor {
  return cls <= 0.1 ? 'green' : cls <= 0.25 ? 'yellow' : 'red';
}

export function getTbtColor(tbt: number): TrafficLightColor {
  return tbt <= 200 ? 'green' : tbt <= 600 ? 'yellow' : 'red';
}

// Emoji indicators for markdown
export function getScoreEmoji(score: number): string {
  return score >= 90 ? '🟢' : score >= 50 ? '🟡' : '🔴';
}
export function getLcpEmoji(lcp: number): string {
  return lcp <= 2500 ? '🟢' : lcp <= 4000 ? '🟡' : '🔴';
}
export function getFcpEmoji(fcp: number): string {
  return fcp <= 1800 ? '🟢' : fcp <= 3000 ? '🟡' : '🔴';
}
export function getClsEmoji(cls: number): string {
  return cls <= 0.1 ? '🟢' : cls <= 0.25 ? '🟡' : '🔴';
}
export function getTbtEmoji(tbt: number): string {
  return tbt <= 200 ? '🟢' : tbt <= 600 ? '🟡' : '🔴';
}

/**
 * Format time values in a human-friendly way.
 * Converts milliseconds to appropriate units (ms, s, min) based on magnitude.
 */
export function formatHumanTime(ms: number): string {
  if (ms === 0) return 'n/a';

  // Round to avoid floating point precision issues
  const rounded = Math.round(ms);

  // Less than 1 second: show in ms
  if (rounded < 1000) {
    return `${rounded}ms`;
  }

  // Less than 1 minute: show in seconds with 1 decimal place if needed
  if (rounded < 60000) {
    const seconds = rounded / 1000;
    const wholeSeconds = Math.round(seconds);
    // If it rounds to a whole number, show as whole number
    if (Math.abs(seconds - wholeSeconds) < 0.05) {
      return `${wholeSeconds}s`;
    }
    return `${seconds.toFixed(1)}s`;
  }

  // 1 minute or more: show in minutes with 1 decimal place if needed
  const minutes = rounded / 60000;
  const wholeMinutes = Math.round(minutes);
  // If it rounds to a whole number, show as whole number
  if (Math.abs(minutes - wholeMinutes) < 0.05) {
    return `${wholeMinutes}min`;
  }
  return `${minutes.toFixed(1)}min`;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Helper for applying chalk color based on TrafficLightColor
export function colorize(value: string | number, color: TrafficLightColor): string {
  return chalk[color](value);
}
