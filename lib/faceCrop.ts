import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { faceCropRect } from '../constants/faceGuide';

/**
 * 촬영본을 타원 오버레이 바운딩 박스(+패딩) 기준으로 크롭한다.
 * 성공 시 크롭본 uri, 실패 시 null.
 */
export async function cropToFaceGuide(
  photoUri: string,
  photoWidth: number,
  photoHeight: number,
  screenWidth: number,
  screenHeight: number,
): Promise<string | null> {
  try {
    const rect = faceCropRect(screenWidth, screenHeight, photoWidth, photoHeight);
    const context = ImageManipulator.manipulate(photoUri);
    context.crop(rect);
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: 0.9,
      format: SaveFormat.JPEG,
    });
    return saved.uri ?? null;
  } catch (error) {
    console.log('[faceCrop] crop failed', error);
    return null;
  }
}

/** 캐시의 사진 파일을 삭제한다(원본 전체샷 즉시 폐기용). 실패해도 흐름은 막지 않는다. */
export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.log('[faceCrop] delete failed', error);
  }
}
