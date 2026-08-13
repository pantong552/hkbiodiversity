import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.checklistbank.org';
const DATASET_KEY = '3LXR';


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

    // 2. Fetch Base Info & Dataset Meta in parallel
    const [classRes, synRes, childRes, infoRes, datasetRes] = await Promise.all([
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}/taxon/${usageId}/classification`),
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}/taxon/${usageId}/synonyms`),
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}/tree/${usageId}/children`),
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}/taxon/${usageId}/info`),
      fetch(`${BASE_URL}/dataset/${DATASET_KEY}`)
    ]);

    const classification = await classRes.json();
    let synonymsData = await synRes.json();
    const childrenData = await childRes.json();
    const infoData = await infoRes.json();
    const datasetData = await datasetRes.json();


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
      const altSynUrl = `${BASE_URL}/dataset/${DATASET_KEY}/nameusage/search?TAXON_ID=${usageId}&STATUS=synonym`;
      const altSynRes = await fetch(altSynUrl);
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


    // 6. Process Subspecies (Children) - Ensure authors are included
    const subspecies: string[] = [];
    const children = Array.isArray(childrenData) ? childrenData : (childrenData.result || []);
    children.forEach((child: any) => {
      if (child.rank === 'subspecies') {
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
      authorship: result.usage.authorship,
      datasetKey: DATASET_KEY,
      datasetTitle: datasetData?.title || 'Catalogue of Life',
      datasetVersion: datasetData?.version || '',
      datasetIssued: datasetData?.issued || ''
    });


  } catch (error: any) {
    console.error('Error fetching taxonomy from COL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
