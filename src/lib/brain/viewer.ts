import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

import { mimeFromPath } from '@/lib/brain/extract';

// Abro el documento con el visor del celular (PDF, galería). Solo le doy permiso de lectura temporal.
export async function openDocument(ruta: string) {
  const contentUri = await FileSystem.getContentUriAsync(ruta);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: mimeFromPath(ruta),
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
