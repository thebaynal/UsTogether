import { MAX_IMAGE_BYTES, validateImageSelection } from './logic';

export type ImageSelection = {
  uri: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  file?: File;
};

export async function prepareImageUpload(image: ImageSelection, readUri: typeof fetch = fetch) {
  const mimeType = validateImageSelection({
    ...image, mimeType: image.file?.type || image.mimeType,
    fileSize: image.file?.size ?? image.fileSize
  });
  // Expo's browser picker provides the original File. Its preview URI is not
  // a reliable upload source (and may report status 0 with native fetch).
  if (image.file) return { body: image.file, mimeType };
  let bytes: ArrayBuffer;
  try {
    const response = await readUri(image.uri);
    if (!response.ok && response.status !== 0) throw new Error('Image read failed');
    bytes = await response.arrayBuffer();
  } catch {
    throw new Error('Could not read this image. Please choose it again.');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Images must be 10 MB or smaller.');
  if (!bytes.byteLength) throw new Error('This image looks empty. Choose another photo.');
  return { body: bytes, mimeType };
}
