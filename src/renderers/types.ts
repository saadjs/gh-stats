export interface ThemeEffects {
  glow?: boolean;
  scanlines?: boolean;
  cursorBlink?: boolean;
  heatBloom?: boolean;
  thermalGradient?: boolean;
  heatPulse?: boolean;
  heatLegend?: boolean;
}

export interface Theme {
  name: string;
  palette: string[];
  background: string;
  backgroundSecondary: string;
  headerColor: string;
  labelColor: string;
  footerColor: string;
  borderColor: string;
  barTrackColor: string;
  fontFamily: string;
  fontImport?: string;
  borderRadius: number;
  effects: ThemeEffects;
  headerPrefix?: string;
  footerSeparator?: string;
  headerUppercase?: boolean;
  headerLetterSpacing?: number;
}

export interface SvgOptions {
  width?: number;
  barHeight?: number;
  gap?: number;
  labelWidth?: number;
  theme?: string;
}
