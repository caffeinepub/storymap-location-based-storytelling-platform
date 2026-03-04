/**
 * Startup validation utility for build/runtime configuration.
 * Logs validation results to console without blocking app startup.
 */

import { getEnv } from "./env";

/**
 * Validates critical build and runtime configuration.
 * Logs warnings to console for missing or invalid configuration.
 * Does not throw errors or block app startup.
 */
export function validateStartupConfig(): void {
  const validationResults: string[] = [];

  // Check Internet Identity provider configuration
  const iiUrl = getEnv("VITE_II_URL");
  if (!iiUrl) {
    validationResults.push(
      "⚠️ VITE_II_URL not configured - using default Internet Identity provider (https://identity.ic0.app)",
    );
  } else {
    validationResults.push(`✓ Internet Identity provider configured: ${iiUrl}`);
  }

  // Log all validation results
  if (validationResults.length > 0) {
    console.group("🔍 Startup Configuration Validation");
    for (const result of validationResults) console.log(result);
    console.groupEnd();
  }
}
