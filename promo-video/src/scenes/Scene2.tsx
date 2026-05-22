import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import React from "react";

const features = [
  { icon: "🛒", title: "Marketplace" },
  { icon: "🚗", title: "Carpooling" },
  { icon: "🔍", title: "Lost & Found" },
  { icon: "👥", title: "Resident Directory" },
  { icon: "🪪", title: "Digital ID Cards" },
  { icon: "📢", title: "Announcements" },
  { icon: "🛠️", title: "Helpdesk" },
  { icon: "✍️", title: "Community Blogs" },
];

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Progress bar filling (0-16s)
  const progressWidth = interpolate(frame, [0, 480], [0, width]);

  return (
    <AbsoluteFill style={{ backgroundColor: "var(--cream)", padding: 60 }}>
      {/* Title */}
      <h2 style={{
        fontSize: 70,
        fontFamily: "var(--font-serif)",
        color: "var(--jade)",
        marginBottom: 60,
        textAlign: "center"
      }}>
        What We Built
      </h2>

      {/* Feature Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 30,
        flex: 1
      }}>
        {features.map((feat, i) => {
          const entryFrame = i * 40;
          const entrySpring = spring({
            frame: frame - entryFrame,
            fps,
            config: { damping: 14, stiffness: 100 },
          });

          const opacity = interpolate(frame, [entryFrame, entryFrame + 15], [0, 1]);
          const translateX = interpolate(entrySpring, [0, 1], [-50, 0]);

          return (
            <div key={i} style={{
              backgroundColor: "var(--surface)",
              padding: 40,
              borderRadius: 24,
              border: "2px solid var(--border)",
              boxShadow: "var(--shadow-card)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity,
              transform: `translateX(${translateX}px) scale(${entrySpring})`,
            }}>
              <div style={{ fontSize: 100, marginBottom: 20 }}>{feat.icon}</div>
              <div style={{
                fontSize: 36,
                fontWeight: "bold",
                color: "var(--jade)",
                textAlign: "center"
              }}>
                {feat.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Text */}
      <div style={{
        marginTop: 60,
        textAlign: "center",
        fontSize: 48,
        fontWeight: "bold",
        color: "var(--jade)",
      }}>
        8 features live at<br />
        <span style={{ color: "var(--gold)" }}>society.psots.in</span>
      </div>

      {/* Progress Bar */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        height: 15,
        width: progressWidth,
        backgroundColor: "var(--jade)",
      }} />
    </AbsoluteFill>
  );
};
