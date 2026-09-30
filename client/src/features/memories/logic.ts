import type { ImageMimeType, Memory } from '@/types/domain';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES: ImageMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];

const extensionMimeType: Record<string, ImageMimeType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

export function resolveImageMimeType(mimeType: string | null | undefined, fileName: string): ImageMimeType | null {
  if (mimeType) return ALLOWED_IMAGE_TYPES.includes(mimeType as ImageMimeType) ? mimeType as ImageMimeType : null;
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? extensionMimeType[extension] ?? null : null;
}

export function validateImageSelection(input: {
  mimeType?: string | null;
  fileName: string;
  fileSize?: number | null;
}): ImageMimeType {
  const resolvedType = resolveImageMimeType(input.mimeType, input.fileName);
  if (!resolvedType) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (typeof input.fileSize === 'number' && input.fileSize > MAX_IMAGE_BYTES) {
    throw new Error('Images must be 10 MB or smaller.');
  }
  if (typeof input.fileSize === 'number' && input.fileSize <= 0) {
    throw new Error('This image looks empty. Choose another photo.');
  }
  return resolvedType;
}

export function isValidMemoryDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function sortMemories(memories: Memory[]): Memory[] {
  return [...memories].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date);
    return byDate || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  });
}

export function formatMemoryDate(date: string, options: Intl.DateTimeFormatOptions = {
  month: 'short', day: 'numeric', year: 'numeric'
}) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${date}T12:00:00`));
}
