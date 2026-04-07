import { Species } from '../types/species';

export const MOCK_SPECIES: Species[] = [
  // Birds (鳥綱)
  {
    id: 1,
    common_name: '黑臉琵鷺',
    scientific_name: 'Platalea minor',
    slug: 'platalea-minor',
    image_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '鳥綱 (Aves)',
    order: '鵜形目 (Pelecaniformes)',
    family: '餗鷺科 (Threskiornithidae)',
    genus: '琵鷺屬 (Platalea)',
    rarity: '瀕危',
    conservation_status: '受保護 (Protected)'
  },
  {
    id: 2,
    common_name: '小白鷺',
    scientific_name: 'Egretta garzetta',
    slug: 'egretta-garzetta',
    image_url: 'https://images.unsplash.com/photo-1444464666168-49d633b86747?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '鳥綱 (Aves)',
    order: '鵜形目 (Pelecaniformes)',
    family: '鷺科 (Ardeidae)',
    genus: '白鷺屬 (Egretta)',
    rarity: '常見',
    conservation_status: '無危 (LC)'
  },
  {
    id: 3,
    common_name: '普通翠鳥',
    scientific_name: 'Alcedo atthis',
    slug: 'alcedo-atthis',
    image_url: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '鳥綱 (Aves)',
    order: '佛法僧目 (Coraciiformes)',
    family: '翠鳥科 (Alcedinidae)',
    genus: '翠鳥屬 (Alcedo)',
    rarity: '常見',
    conservation_status: '無危 (LC)'
  },
  {
    id: 4,
    common_name: '紅嘴巨鷗',
    scientific_name: 'Hydroprogne caspia',
    slug: 'hydroprogne-caspia',
    image_url: 'https://images.unsplash.com/photo-1516233501032-2475d33c56a8?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '鳥綱 (Aves)',
    order: '鴴形目 (Charadriiformes)',
    family: '鷗科 (Laridae)',
    genus: '巨鷗屬 (Hydroprogne)',
    rarity: '易危',
    conservation_status: '受保護 (Protected)'
  },
  // Mammals (哺乳綱)
  {
    id: 5,
    common_name: '豹貓',
    scientific_name: 'Prionailurus bengalensis',
    slug: 'prionailurus-bengalensis',
    image_url: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '哺乳綱 (Mammalia)',
    order: '食肉目 (Carnivora)',
    family: '貓科 (Felidae)',
    genus: '豹貓屬 (Prionailurus)',
    rarity: '易危',
    conservation_status: '受保護 (Protected)'
  },
  {
    id: 6,
    common_name: '中華白海豚',
    scientific_name: 'Sousa chinensis',
    slug: 'sousa-chinensis',
    image_url: 'https://images.unsplash.com/photo-1572074360982-f7efdf768524?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '哺乳綱 (Mammalia)',
    order: '偶蹄目 (Artiodactyla)',
    family: '海豚科 (Delphinidae)',
    genus: '白海豚屬 (Sousa)',
    rarity: '易危',
    conservation_status: '易危 (VU)'
  },
  {
    id: 7,
    common_name: '獼猴',
    scientific_name: 'Macaca mulatta',
    slug: 'macaca-mulatta',
    image_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '哺乳綱 (Mammalia)',
    order: '靈長目 (Primates)',
    family: '猴科 (Cercopithecidae)',
    genus: '獼猴屬 (Macaca)',
    rarity: '常見',
    conservation_status: '無危 (LC)'
  },
  {
    id: 8,
    common_name: '野豬',
    scientific_name: 'Sus scrofa',
    slug: 'sus-scrofa',
    image_url: 'https://images.unsplash.com/photo-1582298538104-fe2e74c27f59?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '哺乳綱 (Mammalia)',
    order: '偶蹄目 (Artiodactyla)',
    family: '豬科 (Suidae)',
    genus: '豬屬 (Sus)',
    rarity: '常見',
    conservation_status: '無危 (LC)'
  },
  // Amphibians (兩棲綱)
  {
    id: 9,
    common_name: '盧氏小樹蛙',
    scientific_name: 'Liuixalus romeri',
    slug: 'liuixalus-romeri',
    image_url: 'https://images.unsplash.com/photo-1580975618526-7a70a8d6e32d?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '兩棲綱 (Amphibia)',
    order: '無尾目 (Anura)',
    family: '樹蛙科 (Rhacophoridae)',
    genus: '小樹蛙屬 (Liuixalus)',
    rarity: '極危',
    conservation_status: '瀕危 (EN)'
  },
  {
    id: 10,
    common_name: '香港瘰螈',
    scientific_name: 'Paramesotriton hongkongensis',
    slug: 'paramesotriton-hongkongensis',
    image_url: 'https://images.unsplash.com/photo-1620601344400-da0fc08eb5ab?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '兩棲綱 (Amphibia)',
    order: '有尾目 (Caudata)',
    family: '蠑螈科 (Salamandridae)',
    genus: '瘰螈屬 (Paramesotriton)',
    rarity: '近危',
    conservation_status: '受保護 (Protected)'
  },
  // Reptiles (爬行綱)
  {
    id: 11,
    common_name: '綠海龜',
    scientific_name: 'Chelonia mydas',
    slug: 'chelonia-mydas',
    image_url: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '爬行綱 (Reptilia)',
    order: '龜鱉目 (Testudines)',
    family: '海龜科 (Cheloniidae)',
    genus: '海龜屬 (Chelonia)',
    rarity: '瀕危',
    conservation_status: '瀕危 (EN)'
  },
  {
    id: 12,
    common_name: '緬甸蟒',
    scientific_name: 'Python bivittatus',
    slug: 'python-bivittatus',
    image_url: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '脊索動物門 (Chordata)',
    class: '爬行綱 (Reptilia)',
    order: '有鱗目 (Squamata)',
    family: '蟒科 (Pythonidae)',
    genus: '蟒屬 (Python)',
    rarity: '常見',
    conservation_status: '易危 (VU)'
  },
  // Insects (昆蟲綱)
  {
    id: 13,
    common_name: '金斑蝶',
    scientific_name: 'Danaus chrysippus',
    slug: 'danaus-chrysippus',
    image_url: 'https://images.unsplash.com/photo-1506102383123-c8ef1e872756?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '節肢動物門 (Arthropoda)',
    class: '昆蟲綱 (Insecta)',
    order: '鱗翅目 (Lepidoptera)',
    family: '蛺蝶科 (Nymphalidae)',
    genus: '斑蝶屬 (Danaus)',
    rarity: '常見',
    conservation_status: '無危 (LC)'
  },
  {
    id: 14,
    common_name: '鳳蝶',
    scientific_name: 'Papilio polytes',
    slug: 'papilio-polytes',
    image_url: 'https://images.unsplash.com/photo-1490237014491-822aee911b99?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '動物界 (Animalia)',
    phylum: '節肢動物門 (Arthropoda)',
    class: '昆蟲綱 (Insecta)',
    order: '鱗翅目 (Lepidoptera)',
    family: '鳳蝶科 (Papilionidae)',
    genus: '鳳蝶屬 (Papilio)',
    rarity: '常見',
    conservation_status: '無危 (LC)'
  },
  // Plants (植物界)
  {
    id: 15,
    common_name: '洋紫荊',
    scientific_name: 'Bauhinia × blakeana',
    slug: 'bauhinia-blakeana',
    image_url: 'https://images.unsplash.com/photo-1584824486516-0555a07fc511?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '植物界 (Plantae)',
    phylum: '被子植物門 (Angiosperms)',
    class: '雙子葉植物綱 (Eudicots)',
    order: '豆目 (Fabales)',
    family: '豆科 (Fabaceae)',
    genus: '羊蹄甲屬 (Bauhinia)',
    rarity: '常見',
    conservation_status: '特有種 (Endemic)'
  },
  {
    id: 16,
    common_name: '土沉香',
    scientific_name: 'Aquilaria sinensis',
    slug: 'aquilaria-sinensis',
    image_url: 'https://images.unsplash.com/photo-1596716810276-f3f972ef3e41?auto=format&fit=crop&q=80&w=600&h=450',
    kingdom: '植物界 (Plantae)',
    phylum: '被子植物門 (Angiosperms)',
    class: '雙子葉植物綱 (Eudicots)',
    order: '錦葵目 (Malvales)',
    family: '瑞香科 (Thymelaeaceae)',
    genus: '沉香屬 (Aquilaria)',
    rarity: '易危',
    conservation_status: '易危 (VU)'
  }
];

// Dynamically generate the remaining 44 to reach 60 for testing
for (let i = 17; i <= 60; i++) {
  const isBird = i % 4 === 0;
  const isMammal = i % 4 === 1;
  const isInsect = i % 4 === 2;
  const isPlant = i % 4 === 3;

  MOCK_SPECIES.push({
    id: i,
    common_name: `測合物種 ${i}`,
    scientific_name: `Species testus var. ${i}`,
    slug: `test-species-${i}`,
    image_url: `https://picsum.photos/seed/species${i}/600/450`,
    kingdom: isPlant ? '植物界 (Plantae)' : '動物界 (Animalia)',
    phylum: isPlant ? '被子植物門 (Angiosperms)' : (isInsect ? '節肢動物門 (Arthropoda)' : '脊索動物門 (Chordata)'),
    class: isBird ? '鳥綱 (Aves)' : isMammal ? '哺乳綱 (Mammalia)' : isInsect ? '昆蟲綱 (Insecta)' : '爬行綱 (Reptilia)',
    order: '測試目',
    family: '測試科',
    genus: '測試屬',
    rarity: i % 5 === 0 ? '極危' : i % 3 === 0 ? '易危' : '常見',
    conservation_status: '測試狀態'
  });
}
