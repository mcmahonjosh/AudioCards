import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system/next';
import { fromByteArray } from 'base64-js';

/** Raw bytes per read; base64 expansion stays well under JS string limits. */
const READ_CHUNK_BYTES = 2 * 1024 * 1024;
/** ~3 MiB raw per base64 string — keeps Hermes under string limits. */
const WRITE_CHUNK_BYTES = 3 * 1024 * 1024;
/** Stream writes in 256 KiB chunks to avoid large native allocations. */
const STREAM_CHUNK_BYTES = 256 * 1024;

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function safeBasename(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? 'media';
  const cleaned = base.replace(/[:*?"<>|]/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'media';
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  const slash = filePath.lastIndexOf('/');
  if (slash <= 0) return;
  const parent = filePath.slice(0, slash);
  await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
}

async function verifyFileSize(path: string, expectedBytes: number): Promise<void> {
  const info = await FileSystem.getInfoAsync(path, { size: true });
  const size = info.exists && 'size' in info && typeof info.size === 'number' ? info.size : -1;
  if (size !== expectedBytes) {
    throw new Error(`File write verification failed (expected ${expectedBytes} bytes, got ${size}).`);
  }
}

async function writeViaFileApi(path: string, bytes: Uint8Array): Promise<boolean> {
  try {
    await ensureParentDirectory(path);
    const file = new File(path);
    if (file.exists) file.delete();

    if (bytes.length > STREAM_CHUNK_BYTES) {
      const stream = file.writableStream();
      const writer = stream.getWriter();
      try {
        for (let offset = 0; offset < bytes.length; offset += STREAM_CHUNK_BYTES) {
          const end = Math.min(offset + STREAM_CHUNK_BYTES, bytes.length);
          await writer.write(bytes.subarray(offset, end));
        }
      } finally {
        await writer.close();
      }
    } else if (bytes.length === 0) {
      file.create();
    } else {
      file.create();
      file.write(bytes);
    }

    return true;
  } catch {
    return false;
  }
}

async function writeViaLegacyBase64(path: string, bytes: Uint8Array): Promise<void> {
  await ensureParentDirectory(path);

  if (bytes.length === 0) {
    await FileSystem.writeAsStringAsync(path, '', { encoding: FileSystem.EncodingType.UTF8 });
    return;
  }

  if (bytes.length > WRITE_CHUNK_BYTES) {
    throw new Error(`File is too large to save (${bytes.length} bytes).`);
  }

  await FileSystem.writeAsStringAsync(path, fromByteArray(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function readUriAsUint8Array(uri: string): Promise<Uint8Array> {
  try {
    const file = new File(uri);
    if (file.exists) {
      return file.bytes();
    }
  } catch {
    // Fall back to chunked base64 reads below.
  }

  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) throw new Error('File not found');

  const size = 'size' in info && typeof info.size === 'number' ? info.size : 0;
  if (size <= 0) throw new Error('Invalid or empty file');

  const out = new Uint8Array(size);
  let offset = 0;

  while (offset < size) {
    const length = Math.min(READ_CHUNK_BYTES, size - offset);
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: offset,
      length,
    });
    const chunk = base64ToUint8Array(b64);
    if (chunk.length !== length) {
      throw new Error(
        `Failed to read package at offset ${offset} (got ${chunk.length} of ${length} bytes).`,
      );
    }
    out.set(chunk, offset);
    offset += length;
  }

  return out;
}

export async function writeBytesToFile(path: string, bytes: Uint8Array): Promise<void> {
  if (bytes.length <= WRITE_CHUNK_BYTES) {
    try {
      await writeViaLegacyBase64(path, bytes);
      await verifyFileSize(path, bytes.length);
      return;
    } catch {
      // Fall through to File API below.
    }
  }

  const wrote = await writeViaFileApi(path, bytes);
  if (wrote) {
    await verifyFileSize(path, bytes.length);
    return;
  }

  if (bytes.length <= WRITE_CHUNK_BYTES) {
    await writeViaLegacyBase64(path, bytes);
    await verifyFileSize(path, bytes.length);
    return;
  }

  throw new Error(`Failed to save file (${bytes.length} bytes).`);
}

export async function ensureDirectory(path: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(path, { intermediates: true }).catch(() => {});
}

export function joinPath(dir: string, name: string): string {
  const safeName = name.replace(/^\/+/, '');
  if (dir.endsWith('/')) return `${dir}${safeName}`;
  return `${dir}/${safeName}`;
}

export function utf8FromBytes(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
