// QR code drawing and camera scanning for pairing a display. Both libraries are loaded on first use.
import { loadScript, parseLinkCode } from './link.js';

const QR_URL = 'https://unpkg.com/qrcode-generator@2.0.4/dist/qrcode.js';
const JSQR_URL = 'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js';
const SCAN_MS = 200;
const SCAN_WIDTH = 800;

// Lowest error correction keeps the modules big, which selfie cameras read more easily.
export const qrSvg = async text => {
  await loadScript(QR_URL);
  const qr = window.qrcode(0, 'L');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ scalable: true, margin: 0 });
};

// Starts the camera and calls onCode once with the first valid pairing code. Returns a stop function.
export const startScanner = async (video, onCode, facingMode = 'user') => {
  await loadScript(JSQR_URL);
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });

  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  };

  // iOS only plays inline and without a tap when these are set as properties.
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  const scan = () => {
    if (stopped) return;
    if (video.videoWidth) {
      const scale = Math.min(1, SCAN_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      const code = result && parseLinkCode(result.data);
      if (code) {
        stop();
        onCode(code);
        return;
      }
    }
    setTimeout(scan, SCAN_MS);
  };
  scan();

  return stop;
};
