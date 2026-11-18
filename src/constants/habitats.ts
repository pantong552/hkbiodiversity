export const HABITAT_TYPES = [
  { id: 'Agricultural_land', name: { zh: '農地', en: 'Agricultural land' }, color: '#c6a43b' },
  { id: 'Artificial_hard_shoreline', name: { zh: '人工硬岸', en: 'Artificial hard shoreline' }, color: '#737d83' },
  { id: 'Artificial_pond', name: { zh: '人工池塘', en: 'Artificial pond' }, color: '#4d9b9b' },
  { id: 'Bare_rock_soil', name: { zh: '裸岩及泥土', en: 'Bare rock and soil' }, color: '#a77c56' },
  { id: 'Grassland', name: { zh: '草地', en: 'Grassland' }, color: '#a4bf4b' },
  { id: 'Green_urban_area', name: { zh: '城市綠地', en: 'Green urban area' }, color: '#27a36a' },
  { id: 'Mangrove', name: { zh: '紅樹林', en: 'Mangrove' }, color: '#176d50' },
  { id: 'Marsh_reed_bed', name: { zh: '沼澤及蘆葦床', en: 'Marsh and reed bed' }, color: '#6faaa0' },
  { id: 'Mixed_barren_land', name: { zh: '混合荒地', en: 'Mixed barren land' }, color: '#c57b54' },
  { id: 'Modified_watercourse', name: { zh: '改造水道', en: 'Modified watercourse' }, color: '#3985b3' },
  { id: 'Natural_rocky_shoreline', name: { zh: '天然岩岸', en: 'Natural rocky shoreline' }, color: '#555b69' },
  { id: 'Natural_watercourse', name: { zh: '天然水道', en: 'Natural watercourse' }, color: '#50b7dd' },
  { id: 'Other_urban_area', name: { zh: '其他市區', en: 'Other urban area' }, color: '#a35da8' },
  { id: 'Reservoirs', name: { zh: '水塘', en: 'Reservoirs' }, color: '#3478c8' },
  { id: 'Rural_plantation', name: { zh: '鄉郊種植林', en: 'Rural plantation' }, color: '#80ad43' },
  { id: 'Seagrass_bed', name: { zh: '海草床', en: 'Seagrass bed' }, color: '#168c75' },
  { id: 'Shrubby_grassland', name: { zh: '灌叢草地', en: 'Shrubby grassland' }, color: '#8fae37' },
  { id: 'Shrubland', name: { zh: '灌木林', en: 'Shrubland' }, color: '#647f42' },
  { id: 'Soft_shore', name: { zh: '軟岸', en: 'Soft shore' }, color: '#df9b65' },
  { id: 'Woodland', name: { zh: '林地', en: 'Woodland' }, color: '#23663e' },
  { id: 'Woody_shrubland', name: { zh: '木本灌叢', en: 'Woody shrubland' }, color: '#486a48' },
] as const;

export type HabitatTypeId = (typeof HABITAT_TYPES)[number]['id'];
export const HABITAT_MIN_ZOOM = 11.5;
