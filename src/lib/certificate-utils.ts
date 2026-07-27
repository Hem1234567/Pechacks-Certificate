import QRCodeStyling, { type Options as QROptions } from "qr-code-styling";
import type { QRStyleConfig } from "@/integrations/firebase/client";

export function newCertificateId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `PECH4-${year}-${time}${rand}`;
}

export function verifyUrl(certificateId: string): string {
  if (typeof window === "undefined") return `/verify?id=${certificateId}`;
  return `${window.location.origin}/verify?id=${certificateId}`;
}

/** Default QR style config — classic navy style */
export const DEFAULT_QR_CONFIG: QRStyleConfig = {
  dotsType: "rounded",
  dotsColor: "#0b1a3a",
  backgroundColor: "#ffffff",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
  useGradient: false,
  gradientType: "linear",
  gradientFrom: "#0b1a3a",
  gradientTo: "#c9a24b",
  gradientRotation: 45,
  centerLogoUrl: "",
  size: 512,
};

/** Build QRCodeStyling options from our config */
function buildQROptions(text: string, config: QRStyleConfig): QROptions {
  const dotsOptions: QROptions["dotsOptions"] = config.useGradient
    ? {
        type: config.dotsType as any,
        gradient: {
          type: config.gradientType,
          rotation: (config.gradientRotation * Math.PI) / 180,
          colorStops: [
            { offset: 0, color: config.gradientFrom },
            { offset: 1, color: config.gradientTo },
          ],
        },
      }
    : { type: config.dotsType as any, color: config.dotsColor };

  const opts: QROptions = {
    width: config.size,
    height: config.size,
    data: text,
    margin: 6,
    qrOptions: { errorCorrectionLevel: "H" },
    dotsOptions,
    cornersSquareOptions: {
      type: config.cornersSquareType as any,
      color: config.useGradient ? config.gradientFrom : config.dotsColor,
    },
    cornersDotOptions: {
      type: config.cornersDotType as any,
      color: config.useGradient ? config.gradientTo : config.dotsColor,
    },
    backgroundOptions: {
      color:
        config.backgroundColor === "transparent"
          ? "#00000000"
          : config.backgroundColor,
    },
  };

  if (config.centerLogoUrl) {
    opts.image = config.centerLogoUrl;
    opts.imageOptions = { crossOrigin: "anonymous", margin: 6, imageSize: 0.28 };
  }

  return opts;
}

/** Generate a styled QR code as a PNG data URL */
export async function styledQrDataUrl(
  text: string,
  config: QRStyleConfig = DEFAULT_QR_CONFIG
): Promise<string> {
  const qr = new QRCodeStyling(buildQROptions(text, config));
  const rawData = await qr.getRawData("png");
  if (!rawData) throw new Error("QR generation failed");
  // getRawData returns Blob in browser, Buffer in Node — handle both
  const blob: Blob =
    rawData instanceof Blob
      ? rawData
      : new Blob([rawData as unknown as ArrayBuffer], { type: "image/png" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Backward-compat wrapper — uses default navy style */
export async function qrDataUrl(text: string, _size = 512): Promise<string> {
  return styledQrDataUrl(text, { ...DEFAULT_QR_CONFIG, size: _size });
}

export async function downloadCertificatePdf(
  elementId: string,
  filename: string,
  onProgress?: (msg: string) => void
) {
  try {
    onProgress?.("Loading libraries…");
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const el = document.getElementById(elementId);
    if (!el) throw new Error("Certificate element not found");

    onProgress?.("Rendering certificate…");
    const canvas = await html2canvas(el, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });

    onProgress?.("Saving PDF…");
    const imgData = canvas.toDataURL("image/png");

    // Calculate physical dimensions in mm (assuming 96 DPI for the DOM element)
    const pdfWidth = (el.offsetWidth / 96) * 25.4;
    const pdfHeight = (el.offsetHeight / 96) * 25.4;
    const orientation = pdfWidth > pdfHeight ? "landscape" : "portrait";

    const pdf = new jsPDF({ orientation, unit: "mm", format: [pdfWidth, pdfHeight] });
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
    pdf.save(filename);
    onProgress?.("");
  } catch (e: any) {
    onProgress?.("");
    console.error("PDF generation failed:", e);
    alert(
      "Automatic PDF download failed: " +
        e.message +
        "\n\nThe print dialog will open — choose 'Save as PDF' as the printer."
    );
    window.print();
  }
}
