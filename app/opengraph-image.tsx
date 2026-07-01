import { ImageResponse } from "next/og";

export const alt = "1337 Corp — the quiet architects of what comes next.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated at build time. Mirrors the site's dark, kinetic identity so that
// every shared link unfurls with the brand instead of a blank card.
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
            "radial-gradient(1200px 600px at 50% 42%, rgba(0,229,255,0.10), rgba(5,5,10,0) 60%), radial-gradient(900px 500px at 50% 100%, rgba(255,46,99,0.10), rgba(5,5,10,0) 60%)",
          position: "relative",
        }}
      >
        {/* Inset frame, echoing the on-site border */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            fontSize: 260,
            fontWeight: 900,
            letterSpacing: -14,
            color: "#ffffff",
            lineHeight: 1,
          }}
        >
          1337
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 12,
              color: "rgba(255,255,255,0.5)",
              marginLeft: 14,
              marginTop: 22,
            }}
          >
            CORP.
          </span>
        </div>

        {/* Tri-color signature bar */}
        <div
          style={{
            width: 240,
            height: 4,
            marginTop: 28,
            display: "flex",
            backgroundImage:
              "linear-gradient(90deg, #00e5ff 0%, #ffffff 50%, #ff2e63 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontSize: 26,
            letterSpacing: 8,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          THE QUIET ARCHITECTS OF WHAT COMES NEXT
        </div>
      </div>
    ),
    { ...size }
  );
}
