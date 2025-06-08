declare module "vanta/dist/vanta.clouds.min" {
  interface VantaOptions {
    el: string | HTMLElement;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    skyColor?: number;
    cloudColor?: number;
    cloudShadowColor?: number;
    sunColor?: number;
    sunGlareColor?: number;
    sunlightColor?: number;
    speed?: number;
    THREE: any;
  }

  function CLOUDS(options: VantaOptions): { destroy: () => void };
  export default CLOUDS;
}
