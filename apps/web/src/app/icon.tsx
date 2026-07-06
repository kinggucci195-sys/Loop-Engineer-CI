import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#111827",
        color: "#34d399",
        display: "flex",
        fontSize: 18,
        fontWeight: 700,
        height: "100%",
        justifyContent: "center",
        width: "100%"
      }}
    >
      L
    </div>,
    {
      ...size
    }
  );
}
