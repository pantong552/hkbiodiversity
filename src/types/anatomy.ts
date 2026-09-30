export interface AnatomyMarker {
  key: string;
  x: number;
  y: number;
  placement: string;
  zh: string;
  en: string;
}

export interface AnatomyIllustration {
  photoUrl: string;
  markers: AnatomyMarker[];
}

export interface AnatomyImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const EMPTY_ANATOMY_ILLUSTRATION: AnatomyIllustration = {
  photoUrl: '',
  markers: []
};