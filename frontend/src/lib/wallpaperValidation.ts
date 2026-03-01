// Wallpaper validation utilities for file selection

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export type ValidationErrorCode = 
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'NO_FILE';

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
}

export type ValidationResult = 
  | { ok: true }
  | { ok: false; error: ValidationError };

/**
 * Validates a wallpaper file for size and type constraints
 */
export function validateWallpaperFile(file: File | null | undefined): ValidationResult {
  if (!file) {
    return {
      ok: false,
      error: {
        code: 'NO_FILE',
        message: 'No file selected',
      },
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
      },
    };
  }

  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'File must be JPEG, PNG, WebP, or GIF',
      },
    };
  }

  return { ok: true };
}

/**
 * Get human-readable file size limit
 */
export function getMaxFileSizeLabel(): string {
  return `${MAX_FILE_SIZE_MB}MB`;
}

/**
 * Get allowed file types as a string
 */
export function getAllowedTypesLabel(): string {
  return 'JPEG, PNG, WebP, GIF';
}

export default {
  validateWallpaperFile,
  getMaxFileSizeLabel,
  getAllowedTypesLabel,
};
