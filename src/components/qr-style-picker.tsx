import { useEffect, useRef, useState } from "react";
import type { QRStyleConfig } from "@/integrations/firebase/client";
import { styledQrDataUrl } from "@/lib/certificate-utils";
import { Loader2 } from "lucide-react";

// ─── Font options ─────────────────────────────────────────────────────────────

export const FONT_OPTIONS = [
  { label: "Cormorant Garamond", value: "Cormorant Garamond, serif" },
  { label: "Cinzel", value: "Cinzel, serif" },
  { label: "Great Vibes", value: "Great Vibes, cursive" },
  { label: "Dancing Script", value: "Dancing Script, cursive" },
  { label: "Playfair Display", value: "Playfair Display, serif" },
  { label: "EB Garamond", value: "EB Garamond, serif" },
  { label: "Libre Baskerville", value: "Libre Baskerville, serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Raleway", value: "Raleway, sans-serif" },
  { label: "Lato", value: "Lato, sans-serif" },
  { label: "Inter", value: "Inter, sans-serif" },
];

// ─── QR Dots style options ────────────────────────────────────────────────────

const DOTS_STYLES: { label: string; value: QRStyleConfig["dotsType"]; icon: string }[] = [
  { label: "Rounded", value: "rounded", icon: "⬛" },
  { label: "Dots", value: "dots", icon: "⚫" },
  { label: "Classy", value: "classy", icon: "🔲" },
  { label: "Classy Rounded", value: "classy-rounded", icon: "🔵" },
  { label: "Square", value: "square", icon: "▪️" },
  { label: "Extra Rounded", value: "extra-rounded", icon: "🟣" },
];

const CORNER_SQUARE_STYLES: { label: string; value: QRStyleConfig["cornersSquareType"] }[] = [
  { label: "Dot", value: "dot" },
  { label: "Square", value: "square" },
  { label: "Extra Rounded", value: "extra-rounded" },
];

const CORNER_DOT_STYLES: { label: string; value: QRStyleConfig["cornersDotType"] }[] = [
  { label: "Dot", value: "dot" },
  { label: "Square", value: "square" },
];

// ─── Live QR preview ─────────────────────────────────────────────────────────

function QRPreview({
  config,
  previewText = "https://example.com/verify?id=PREVIEW",
}: {
  config: QRStyleConfig;
  previewText?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = await styledQrDataUrl(previewText, { ...config, size: 200 });
        setDataUrl(url);
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [config, previewText]);

  return (
    <div
      className="flex items-center justify-center rounded-xl border border-border"
      style={{
        width: 120,
        height: 120,
        background: config.backgroundColor === "transparent" ? "transparent" : config.backgroundColor,
      }}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : dataUrl ? (
        <img src={dataUrl} alt="QR preview" className="h-full w-full object-contain rounded-xl" />
      ) : (
        <div className="h-16 w-16 rounded bg-black/10" />
      )}
    </div>
  );
}

// ─── Main QR Style Picker ─────────────────────────────────────────────────────

export function QRStylePicker({
  value,
  onChange,
  previewText,
}: {
  value: QRStyleConfig;
  onChange: (v: QRStyleConfig) => void;
  previewText?: string;
}) {
  const set = <K extends keyof QRStyleConfig>(k: K, v: QRStyleConfig[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-5">
      {/* Live preview */}
      <div className="flex items-center gap-4">
        <QRPreview config={value} previewText={previewText} />
        <div className="text-xs text-muted-foreground leading-relaxed">
          Live preview — updates as you change settings
        </div>
      </div>

      {/* Dot style grid */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Dot Style</label>
        <div className="grid grid-cols-3 gap-1.5">
          {DOTS_STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => set("dotsType", s.value)}
              className={`rounded-lg border px-2 py-2 text-xs transition-all ${
                value.dotsType === s.value
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                  : "border-border bg-card hover:bg-accent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Dot Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.dotsColor}
              onChange={(e) => set("dotsColor", e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-border"
            />
            <input
              type="text"
              value={value.dotsColor}
              onChange={(e) => set("dotsColor", e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-ring"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Background
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.backgroundColor === "transparent" ? "#ffffff" : value.backgroundColor}
              onChange={(e) => set("backgroundColor", e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-border"
            />
            <input
              type="text"
              value={value.backgroundColor}
              onChange={(e) => set("backgroundColor", e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-ring"
              placeholder="transparent"
            />
          </div>
        </div>
      </div>

      {/* Gradient toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.useGradient}
            onChange={(e) => set("useGradient", e.target.checked)}
            className="rounded"
          />
          <span className="text-xs font-medium text-muted-foreground">Use gradient on dots</span>
        </label>
        {value.useGradient && (
          <div className="mt-3 grid grid-cols-2 gap-3 pl-6">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">From</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={value.gradientFrom}
                  onChange={(e) => set("gradientFrom", e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border border-border"
                />
                <input
                  type="text"
                  value={value.gradientFrom}
                  onChange={(e) => set("gradientFrom", e.target.value)}
                  className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs font-mono outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">To</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={value.gradientTo}
                  onChange={(e) => set("gradientTo", e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border border-border"
                />
                <input
                  type="text"
                  value={value.gradientTo}
                  onChange={(e) => set("gradientTo", e.target.value)}
                  className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs font-mono outline-none"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] text-muted-foreground mb-1">
                Gradient Type
              </label>
              <div className="flex gap-2">
                {(["linear", "radial"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => set("gradientType", t)}
                    className={`rounded px-3 py-1 text-xs ${
                      value.gradientType === t
                        ? "bg-indigo-100 text-indigo-700 font-medium"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {value.gradientType === "linear" && (
              <div className="col-span-2">
                <label className="block text-[10px] text-muted-foreground mb-1">
                  Rotation: {value.gradientRotation}°
                </label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={value.gradientRotation}
                  onChange={(e) => set("gradientRotation", Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Corner styles */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Corner Square
          </label>
          <div className="flex flex-wrap gap-1">
            {CORNER_SQUARE_STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => set("cornersSquareType", s.value)}
                className={`rounded px-2 py-1 text-xs ${
                  value.cornersSquareType === s.value
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Corner Dot
          </label>
          <div className="flex gap-1">
            {CORNER_DOT_STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => set("cornersDotType", s.value)}
                className={`rounded px-2 py-1 text-xs ${
                  value.cornersDotType === s.value
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Center logo */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Center Logo URL (optional)
        </label>
        <input
          type="text"
          value={value.centerLogoUrl}
          onChange={(e) => set("centerLogoUrl", e.target.value)}
          placeholder="https://... or leave empty"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Use a square PNG/SVG. Requires error correction H (already set).
        </p>
      </div>
    </div>
  );
}
