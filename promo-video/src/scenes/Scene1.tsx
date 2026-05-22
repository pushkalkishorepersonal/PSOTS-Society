import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import React from "react";

const messages = [
  { sender: "Priya", text: "Need a plumber for Tower 5" },
  { sender: "Ravi", text: "Maid available from Monday" },
  { sender: "Sunita", text: "Property tax deadline today!" },
  { sender: "Ajay", text: "Lost my keys near gate 1" },
  { sender: "Meera", text: "Looking for tennis partner" },
  { sender: "Kiran", text: "Power cut in Tower 14?" },
  { sender: "Vikram", text: "Anyone selling an old fridge?" },
  { sender: "Anjali", text: "Water tanker status?" },
  { sender: "Rahul", text: "Great plumber here: 98450XXXXX", highlight: true },
  { sender: "Deepa", text: "Car blocking my slot" },
  { sender: "Suresh", text: "Found a pet collar" },
  { sender: "Neha", text: "Yoga classes starting soon" },
  { sender: "Arun", text: "Electrician recommendation?" },
  { sender: "Pooja", text: "Who is the admin for Block A?" },
  { sender: "Sanjay", text: "Lift not working in Tower 8" },
  { sender: "Kavita", text: "Gym is too crowded" },
  { sender: "Sameer", text: "Anyone for carpooling to ORR?" },
  { sender: "Tanvi", text: "Best internet provider?" },
  { sender: "Amit", text: "Found a set of keys" },
  { sender: "Ritu", text: "Tennis court booking rules?" },
  { sender: "Vijay", text: "Anyone going to airport tonight?" },
  { sender: "Shweta", text: "Maid for cooking needed" },
  { sender: "Manoj", text: "STP smell near Tower 3" },
  { sender: "Priyanka", text: "Found a toddler shoe" },
];

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  // Act 1: Chat flood (0-6s)
  const chatProgress = interpolate(frame, [0, 180], [0, messages.length], {
    extrapolateRight: "clamp",
  });

  const visibleMessages = messages.slice(0, Math.floor(chatProgress));

  // Act 2: Highlights message (6-8s)
  const highlightFrame = 180;
  const highlightOpacity = interpolate(frame, [highlightFrame, highlightFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Act 3: "Gone in 2 hours..." (8-10s)
  const text1Opacity = interpolate(frame, [240, 255, 300, 315], [0, 1, 1, 0]);
  const text1TranslateY = interpolate(frame, [240, 255], [20, 0]);

  // Act 4: "What if it never got lost?" (10-12s)
  const text2Opacity = interpolate(frame, [315, 330, 360], [0, 1, 1]);
  const text2Scale = spring({
    frame: frame - 315,
    fps,
    config: { damping: 12 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#e5e5e5" }}>
      {/* Telegram Header */}
      <div style={{
        height: 140,
        backgroundColor: "var(--telegram)",
        display: "flex",
        alignItems: "center",
        padding: "0 40px",
        color: "white",
        fontSize: 48,
        fontWeight: "bold",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        zIndex: 10
      }}>
        PSOTS Owners Group
      </div>

      {/* Message Area */}
      <div style={{
        flex: 1,
        padding: "20px 40px",
        display: "flex",
        flexDirection: "column-reverse",
        overflow: "hidden"
      }}>
        {visibleMessages.map((msg, i) => {
          const isHighlighted = msg.highlight && frame > 200 && frame < 280;
          return (
            <div key={i} style={{
              backgroundColor: isHighlighted ? "#fff9c4" : "white",
              padding: "20px 30px",
              borderRadius: 30,
              marginBottom: 20,
              maxWidth: "85%",
              alignSelf: "flex-start",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              border: isHighlighted ? "4px solid var(--gold)" : "none",
              transform: `scale(${isHighlighted ? 1.05 : 1})`,
              transition: "all 0.3s ease",
            }}>
              <div style={{ color: "var(--telegram)", fontWeight: "bold", fontSize: 32, marginBottom: 5 }}>
                {msg.sender}
              </div>
              <div style={{ fontSize: 36, color: "#333" }}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Narrative Overlays */}
      {frame > 240 && frame < 315 && (
        <AbsoluteFill style={{
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "white",
          textAlign: "center",
          padding: 60,
          opacity: text1Opacity,
          zIndex: 20,
        }}>
          <h1 style={{
            fontSize: 80,
            fontFamily: "var(--font-serif)",
            lineHeight: 1.2,
            transform: `translateY(${text1TranslateY}px)`,
          }}>
            Gone in 2 hours.<br />
            Forgotten in 2 days.
          </h1>
        </AbsoluteFill>
      )}

      {frame >= 315 && (
        <AbsoluteFill style={{
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "var(--jade)",
          color: "var(--cream)",
          textAlign: "center",
          padding: 60,
          zIndex: 30,
        }}>
          <h1 style={{
            fontSize: 90,
            fontFamily: "var(--font-serif)",
            lineHeight: 1.3,
            transform: `scale(${text2Scale})`,
          }}>
            What if it<br />
            never got lost?
          </h1>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
