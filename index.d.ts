export interface IProcessingOptions {
  soundfont: string;
  output: string;
  instrument: number;
  note: number;
  duration?: number;
  velocity?: number;
  endtick?: number;
  gain?: number;
  reverb?: boolean;
  chorus?: boolean;
  staging?: string;
  channel?: number;
  callback?: string;
  debug?: (any...) => void;
}

declare module "soundfont2mp3" {
  export function processSoundfont(options: IProcessingOptions): Promise<void>;

  export class SoundfontProcessingError extends Error;
}
