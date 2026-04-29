import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.checklistbank.org';
const DATASET_KEY = '3LR';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Scientific name is required' }, { status: 400 });
  }

  try {
    // 1. Search for Usage ID
    const searchRes = await fetch(`${BASE_URL}/dataset/${DATASET_KEY}/nameusage/search?q=${encodeURIComponent(name)}`);
    const searchData = await searchRes.json();
    const result = searchData.result?.[0];

    if (!result) {
      return NextResponse.json({ error: 'Species not found' }, { status: 404 });
    }

    const usageId = result.usage.id;

    // 2. Fetch Base Info in parallel
    const [classRes, synRes, childRes, infoRes] = await Promise.all([
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}/taxon/${usageId}/classification`),
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}/taxon/${usageId}/synonyms`),
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}/tree/${usageId}/children`),
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}/taxon/${usageId}/info`)
    ]);

    const classification = await classRes.json();
    let synonymsData = await synRes.json();
    const childrenData = await childRes.json();
    const infoData = await infoRes.json();

    const synonyms: string[] = [];
    
    // 3. Process Synonyms from /synonyms endpoint
    const categories = ['heterotypic', 'homotypic', 'misapplied'];
    categories.forEach(cat => {
      const items = synonymsData[cat] || [];
      items.forEach((item: any) => {
        if (item.label) {
          synonyms.push(item.label);
        } else {
          const nameObj = item.usage?.name || item.name;
          if (nameObj) {
            synonyms.push(`${nameObj.scientificName} ${nameObj.authorship || ''}`.trim());
          }
        }
      });
    });

    // 4. If synonyms list is still empty, try searching for usages pointing to this taxon
    if (synonyms.length === 0) {
      const altSynRes = await fetch(`${BASE_URL}/dataset/${DATASET_KEY}/nameusage/search?TAXON_ID=${usageId}&STATUS=synonym`);
      if (altSynRes.ok) {
        const altSynData = await altSynRes.json();
        const altItems = altSynData.result || [];
        altItems.forEach((item: any) => {
          if (item.usage?.label) {
            synonyms.push(item.usage.label);
          } else if (item.label) {
            synonyms.push(item.label);
          }
        });
      }
    }

    // 5. Explicitly look for Basionym in infoData relations
    if (infoData.nameRelations) {
      for (const rel of infoData.nameRelations) {
        if (rel.type === 'basionym') {
          // Basionym found in relations, add to list if not already there
          // Often we need to fetch the name usage of the related name to get the label
          // But as a fallback, we check if the label is provided in the relation (rare)
          // For now, most basionyms will appear in synonyms if listed by the dataset
        }
      }
    }

    // 6. Process Subspecies (Children) - Ensure authors are included
    const subspecies: string[] = [];
    const children = Array.isArray(childrenData) ? childrenData : (childrenData.result || []);
    children.forEach((child: any) => {
      if (child.rank === 'subspecies') {
        // Child object in /tree/children usually has scientificName and authorship at top level or in labelHtml
        let subLabel = child.label;
        if (!subLabel || !subLabel.includes(' ')) {
          const sName = child.name?.scientificName || child.name || '';
          const auth = child.authorship || child.name?.authorship || '';
          subLabel = `${sName} ${auth}`.trim();
        }
        if (subLabel) subspecies.push(subLabel);
      }
    });

    // Final deduplication and cleaning
    const currentFullName = `${result.usage.name} ${result.usage.authorship}`.trim();
    const cleanSynonyms = Array.from(new Set(synonyms))
      .filter(s => s && s !== result.usage.label && s !== currentFullName);

    return NextResponse.json({
      usageId,
      classification,
      synonyms: cleanSynonyms,
      subspecies: Array.from(new Set(subspecies)),
      scientificName: result.usage.name,
      authorship: result.usage.authorship
    });

  } catch (error: any) {
    console.error('Error fetching taxonomy from COL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
