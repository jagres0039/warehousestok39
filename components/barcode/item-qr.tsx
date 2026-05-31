import QRCode from "qrcode";

interface ItemQrProps {
  /** The value to encode in the QR. Usually the item's barcode or SKU. */
  value: string;
  /** Pixel size of the QR square. Defaults to 192. */
  size?: number;
  /** Optional className passed to the wrapper. */
  className?: string;
}

/**
 * Server component that renders a QR code as inline SVG. No client JS shipped.
 * The SVG inherits currentColor by default; pass a className with text-* to
 * tint the dark modules.
 */
export async function ItemQr({ value, size = 192, className }: ItemQrProps) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    width: size,
    color: { dark: "#0f172a", light: "#ffffff00" },
  });
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      // QRCode lib returns trusted SVG markup we generated ourselves.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
