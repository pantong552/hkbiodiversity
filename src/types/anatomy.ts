export interface AnatomyMarker {
  key: string;
  x: number;
  y: number;
  placement: string;
  zh: string;
  en: string;
}

export interface AnatomyIllustration {
  id: string;
  photoUrl: string;
  photoAttribution: string;
  photoLink: string;
  markers: AnatomyMarker[];
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface AnatomyImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const EMPTY_ANATOMY_ILLUSTRATION: AnatomyIllustration = {
  id: 'illustration-1',
  photoUrl: '',
  photoAttribution: '',
  photoLink: '',
  markers: [],
  zoom: 1,
  offsetX: 0,
  offsetY: 0
};