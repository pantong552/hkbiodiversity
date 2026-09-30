export interface SynonymItem {
  name: string;
  author: string;
}

export interface Species {
  code: string;
  scientificName: string;
  scientificNameAuthor?: string;
  family: {
    scientific: string;
    zh: string;
    en: string;
  };
  genus: {
    scientific: string;
    zh: string;
    en: string;
  };
  synonyms: SynonymItem[];
  firstRecord: string;
  origin: {
    zh: string;
    en: string;
  };
  localStatus: {
    zh: string;
    en: string;
  };
  chinaStatus: {
    zh: string;
    en: string;
  };
  globalStatus: {
    zh: string;
    en: string;
  };
  measurements: {
    headBody: string;
    tail: string;
    ear: string;
    hindFoot: string;
    forearm: string;
    weight: string;
  };
  wingParams: {
    length: string;
    area: string;
    loading: string;
    aspectRatio: string;
    tipIndex: string;
    reference: string;
  };
  imageUrl: string;
  anatomyUrl?: string;
  measurementUrl?: string;
  audioUrl?: string;
  chirovoxUrl?: string;
  zh: {
    commonName: string;
    otherCommonNames: string[];
    taxonomicNotes: string;
    bodySizeType: string;
    features: {
      fur: string;
      ears: string;
      head: string;
      limbs: string;
      tail: string;
      other: string;
    };
    ecology: {
      habitat: string;
      habits: string;
      reproduction: string;
      hibernation: string;
      flight: string;
      foraging: string;
      diet: string;
      lifespan?: string;
      migration?: string;
      homeRange?: string;
      vocalizations?: string;
      dietComposition?: any[];
      roostingPlants?: any[];
      dietFoodLists?: any[];
    };
    distribution: {
      local: string;
      global: { name: string; desc: string }[];
    };
    threats: string;
    references: string[];
  };
  en: {
    commonName: string;
    otherCommonNames: string[];
    taxonomicNotes: string;
    bodySizeType: string;
    features: {
      fur: string;
      ears: string;
      head: string;
      limbs: string;
      tail: string;
      other: string;
    };
    ecology: {
      habitat: string;
      habits: string;
      reproduction: string;
      hibernation: string;
      flight: string;
      foraging: string;
      diet: string;
      lifespan?: string;
      migration?: string;
      homeRange?: string;
      vocalizations?: string;
      dietComposition?: any[];
      roostingPlants?: any[];
      dietFoodLists?: any[];
    };
    distribution: {
      local: string;
      global: { name: string; desc: string }[];
    };
    threats: string;
    references: string[];
  };
  similarSpecies?: SimilarSpeciesItem[];
  echolocations?: EcholocationItem[];
  hotspots?: AnatomyHotspotItem[];
  photos?: Array<{ url: string; credit?: string; originalUrl?: string }>;
}

export interface AnatomyHotspotItem {
  key: string;
  x: number;
  y: number;
  placement: string;
  zh: string;
  en: string;
}

export interface SimilarSpeciesItem {
  code: string;
  scientificName: string;
  imageUrl: string;
  zh: {
    commonName: string;
    features: { title: string; value: string }[];
  };
  en: {
    commonName: string;
    features: { title: string; value: string }[];
  };
}

export interface EcholocationItem {
  id: string;
  callStructure?: string;
  duration?: string;
  interPulseInterval?: string;
  peakFrequency?: string;
  highestFrequency?: string;
  lowestFrequency?: string;
  startFrequency?: string;
  endFrequency?: string;
  zh: {
    location?: string;
    method?: string;
    reference?: string;
    referenceUrl?: string;
  };
  en: {
    location?: string;
    method?: string;
    reference?: string;
    referenceUrl?: string;
  };
}


