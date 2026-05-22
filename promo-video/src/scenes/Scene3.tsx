import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, Sequence } from "remotion";
import React from "react";

const comingSoon = [
  { emoji: "🚪", title: "Visitor Management", desc: "Know who enters. Digital logs for all.", badge: "Beta Testing" },
  { emoji: "🎾", title: "Facility Booking", desc: "No more PDF forms. Real-time court slots.", badge: "Q2 2026" },
  { emoji: "🗓️", title: "Event Calendar", desc: "Never miss a festival or society meeting.", badge: "Q2 2026" },
  { emoji: "🤝", title: "Recommendations", desc: "Verified local services by your neighbors.", badge: "Coming Soon" },
  { emoji: "🚨", title: "Violation Reporting", desc: "Report parking, noise, or pets anonymously.", badge: "Safety" },
  { emoji: "📋", title: "Meeting Minutes", desc: "Official MoM accessible at your fingertips.", badge: "Transparency" },
  { emoji: "🗳️", title: "Society Elections", desc: "Secure digital voting for Block Reps.", badge: "Q3 2026" },
];

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Typewriter title (0-3s)
  const typewriterFrame = 90;
  const title = "Coming Very Soon...";
  const charsShown = Math.min(title.length, Math.floor(frame / (typewriterFrame / title.length)));

  return (
    <AbsoluteFill style={{ backgroundColor: "var(--cream)", overflow: "hidden" }}>
      {/* Title */}
      <div style={{
        height: 250,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 80,
        fontFamily: "var(--font-serif)",
        color: "var(--jade)",
        zIndex: 10
      }}>
        {title.slice(0, charsShown)}
      </div>

      {/* Feature Screens */}
      {comingSoon.map((feat, i) => {
        const sequenceStart = 90 + (i * 75); // Start after title, each lasts 75 frames (2.5s)
        const sequenceDuration = 75;

        if (frame < sequenceStart || frame >= sequenceStart + sequenceDuration) return null;

        const innerFrame = frame - sequenceStart;
        const entrySpring = spring({ frame: innerFrame, fps, config: { damping: 12 } });
        const opacity = interpolate(innerFrame, [0, 10, 65, 75], [0, 1, 1, 0]);

        return (
          <AbsoluteFill key={i} style={{
            justifyContent: "center",
            alignItems: "center",
            padding: 80,
            opacity,
            zIndex: 5,
          }}>
            {/* Glow Background */}
            <div style={{
              position: "absolute",
              width: 800,
              height: 800,
              background: i % 2 === 0 ? "radial-gradient(circle, var(--jade-glow) 0%, transparent 70%)" : "radial-gradient(circle, var(--gold-bg) 0%, transparent 70%)",
              zIndex: -1
            }} />

            <div style={{ fontSize: 240, marginBottom: 40, transform: `scale(${entrySpring})` }}>
              {feat.emoji}
            </div>

            <div style={{
              backgroundColor: "var(--gold)",
              color: "white",
              padding: "10px 30px",
              borderRadius: 30,
              fontSize: 32,
              fontWeight: "bold",
              marginBottom: 30,
              transform: `translateY(${interpolate(entrySpring, [0, 1], [20, 0])}px)`
            }}>
              {feat.badge}
            </div>

            <h3 style={{
              fontSize: 80,
              fontFamily: "var(--font-serif)",
              color: "var(--jade)",
              textAlign: "center",
              marginBottom: 30,
            }}>
              {feat.title}
            </h3>

            <p style={{
              fontSize: 48,
              color: "var(--muted)",
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: 800
            }}>
              {feat.desc}
            </p>
          </AbsoluteFill>
        );
      })}

      {/* Floating Particles (Simple CSS animation simulation) */}
      {[...Array(10)].map((_, i) => {
        const particleOpacity = interpolate(frame % 300, [0, 150, 300], [0.1, 0.4, 0.1]);
        return (
          <div key={i} style={{
            position: "absolute",
            width: 20 + (i * 5),
            height: 20 + (i * 5),
            backgroundColor: i % 2 === 0 ? "var(--jade)" : "var(--gold)",
            borderRadius: "50%",
            left: `${(i * 13) % 100}%`,
            top: `${(i * 23 + frame * 0.2) % 100}%`,
            opacity: particleOpacity,
            zIndex: 1
          }} />
        );
      })}

      {/* End Card (Final 1s) */}
      {frame >= 615 && (
        <AbsoluteFill style={{
          backgroundColor: "var(--jade)",
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
          textAlign: "center",
          zIndex: 100
        }}>
          <h1 style={{
            color: "var(--cream)",
            fontSize: 90,
            fontFamily: "var(--font-serif)",
            lineHeight: 1.3,
            marginBottom: 60,
          }}>
            Where Telegram ends,<br />
            PSOTS Society begins.
          </h1>

          <div style={{
            color: "var(--gold)",
            fontSize: 60,
            fontWeight: "bold"
          }}>
            society.psots.in
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
