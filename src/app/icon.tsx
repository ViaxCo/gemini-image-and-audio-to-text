import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  const bg = "#0ea5e9"; // sky-500
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: "white",
        fontSize: 40,
        fontWeight: 800,
        letterSpacing: -1,
      }}
    >
      GM
    </div>,
    { ...size },
  );
}
