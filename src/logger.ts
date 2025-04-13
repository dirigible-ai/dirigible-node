// Logger implementation for the Dirigible SDK

/**
 * Log levels in order of increasing verbosity
 */
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enableConsole?: boolean;
  customHandler?: (level: LogLevel, message: string, ...args: any[]) => void;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  prefix: '[Dirigible]',
  enableConsole: true
};

// Current logger configuration
let loggerConfig: LoggerConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the logger
 * @param config Configuration options
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  loggerConfig = { ...loggerConfig, ...config };
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...loggerConfig };
}

/**
 * Determine if a message at the given level should be logged
 * @param level The log level to check
 * @returns Whether messages at this level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return level <= loggerConfig.level;
}

/**
 * Format a log message with the prefix
 * @param message The message to format
 * @returns The formatted message
 */
function formatMessage(message: string): string {
  if (!loggerConfig.prefix) return message;
  return `${loggerConfig.prefix} ${message}`;
}

/**
 * Log an error message
 * @param message The message to log
 * @param args Additional arguments
 */
export function error(message: string, ...args: any[]): void {
  if (!shouldLog(LogLevel.ERROR)) return;
  
  const formattedMessage = formatMessage(message);
  
  if (loggerConfig.customHandler) {
    loggerConfig.customHandler(LogLevel.ERROR, formattedMessage, ...args);
  }
  
  if (loggerConfig.enableConsole) {
    console.error(formattedMessage, ...args);
  }
}

/**
 * Log a warning message
 * @param message The message to log
 * @param args Additional arguments
 */
export function warn(message: string, ...args: any[]): void {
  if (!shouldLog(LogLevel.WARN)) return;
  
  const formattedMessage = formatMessage(message);
  
  if (loggerConfig.customHandler) {
    loggerConfig.customHandler(LogLevel.WARN, formattedMessage, ...args);
  }
  
  if (loggerConfig.enableConsole) {
    console.warn(formattedMessage, ...args);
  }
}

/**
 * Log an info message
 * @param message The message to log
 * @param args Additional arguments
 */
export function info(message: string, ...args: any[]): void {
  if (!shouldLog(LogLevel.INFO)) return;
  
  const formattedMessage = formatMessage(message);
  
  if (loggerConfig.customHandler) {
    loggerConfig.customHandler(LogLevel.INFO, formattedMessage, ...args);
  }
  
  if (loggerConfig.enableConsole) {
    console.log(formattedMessage, ...args);
  }
}

/**
 * Log a debug message
 * @param message The message to log
 * @param args Additional arguments
 */
export function debug(message: string, ...args: any[]): void {
  if (!shouldLog(LogLevel.DEBUG)) return;
  
  const formattedMessage = formatMessage(message);
  
  if (loggerConfig.customHandler) {
    loggerConfig.customHandler(LogLevel.DEBUG, formattedMessage, ...args);
  }
  
  if (loggerConfig.enableConsole) {
    console.debug(formattedMessage, ...args);
  }
}

/**
 * Log a trace message (highest verbosity)
 * @param message The message to log
 * @param args Additional arguments
 */
export function trace(message: string, ...args: any[]): void {
  if (!shouldLog(LogLevel.TRACE)) return;
  
  const formattedMessage = formatMessage(message);
  
  if (loggerConfig.customHandler) {
    loggerConfig.customHandler(LogLevel.TRACE, formattedMessage, ...args);
  }
  
  if (loggerConfig.enableConsole) {
    console.debug(`[TRACE] ${formattedMessage}`, ...args);
  }
}
