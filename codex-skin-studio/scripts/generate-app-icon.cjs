'use strict';

const fs = require('fs');
const path = require('path');
const { deflateSync } = require('zlib');

const MASTER_SIZE = 512;
const ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mixColor(from, to, amount) {
  return from.map((channel, index) => channel + (to[index] - channel) * clamp(amount));
}

function blend(target, source, opacity) {
  const amount = clamp(opacity);
  for (let index = 0; index < 3; index += 1) target[index] += (source[index] - target[index]) * amount;
}

function roundedRectDistance(x, y, cx, cy, halfWidth, halfHeight, radius) {
  const dx = Math.abs(x - cx) - halfWidth + radius;
  const dy = Math.abs(y - cy) - halfHeight + radius;
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - radius;
}

function coverage(distance, softness = 0.0028) {
  return clamp(0.5 - distance / softness);
}

function gaussian(x, y, cx, cy, radius) {
  const dx = x - cx;
  const dy = y - cy;
  return Math.exp(-(dx * dx + dy * dy) / (radius * radius));
}

function cardColor(kind, x, y, cx, cy, halfWidth, halfHeight) {
  const localX = clamp((x - (cx - halfWidth)) / (halfWidth * 2));
  const localY = clamp((y - (cy - halfHeight)) / (halfHeight * 2));
  if (kind === 'back') {
    return mixColor([91, 72, 208], [41, 110, 216], localX * 0.7 + (1 - localY) * 0.3);
  }
  if (kind === 'middle') {
    let color = mixColor([66, 180, 205], [70, 83, 207], localX * 0.45 + localY * 0.55);
    const glow = gaussian(x, y, cx + halfWidth * 0.28, cy - halfHeight * 0.38, halfWidth * 0.58);
    return mixColor(color, [167, 241, 238], glow * 0.34);
  }

  let color = mixColor([25, 77, 163], [44, 196, 206], localX * 0.45 + (1 - localY) * 0.28);
  const waveOne = cy - halfHeight * 0.19 + Math.sin((x - cx) * 15) * halfHeight * 0.11;
  const waveTwo = cy + halfHeight * 0.12 + Math.sin((x - cx) * 14 + 1.05) * halfHeight * 0.1;
  color = mixColor(color, [75, 223, 211], smoothstep(waveOne - 0.014, waveOne + 0.014, y));
  color = mixColor(color, [81, 92, 211], smoothstep(waveTwo - 0.014, waveTwo + 0.014, y));
  const glow = gaussian(x, y, cx - halfWidth * 0.3, cy - halfHeight * 0.26, halfWidth * 0.62);
  return mixColor(color, [176, 246, 239], glow * 0.22);
}

function paintCard(rgb, x, y, definition) {
  const distance = roundedRectDistance(x, y, definition.cx, definition.cy, definition.halfWidth, definition.halfHeight, definition.radius);
  const shadow = clamp(1 - Math.max(distance, 0) / 0.05);
  blend(rgb, [2, 7, 31], shadow * shadow * 0.3);
  const fill = coverage(distance);
  if (fill > 0) blend(rgb, cardColor(definition.kind, x, y, definition.cx, definition.cy, definition.halfWidth, definition.halfHeight), fill);
  const highlight = clamp(1 - Math.abs(distance + 0.006) / 0.006) * fill;
  if (highlight > 0) blend(rgb, [221, 248, 255], highlight * 0.16);
}

function paintSparkle(rgb, x, y) {
  const dx = Math.abs(x - 0.785);
  const dy = Math.abs(y - 0.236);
  const distance = dx + dy;
  const halo = clamp(1 - distance / 0.072);
  blend(rgb, [243, 185, 75], halo * halo * 0.22);
  const diamond = coverage(distance - 0.026, 0.003);
  if (diamond > 0) blend(rgb, [255, 230, 154], diamond);
  const core = coverage(Math.hypot(x - 0.785, y - 0.236) - 0.009, 0.002);
  if (core > 0) blend(rgb, [255, 252, 232], core);

  const dot = coverage(Math.hypot(x - 0.716, y - 0.316) - 0.009, 0.002);
  if (dot > 0) blend(rgb, [192, 247, 245], dot);
}

