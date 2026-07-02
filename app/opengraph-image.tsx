import { ImageResponse } from "next/og";

export const alt = "1337 Corp — the quiet architects of what comes next.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated at build time. Mirrors the site's schematic-sheet identity so
// that every shared link unfurls with the brand instead of a blank card.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#05050a",
          backgroundImage:
            "radial-gradient(1100px 560px at 50% 44%, rgba(0,255,159,0.07), rgba(5,5,10,0) 62%)",
          position: "relative",
        }}
      >
        {/* The drawing sheet's frame and construction guides */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 40,
            bottom: 40,
            left: 300,
            width: 1,
            backgroundColor: "rgba(255,255,255,0.05)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 40,
            bottom: 40,
            right: 300,
            width: 1,
            backgroundColor: "rgba(255,255,255,0.05)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            fontSize: 250,
            fontWeight: 700,
            letterSpacing: -10,
            color: "#ffffff",
            lineHeight: 1,
          }}
        >
          1337
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 12,
              color: "rgba(255,255,255,0.5)",
              marginLeft: 16,
              marginTop: 24,
            }}
          >
            CORP.
          </span>
        </div>

        {/* The phosphor signature rule */}
        <div
          style={{
            width: 220,
            height: 3,
            marginTop: 30,
            display: "flex",
            backgroundColor: "#00ff9f",
            opacity: 0.85,
          }}
        />

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 26,
            letterSpacing: 8,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          THE QUIET ARCHITECTS OF WHAT COMES NEXT
        </div>

        {/* The title block, bottom-right corner of the sheet */}
        <div
          style={{
            position: "absolute",
            right: 64,
            bottom: 62,
            display: "flex",
            gap: 26,
            fontSize: 15,
            letterSpacing: 3,
            color: "rgba(255,255,255,0.35)",
          }}
        >
          <span>DWG 1337-CD</span>
          <span>REV 2026.07</span>
          <span style={{ color: "rgba(0,255,159,0.7)" }}>1337.CD</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
