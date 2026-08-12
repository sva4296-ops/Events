import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface PickedPhoto {
  uri: string;
  /** From ImagePicker's asset — can be 0 if the system didn't report it. */
  width: number;
  height: number;
}

export interface ProcessedPhotoVersions {
  thumbnailUri: string;
  fullUri: string;
}

const THUMBNAIL_LONGEST_EDGE = 400;
const THUMBNAIL_QUALITY = 0.65;
const FULL_LONGEST_EDGE = 2800;
const FULL_QUALITY = 0.9;

/**
 * Resizes so the longest edge is `longestEdge`, only ever downscaling —
 * upscaling a source smaller than the target would just add artifacts for
 * no quality gain, so both the thumbnail and the full version skip the
 * resize step entirely when the source is already small enough. Always
 * re-saves as JPEG at `quality` regardless, since the source could be a PNG
 * or HEIC capture.
 */
async function resizeToLongestEdge(
  photo: PickedPhoto,
  longestEdge: number,
  quality: number,
): Promise<string> {
  const hasDimensions = photo.width > 0 && photo.height > 0;
  const longestOriginalEdge = hasDimensions ? Math.max(photo.width, photo.height) : null;
  const needsResize = longestOriginalEdge === null || longestOriginalEdge > longestEdge;

  const context = ImageManipulator.manipulate(photo.uri);
  if (needsResize) {
    const widthIsLongest = longestOriginalEdge === null || photo.width >= photo.height;
    context.resize(widthIsLongest ? { width: longestEdge } : { height: longestEdge });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return saved.uri;
}

export async function processPhotoVersions(photo: PickedPhoto): Promise<ProcessedPhotoVersions> {
  const [thumbnailUri, fullUri] = await Promise.all([
    resizeToLongestEdge(photo, THUMBNAIL_LONGEST_EDGE, THUMBNAIL_QUALITY),
    resizeToLongestEdge(photo, FULL_LONGEST_EDGE, FULL_QUALITY),
  ]);
  return { thumbnailUri, fullUri };
}