function renderMaster() {
  const pixels = Buffer.alloc(MASTER_SIZE * MASTER_SIZE * 4);
  const cards = [
    { kind: 'back', cx: 0.58, cy: 0.415, halfWidth: 0.275, halfHeight: 0.215, radius: 0.066 },
    { kind: 'middle', cx: 0.485, cy: 0.52, halfWidth: 0.275, halfHeight: 0.215, radius: 0.066 },
    { kind: 'front', cx: 0.39, cy: 0.625, halfWidth: 0.275, halfHeight: 0.215, radius: 0.066 },
  ];

  for (let py = 0; py < MASTER_SIZE; py += 1) {
    for (let px = 0; px < MASTER_SIZE; px += 1) {
      const x = (px + 0.5) / MASTER_SIZE;
      const y = (py + 0.5) / MASTER_SIZE;
      const outerDistance = roundedRectDistance(x, y, 0.5, 0.5, 0.47, 0.47, 0.145);
      const outer = coverage(outerDistance, 0.0035);
      const index = (py * MASTER_SIZE + px) * 4;
      if (outer <= 0) continue;

      let rgb = mixColor([7, 13, 43], [19, 57, 105], y * 0.72 + x * 0.14);
      rgb = mixColor(rgb, [38, 91, 167], gaussian(x, y, 0.77, 0.22, 0.42) * 0.42);
      rgb = mixColor(rgb, [84, 47, 161], gaussian(x, y, 0.21, 0.88, 0.38) * 0.34);
      const ambient = gaussian(x, y, 0.48, 0.52, 0.76);
      blend(rgb, [20, 33, 84], ambient * 0.12);

      for (const card of cards) paintCard(rgb, x, y, card);
      paintSparkle(rgb, x, y);

      const border = clamp(1 - Math.abs(outerDistance + 0.0025) / 0.005) * outer;
      if (border > 0) blend(rgb, [201, 235, 255], border * 0.22);
      pixels[index] = Math.round(clamp(rgb[0], 0, 255));
      pixels[index + 1] = Math.round(clamp(rgb[1], 0, 255));
      pixels[index + 2] = Math.round(clamp(rgb[2], 0, 255));
      pixels[index + 3] = Math.round(outer * 255);
    }
  }
  return pixels;
}

function resizeBilinear(source, sourceSize, targetSize) {
  if (sourceSize === targetSize) return source;
  const target = Buffer.alloc(targetSize * targetSize * 4);
  const sample = (x, y, channel) => source[(y * sourceSize + x) * 4 + channel];
  for (let y = 0; y < targetSize; y += 1) {
    const sourceY = (y + 0.5) * sourceSize / targetSize - 0.5;
    const y0 = clamp(Math.floor(sourceY), 0, sourceSize - 1);
    const y1 = clamp(y0 + 1, 0, sourceSize - 1);
    const fy = sourceY - Math.floor(sourceY);
    for (let x = 0; x < targetSize; x += 1) {
      const sourceX = (x + 0.5) * sourceSize / targetSize - 0.5;
      const x0 = clamp(Math.floor(sourceX), 0, sourceSize - 1);
      const x1 = clamp(x0 + 1, 0, sourceSize - 1);
      const fx = sourceX - Math.floor(sourceX);
      for (let channel = 0; channel < 4; channel += 1) {
        const top = sample(x0, y0, channel) * (1 - fx) + sample(x1, y0, channel) * fx;
        const bottom = sample(x0, y1, channel) * (1 - fx) + sample(x1, y1, channel) * fx;
        target[(y * targetSize + x) * 4 + channel] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return target;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 4, 'ascii');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
  return Buffer.concat([header, data, checksum]);
}

function pngFromPixels(pixels, size) {
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const targetStart = y * (size * 4 + 1);
    scanlines[targetStart] = 0;
    pixels.copy(scanlines, targetStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function icoFromFrames(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const directory = Buffer.alloc(frames.length * 16);
  let offset = header.length + directory.length;
  frames.forEach(({ size, png }, index) => {
    const entry = index * 16;
    directory[entry] = size === 256 ? 0 : size;
    directory[entry + 1] = size === 256 ? 0 : size;
    directory[entry + 2] = 0;
    directory[entry + 3] = 0;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, directory, ...frames.map((frame) => frame.png)]);
}

const buildDir = path.resolve(__dirname, '..', 'build');
const master = renderMaster();
const appIcon = resizeBilinear(master, MASTER_SIZE, 256);
const frames = ICON_SIZES.map((size) => {
  const pixels = size === 256 ? appIcon : resizeBilinear(master, MASTER_SIZE, size);
  return { size, png: pngFromPixels(pixels, size) };
});

fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(path.join(buildDir, 'app-icon.png'), pngFromPixels(appIcon, 256));
fs.writeFileSync(path.join(buildDir, 'app-icon.ico'), icoFromFrames(frames));
process.stdout.write('Generated build/app-icon.png and build/app-icon.ico\n');
