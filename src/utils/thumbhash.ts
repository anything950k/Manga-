/**
 * Utility to decode Lnori ThumbHash strings to Data URLs on the client.
 */

const THUMB_URL_CACHE = new Map<string, string>();

function b64ToBytes(str: string): Uint8Array {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (normalized.length % 4)) % 4;
  const binary = atob(normalized + '='.repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function thumbHashToDataURL(hash: string): string {
  if (!hash) return '';
  if (THUMB_URL_CACHE.has(hash)) return THUMB_URL_CACHE.get(hash)!;

  try {
    const bytes = b64ToBytes(hash);
    const { PI, min, max, cos, round } = Math;
    const c = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16);
    const l = bytes[3] | (bytes[4] << 8);
    const s = (c & 63) / 63;
    const f = ((c >> 6) & 63) / 31.5 - 1;
    const u = ((c >> 12) & 63) / 31.5 - 1;
    const h = ((c >> 18) & 31) / 31;
    const d = c >> 23;
    const g = ((l >> 3) & 63) / 63;
    const i = ((l >> 9) & 63) / 63;
    const m = l >> 15;
    const y = max(3, m ? (d ? 5 : 7) : 7 & l);
    const b = max(3, m ? 7 & l : d ? 5 : 7);
    const A = d ? (15 & bytes[5]) / 15 : 1;
    const p = (bytes[5] >> 4) / 15;
    const w = d ? 6 : 5;
    let D = 0;
    const coeff = (nX: number, nY: number, scale: number) => {
      const out: number[] = [];
      for (let ay = 0; ay < nY; ay++) {
        for (let ax = ay ? 0 : 1; ax * nY < nX * (nY - ay); ax++) {
          out.push((((bytes[w + (D >> 1)] >> ((1 & D++) << 2)) & 15) / 7.5 - 1) * scale);
        }
      }
      return out;
    };
    const L = coeff(y, b, h);
    const T = coeff(3, 3, 1.25 * g);
    const k = coeff(3, 3, 1.25 * i);
    const v = d && coeff(5, 5, p);
    const ratio = y / b;
    const I = round(ratio > 1 ? 32 : 32 * ratio);
    const R = round(ratio > 1 ? 32 / ratio : 32);
    const rgba = new Uint8Array(I * R * 4);
    const nLX = max(y, d ? 5 : 3);
    const nLY = max(b, d ? 5 : 3);
    const fx = new Float32Array(I * nLX);
    const fy = new Float32Array(R * nLY);
    for (let x = 0; x < I; x++) {
      const ox = x * nLX;
      const px = (PI / I) * (x + 0.5);
      for (let j = 0; j < nLX; j++) fx[ox + j] = cos(px * j);
    }
    for (let yPos = 0; yPos < R; yPos++) {
      const oy = yPos * nLY;
      const py = (PI / R) * (yPos + 0.5);
      for (let j = 0; j < nLY; j++) fy[oy + j] = cos(py * j);
    }
    for (let yPos = 0, px = 0; yPos < R; yPos++) {
      const fyRow = yPos * nLY;
      for (let x = 0; x < I; x++, px += 4) {
        const fxRow = x * nLX;
        let lr = s,
          lg = f,
          lb = u,
          la = A;
        for (let j = 0, idx = 0; j < b; j++) {
          const fyVal = 2 * fy[fyRow + j];
          for (let kx = j ? 0 : 1; kx * b < y * (b - j); kx++, idx++) {
            lr += L[idx] * fx[fxRow + kx] * fyVal;
          }
        }
        for (let j = 0, idx = 0; j < 3; j++) {
          const fyVal = 2 * fy[fyRow + j];
          for (let kx = j ? 0 : 1; kx < 3 - j; kx++, idx++) {
            const fxVal = fx[fxRow + kx] * fyVal;
            lg += T[idx] * fxVal;
            lb += k[idx] * fxVal;
          }
        }
        if (d && v) {
          for (let j = 0, idx = 0; j < 5; j++) {
            const fyVal = 2 * fy[fyRow + j];
            for (let kx = j ? 0 : 1; kx < 5 - j; kx++, idx++) {
              la += v[idx] * fx[fxRow + kx] * fyVal;
            }
          }
        }
        const bCh = lr - (2 / 3) * lg;
        const rCh = (3 * lr - bCh + lb) / 2;
        const gCh = rCh - lb;
        rgba[px] = max(0, 255 * min(1, rCh));
        rgba[px + 1] = max(0, 255 * min(1, gCh));
        rgba[px + 2] = max(0, 255 * min(1, bCh));
        rgba[px + 3] = max(0, 255 * min(1, la));
      }
    }

    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = I * 8;
    canvas.height = R * 8;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const imgData = ctx.createImageData(I, R);
    imgData.data.set(rgba);

    const tmp = document.createElement('canvas');
    tmp.width = I;
    tmp.height = R;
    const tmpCtx = tmp.getContext('2d');
    if (!tmpCtx) return '';
    tmpCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    THUMB_URL_CACHE.set(hash, dataUrl);
    return dataUrl;
  } catch {
    return '';
  }
}
