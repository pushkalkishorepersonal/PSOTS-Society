import { Series } from "remotion";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene3 } from "./scenes/Scene3";

export const Main: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={360}>
        <Scene1 />
      </Series.Sequence>
      <Series.Sequence durationInFrames={480}>
        <Scene2 />
      </Series.Sequence>
      <Series.Sequence durationInFrames={660}>
        <Scene3 />
      </Series.Sequence>
    </Series>
  );
};
