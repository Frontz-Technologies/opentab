import QRCode from "qrcode";

export async function generateMyDataQR(qrUrl: string): Promise<string> {
  return QRCode.toDataURL(qrUrl, { width: 160, margin: 1 });
}
