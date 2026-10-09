import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = "Instagram Song Finder: find songs on Instagram by their ISRC code";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK_PATH =
  "M22 10.5a3 3 0 0 1 2.33-2.92l24-5.5A3 3 0 0 1 52 5v34.5a9 9 0 1 1-6-8.49V17.76l-18 4.13V45.5a9 9 0 1 1-6-8.49V10.5Zm6 5.23 18-4.12V8.76l-18 4.13v2.84ZM19 42.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm24-6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z";

const GRADIENT = "linear-gradient(to right, rgb(251, 114, 75), rgb(255, 0, 105), rgb(211, 0, 197))";

/** Social sharing card composed from the site's own mark, headline and colours. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#ffffff",
          color: "rgb(17, 17, 18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 60 60">
            <defs>
              <linearGradient id="g" x1="6" y1="54" x2="54" y2="6" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fb724b" />
                <stop offset="0.5" stopColor="#ff0069" />
                <stop offset="1" stopColor="#d300c5" />
              </linearGradient>
            </defs>
            <path fill="url(#g)" d={MARK_PATH} />
          </svg>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 600 }}>{site.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1.18 }}>
          <div style={{ display: "flex" }}>Find songs on Instagram</div>
          <div style={{ display: "flex" }}>
            <span style={{ marginRight: 22 }}>by their</span>
            <span style={{ backgroundImage: GRADIENT, backgroundClip: "text", color: "transparent" }}>
              ISRC code
            </span>
            <span>.</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28,
            color: "rgb(104, 106, 110)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 72,
              padding: "0 32px",
              border: "2px solid rgb(209, 211, 213)",
              borderRadius: 24,
              color: "rgb(17, 17, 18)",
              fontWeight: 600,
            }}
          >
            isrc:XXXXXXXXXXXX
          </div>
          <div style={{ display: "flex" }}>
            {site.domain} · by {site.publisher.name}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
