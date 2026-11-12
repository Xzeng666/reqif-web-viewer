"use strict";

const zipSignature = {
  end: 0x06054b50,
  directory: 0x02014b50,
  local: 0x04034b50,
};

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return crc;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function invalidZip() {
  return new Error("ReqIFz 压缩包已损坏或格式无效");
}

async function readZip(file) {
  const tailStart = Math.max(0, file.size - 65557);
  const tail = new DataView(await file.slice(tailStart).arrayBuffer());
  let end = tail.byteLength - 22;
  while (end >= 0 && (tail.getUint32(end, true) !== zipSignature.end ||
    end + 22 + tail.getUint16(end + 20, true) !== tail.byteLength)) {
    end--;
  }
  if (end < 0) throw invalidZip();

  const count = tail.getUint16(end + 10, true);
  const length = tail.getUint32(end + 12, true);
  const offset = tail.getUint32(end + 16, true);
  if (tail.getUint32(end + 4, true) || count !== tail.getUint16(end + 8, true) ||
      count === 0xffff || length === 0xffffffff || offset === 0xffffffff) {
    throw new Error("不支持分卷或使用 ZIP64 中央目录的 ReqIFz");
  }
  if (count > 20000 || length > 32 * 1024 * 1024) {
    throw new Error("ReqIFz 目录过大");
  }
  if (offset + length > tailStart + end) throw invalidZip();

  const directory = new DataView(await file.slice(offset, offset + length).arrayBuffer());
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  const legacy = new TextDecoder("windows-1252");
  const entries = new Map();
  let total = 0;
  let position = 0;
  for (let index = 0; index < count; index++) {
    if (position + 46 > length || directory.getUint32(position, true) !== zipSignature.directory) {
      throw invalidZip();
    }
    const flags = directory.getUint16(position + 8, true);
    const method = directory.getUint16(position + 10, true);
    const crc = directory.getUint32(position + 16, true);
    const compressed = directory.getUint32(position + 20, true);
    const size = directory.getUint32(position + 24, true);
    const nameLength = directory.getUint16(position + 28, true);
    const extraLength = directory.getUint16(position + 30, true);
    const commentLength = directory.getUint16(position + 32, true);
    const localOffset = directory.getUint32(position + 42, true);
    const nameStart = position + 46;
    position = nameStart + nameLength + extraLength + commentLength;
    if (position > length || localOffset + 30 > offset) throw invalidZip();

    const nameBytes = new Uint8Array(directory.buffer, nameStart, nameLength);
    let name;
    try {
      name = utf8.decode(nameBytes);
    } catch (error) {
      if (flags & 0x800) throw invalidZip();
      name = legacy.decode(nameBytes);
    }
    total += size;
    if (total > 500 * 1024 * 1024) throw new Error("ReqIFz 解压后超过 500 MiB");
    if (name.endsWith("/")) continue;
    if (!name || entries.has(name)) throw invalidZip();
    entries.set(name, { name, flags, method, crc, compressed, size, localOffset });
  }

  async function read(entry) {
    if (entry.flags & 1) throw new Error("不支持加密的 ReqIFz 条目");
    const local = new DataView(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
    if (local.getUint32(0, true) !== zipSignature.local ||
        local.getUint16(8, true) !== entry.method) throw invalidZip();
    const start = entry.localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    if (start + entry.compressed > offset) throw invalidZip();
    const data = file.slice(start, start + entry.compressed);
    let bytes;
    if (entry.method === 0) {
      if (entry.compressed !== entry.size) throw invalidZip();
      bytes = new Uint8Array(await data.arrayBuffer());
    } else if (entry.method === 8) {
      let inflater;
      try {
        inflater = new DecompressionStream("deflate-raw");
      } catch {
        throw new Error("当前浏览器无法解压 ReqIFz，请使用新版浏览器");
      }
      const reader = data.stream().pipeThrough(inflater).getReader();
      bytes = new Uint8Array(entry.size);
      let written = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (written + value.length > bytes.length) throw invalidZip();
          bytes.set(value, written);
          written += value.length;
        }
      } catch {
        await reader.cancel().catch(() => {});
        throw invalidZip();
      } finally {
        reader.releaseLock();
      }
      if (written !== entry.size) throw invalidZip();
    } else {
      throw new Error("不支持该 ReqIFz 条目的压缩方式");
    }
    if (crc32(bytes) !== entry.crc) throw invalidZip();
    return bytes;
  }

  return { entries, read };
}
