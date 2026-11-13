// Resize / crop helpers that work with both the old and the new expo-image-manipulator API.
import * as IM from 'expo-image-manipulator';

type Result = { uri: string; width: number; height: number };

export async function resizeToJpeg(uri: string, width: number, compress = 0.7): Promise<Result> {
  const m: any = IM;
  if (typeof m.manipulateAsync === 'function') {
    return m.manipulateAsync(uri, [{ resize: { width } }], { compress, format: m.SaveFormat.JPEG });
  }
  const ctx = m.ImageManipulator.manipulate(uri);
  ctx.resize({ width });
  const img = await ctx.renderAsync();
  return img.saveAsync({ compress, format: m.SaveFormat.JPEG });
}

// rect is in pixels of the original image
export async function cropToJpeg(
  uri: string,
  rect: { x: number; y: number; w: number; h: number },
  maxWidth = 640,
  compress = 0.8,
): Promise<Result> {
  const m: any = IM;
  const crop = {
    originX: Math.max(0, Math.round(rect.x)),
    originY: Math.max(0, Math.round(rect.y)),
    width: Math.max(8, Math.round(rect.w)),
    height: Math.max(8, Math.round(rect.h)),
  };
  const outW = Math.min(maxWidth, crop.width);
  if (typeof m.manipulateAsync === 'function') {
    return m.manipulateAsync(uri, [{ crop }, { resize: { width: outW } }], { compress, format: m.SaveFormat.JPEG });
  }
  const ctx = m.ImageManipulator.manipulate(uri);
  ctx.crop(crop);
  ctx.resize({ width: outW });
  const img = await ctx.renderAsync();
  return img.saveAsync({ compress, format: m.SaveFormat.JPEG });
}
