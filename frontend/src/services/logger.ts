/**
 * Environment-aware logging utility for the frontend application.
 * Provides different logging levels based on the current environment.
 */

/**
 * Logs debug messages - only in development environment
 * @param message - The message to log
 * @param data - Optional structured context data
 */
export const logDebug = (message: string, data?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    const prefixedMessage = `[DEBUG] ${message}`;
    if (data) {
      console.log(prefixedMessage, data);
    } else {
      console.log(prefixedMessage);
    }
  }
};

/**
 * Logs info messages - only in development environment
 * @param message - The message to log
 * @param data - Optional structured context data
 */
export const logInfo = (message: string, data?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    const prefixedMessage = `[INFO] ${message}`;
    if (data) {
      console.info(prefixedMessage, data);
    } else {
      console.info(prefixedMessage);
    }
  }
};

/**
 * Logs warning messages - in all environments
 * @param message - The message to log
 * @param data - Optional structured context data
 */
export const logWarn = (message: string, data?: any): void => {
  const prefixedMessage = `[WARN] ${message}`;
  if (data) {
    console.warn(prefixedMessage, data);
  } else {
    console.warn(prefixedMessage);
  }
};

/**
 * Logs error messages - in all environments
 * @param message - The message to log
 * @param data - Optional structured context data
 */
export const logError = (message: string, data?: any): void => {
  const prefixedMessage = `[ERROR] ${message}`;
  if (data) {
    console.error(prefixedMessage, data);
  } else {
    console.error(prefixedMessage);
  }
};