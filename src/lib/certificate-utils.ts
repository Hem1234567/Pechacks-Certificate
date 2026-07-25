import QRCode from "qrcode";

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

export async function qrDataUrl(text: string, size = 512): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: "#0b1a3a", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
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
      useCORS: true,       // Crucial for cross-origin images (Cloudinary)
      allowTaint: false,   // Must be false so toDataURL works
      logging: true,       // Enable logging to see issues if it fails
      width: el.offsetWidth,
      height: el.offsetHeight,
    });

    onProgress?.("Saving PDF…");
    const imgData = canvas.toDataURL("image/png");
    
    // A4 landscape: 297mm x 210mm
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.addImage(imgData, "PNG", 0, 0, 297, 210, undefined, "FAST");
    pdf.save(filename);
    onProgress?.("");
  } catch (e: any) {
    onProgress?.("");
    console.error("PDF generation failed:", e);
    alert(
      "Automatic PDF download failed: " + e.message + "\n\nThe print dialog will open — choose 'Save as PDF' as the printer."
    );
    window.print();
  }
}
