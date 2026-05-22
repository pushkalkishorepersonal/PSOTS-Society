import "./index.css";
import { Composition } from "remotion";
import { Main } from "./Main";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={Main}
        durationInFrames={1500} // 50 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
