/**
 * Basic security utilities for the application.
 */

/**
 * Sanitizes HTML string to prevent XSS attacks.
 * Strips out <script>, <iframe>, <object>, <embed> and event handlers.
 * 
 * @param html The raw HTML string
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';

  // 1. Remove script tags and their contents
  let sanitized = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");

  // 2. Remove other dangerous tags
  sanitized = sanitized.replace(/<(iframe|object|embed|form|meta|link|style|base|applet)\b[^>]*>([\s\S]*?)<\/\1>/gim, "");
  sanitized = sanitized.replace(/<(iframe|object|embed|form|meta|link|style|base|applet)\b[^>]*>/gim, "");

  // 3. Remove event handlers (onmouseover, onclick, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gim, "");

  // 4. Remove javascript: pseudo-protocol
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gim, 'href="#"');

  return sanitized;
};

/**
 * Validates if a string contains common SQL injection patterns.
 * 
 * @param str The string to validate
 * @returns true if potentially malicious, false otherwise
 */
export const hasSqlInjection = (str: string): boolean => {
  const sqlPatterns = /['";]|--|(\b(OR|AND)\b.*\b(=|>|<)\b)/i;
  return sqlPatterns.test(str);
};
