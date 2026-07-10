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
        background: "#0b1017",
        border: "1px solid #1f2937",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        position: "relative",
        width: "100%"
      }}
    >
      <div
        style={{
          border: "3px solid #0f72d9",
          borderRadius: "999px",
          height: 12,
          left: 7,
          position: "absolute",
          top: 10,
          width: 13
        }}
      />
      <div
        style={{
          border: "3px solid #0f72d9",
          borderRadius: "999px",
          height: 12,
          position: "absolute",
          right: 7,
          top: 10,
          width: 13
        }}
      />
      <div
        style={{
          background: "#f8fafc",
          borderRadius: "999px",
          height: 3,
          position: "absolute",
          transform: "rotate(-42deg)",
          width: 14
        }}
      />
      <div
        style={{
          background: "#0f72d9",
          borderRadius: "999px",
          height: 5,
          position: "absolute",
          right: 6,
          top: 6,
          width: 5
        }}
      />
    </div>,
    {
      ...size
    }
  );
}
