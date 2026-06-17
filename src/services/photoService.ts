import imageCompression from "browser-image-compression";
import { deletePhoto as dbDelete, getPhoto, getPhotosByRound, putPhoto } from "@/lib/db";
import type { StoredPhoto } from "@/lib/types";

function uuid() {
  return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export const photoService = {
  async addFromFile(round_id: string, item_id: string, file: File): Promise<StoredPhoto> {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    }).catch(() => file);
    const dataUrl = await fileToDataUrl(compressed);
    const photo: StoredPhoto = {
      id: uuid(),
      round_id,
      item_id,
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    await putPhoto(photo);
    return photo;
  },
  get: getPhoto,
  listForRound: getPhotosByRound,
  remove: dbDelete,
};
