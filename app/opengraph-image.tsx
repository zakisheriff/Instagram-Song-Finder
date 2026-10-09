import { ImageResponse } from "next/og";
import { LOGO_DATA_URI } from "@/lib/brand/logo-data-uri";

export const alt = "Instagram Song Finder logo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Sharing card shown when a link to the site is posted: the logo alone, centred on white. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <img src={LOGO_DATA_URI} width={460} height={460} alt="" />
      </div>
    ),
    size,
  );
}
