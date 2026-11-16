import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { EncodingType, StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const pdfMime = 'application/pdf';

export function attachmentFile(name: string) {
  const folder = new Directory(Paths.cache, 'supaclothes', randomUUID());
  folder.create({ intermediates: true });
  return new File(folder, name.replace(/[^a-z0-9._-]/gi, '-'));
}

export async function shareAttachment(file: File, mimeType: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error('Este dispositivo no puede compartir archivos.');
  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI: mimeType === pdfMime ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
  });
}

export async function saveAttachment(file: File, mimeType: string) {
  if (Platform.OS !== 'android') {
    await shareAttachment(file, mimeType);
    return false;
  }

  const access = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!access.granted) return false;
  const content = await file.base64();
  const destination = await StorageAccessFramework.createFileAsync(access.directoryUri, file.name.replace(/\.[^.]+$/, ''), mimeType);
  await StorageAccessFramework.writeAsStringAsync(destination, content, { encoding: EncodingType.Base64 });
  return true;
}
