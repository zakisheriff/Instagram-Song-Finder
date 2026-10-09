import { ImageResponse } from "next/og";
import { LOGO_DATA_URI } from "@/lib/brand/logo-data-uri";
import { site } from "@/lib/site";

export const alt = "Instagram Song Finder: find songs on Instagram by their ISRC code";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GRADIENT = "linear-gradient(to right, rgb(251, 114, 75), rgb(255, 0, 105), rgb(211, 0, 197))";

/** Social sharing card composed from the app logo, headline and site colours. */
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
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={LOGO_DATA_URI} width={96} height={96} alt="" />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{site.name}</div>
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
