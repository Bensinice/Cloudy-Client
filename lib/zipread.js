// Liest einzelne Dateien aus einer .jar/.zip, ohne alles zu entpacken (keine Abhängigkeiten).
const fs = require('fs'), zlib = require('zlib');

function openZip(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const tl = Math.min(size, 65557), tail = Buffer.alloc(tl);
    fs.readSync(fd, tail, 0, tl, size - tl);
    let e = -1;
    for (let i = tl - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('kein ZIP');
    const count = tail.readUInt16LE(e + 10), cdSize = tail.readUInt32LE(e + 12), cdOff = tail.readUInt32LE(e + 16);
    if (cdOff === 0xffffffff || cdSize > 64 * 1024 * 1024) throw new Error('ZIP64 nicht unterstützt');
    const cd = Buffer.alloc(cdSize);
    fs.readSync(fd, cd, 0, cdSize, cdOff);
    const map = new Map();
    for (let i = 0, p = 0; i < count && p + 46 <= cd.length; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) break;
      const nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32);
      map.set(cd.toString('utf8', p + 46, p + 46 + nl), {
        method: cd.readUInt16LE(p + 10), csize: cd.readUInt32LE(p + 20), usize: cd.readUInt32LE(p + 24), off: cd.readUInt32LE(p + 42)
      });
      p += 46 + nl + el + cl;
    }
    return {
      has: n => map.has(n),
      read(name, max = 4 * 1024 * 1024) {
        const t = map.get(name);
        if (!t || t.usize > max) return null;
        const h = Buffer.alloc(30);
        fs.readSync(fd, h, 0, 30, t.off);
        const data = Buffer.alloc(t.csize);
        fs.readSync(fd, data, 0, t.csize, t.off + 30 + h.readUInt16LE(26) + h.readUInt16LE(28));
        return t.method === 0 ? data : t.method === 8 ? zlib.inflateRawSync(data) : null;
      },
      close() { try { fs.closeSync(fd); } catch {} }
    };
  } catch (err) { fs.closeSync(fd); throw err; }
}
module.exports = { openZip };
