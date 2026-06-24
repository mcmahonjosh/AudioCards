import { decompress as zstdDecompress } from 'fzstd';
import { utf8FromBytes } from './apkgFileUtils';

export type ApkgCollectionFormat = 'anki2' | 'anki21' | 'anki21b';

export interface ApkgMediaEntry {
  name: string;
  zipIndex: string;
}

function readVarint(buf: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error('Invalid protobuf varint');
  }
  return { value, next: pos };
}

function skipField(buf: Uint8Array, offset: number, wireType: number): number {
  if (wireType === 0) return readVarint(buf, offset).next;
  if (wireType === 2) {
    const len = readVarint(buf, offset);
    return len.next + len.value;
  }
  throw new Error(`Unsupported protobuf wire type ${wireType}`);
}

function parseMediaEntry(bytes: Uint8Array): { name: string; legacyZipFilename?: number } {
  let name = '';
  let legacyZipFilename: number | undefined;
  let pos = 0;

  while (pos < bytes.length) {
    const tag = readVarint(bytes, pos);
    pos = tag.next;
    const field = tag.value >> 3;
    const wire = tag.value & 7;

    if (field === 1 && wire === 2) {
      const len = readVarint(bytes, pos);
      pos = len.next;
      name = utf8FromBytes(bytes.subarray(pos, pos + len.value));
      pos += len.value;
    } else if (field === 2 && wire === 0) {
      pos = readVarint(bytes, pos).next;
    } else if (field === 3 && wire === 2) {
      const len = readVarint(bytes, pos);
      pos = len.next + len.value;
    } else if (field === 255 && wire === 0) {
      legacyZipFilename = readVarint(bytes, pos).value;
      pos = readVarint(bytes, pos).next;
    } else {
      pos = skipField(bytes, pos, wire);
    }
  }

  return { name, legacyZipFilename };
}

export function parseMediaEntriesProtobuf(data: Uint8Array): ApkgMediaEntry[] {
  const entries: ApkgMediaEntry[] = [];
  let pos = 0;
  let sequentialIndex = 0;

  while (pos < data.length) {
    const tag = readVarint(data, pos);
    pos = tag.next;
    const field = tag.value >> 3;
    const wire = tag.value & 7;

    if (field === 1 && wire === 2) {
      const len = readVarint(data, pos);
      pos = len.next;
      const chunk = data.subarray(pos, pos + len.value);
      pos += len.value;
      const parsed = parseMediaEntry(chunk);
      const zipIndex = String(parsed.legacyZipFilename ?? sequentialIndex);
      if (parsed.name) {
        entries.push({ name: parsed.name, zipIndex });
      }
      sequentialIndex++;
    } else {
      pos = skipField(data, pos, wire);
    }
  }

  return entries;
}

const ZSTD_MAGIC = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]);

export function isZstdCompressed(data: Uint8Array): boolean {
  return (
    data.length >= 4 &&
    data[0] === ZSTD_MAGIC[0] &&
    data[1] === ZSTD_MAGIC[1] &&
    data[2] === ZSTD_MAGIC[2] &&
    data[3] === ZSTD_MAGIC[3]
  );
}

export function maybeDecompressZstd(data: Uint8Array): Uint8Array {
  if (!isZstdCompressed(data)) return data;
  return zstdDecompress(data);
}

export function decompressZstd(data: Uint8Array): Uint8Array {
  return zstdDecompress(data);
}

export function normalizeMediaName(name: string): string {
  return name.normalize('NFC');
}

export function selectCollectionFormat(files: string[]): ApkgCollectionFormat | null {
  if (files.includes('collection.anki21b')) return 'anki21b';
  if (files.includes('collection.anki21')) return 'anki21';
  if (files.includes('collection.anki2')) return 'anki2';
  return null;
}

export function collectionZipName(format: ApkgCollectionFormat): string {
  if (format === 'anki21b') return 'collection.anki21b';
  if (format === 'anki21') return 'collection.anki21';
  return 'collection.anki2';
}

export function collectionDbFileName(format: ApkgCollectionFormat): string {
  return format === 'anki21b' ? 'collection.anki21' : collectionZipName(format);
}
