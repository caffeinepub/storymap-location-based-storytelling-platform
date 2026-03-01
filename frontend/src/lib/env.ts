/**
 * Typed helper for reading Vite environment variables in a build-safe way.
 * All environment variables must be prefixed with VITE_ to be exposed to the client.
 */

/**
 * Get an environment variable value.
 * @param key - The environment variable key (e.g., 'VITE_II_URL')
 * @returns The environment variable value or undefined if not set
 */
export function getEnv(key: keyof ImportMetaEnv): string | undefined {
    return import.meta.env[key];
}

/**
 * Get an environment variable value with a fallback.
 * @param key - The environment variable key
 * @param fallback - The fallback value if the environment variable is not set
 * @returns The environment variable value or the fallback
 */
export function getEnvWithFallback(key: keyof ImportMetaEnv, fallback: string): string {
    return import.meta.env[key] ?? fallback;
}
