/**
 * iNaturalist API Utilities for Biodiversity Project
 */

export interface InatObservation {
  id: number;
  uri: string;
  observed_on_details: {
    date: string;
    hour: number;
    minute: number;
  };
  time_observed_at: string;
  place_guess: string;
  location: string; // "lat,lng"
  photos: {
    url: string;
  }[];
  user: {
    login: string;
    name?: string;
  };
  quality_grade: string;
  geoprivacy?: string | null;
  obscured?: boolean | null;
  taxon_geoprivacy?: string | null;
  taxon?: {
    id?: number;
    name?: string;
    threatened?: boolean | null;
  } | null;
  /** Kept as a fallback for any cached/legacy observation payloads. */
  threatened?: boolean | null;
  positional_accuracy?: number | null;
}

export interface FetchObservationsResult {
  observations: InatObservation[];
  totalResults: number;
}

const completeInatFetchCache: Record<string, Promise<InatObservation[]>> = {};

/**
 * Fetch ALL observations for a specific taxon in Hong Kong with filters
 * Filters: Research Grade and Hong Kong. Accuracy and privacy rules are
 * applied by consumers after the complete result set is fetched.
 */
async function fetchAllInatObservationsUncached(
  taxonId: number,
  onProgress?: (current: number, total: number) => void,
  options?: { includeObscured?: boolean }
): Promise<InatObservation[]> {
  const allObservations: InatObservation[] = [];
  let page = 1;
  let totalResults = 0;
  const perPage = 200;

  try {
    // Hong Kong place_id is 6903
    const baseUrl = 'https://api.inaturalist.org/v2/observations';
    const baseParams = new URLSearchParams({
      taxon_id: taxonId.toString(),
      place_id: '7613',
      quality_grade: 'research',
      per_page: perPage.toString(),
      fields: '(id:!t,uri:!t,observed_on_details:(date:!t,hour:!t,minute:!t),time_observed_at:!t,place_guess:!t,location:!t,positional_accuracy:!t,geoprivacy:!t,obscured:!t,taxon_geoprivacy:!t,taxon:(id:!t,name:!t,threatened:!t),photos:(url:!t),user:(login:!t,name:!t),quality_grade:!t)',
      total_results: 'true'
    });
    // Map data should remain limited to public, accurate locations. Temporal
    // trends may include observations whose location is obscured.
    if (!options?.includeObscured) {
      baseParams.set('geoprivacy', 'open');
      baseParams.set('obscuration', 'none');
    }


    while (true) {
      const response = await fetch(`${baseUrl}?${baseParams.toString()}&page=${page}`);

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];
      // v2 API total_results is usually outside results
      totalResults = data.total_results || totalResults;

      allObservations.push(...results);

      console.debug('[iNat fetch] page response', {
        taxonId,
        page,
        pageResults: results.length,
        apiTotalResults: data.total_results,
        accumulatedResults: allObservations.length,
        pageMissingLocation: results.filter((observation: InatObservation) => !observation.location).length,
          pageMissingDate: results.filter((observation: InatObservation) => !observation.observed_on_details?.date).length,
          pageAccuracyOver1km: results.filter((observation: InatObservation) => Number(observation.positional_accuracy) > 1000).length,
          pageThreatened: results.filter((observation: InatObservation) => String(observation.taxon?.threatened ?? observation.threatened).toLowerCase() === 'true').length,
        filters: {
          place_id: baseParams.get('place_id'),
          quality_grade: baseParams.get('quality_grade'),
          geoprivacy: baseParams.get('geoprivacy'),
          obscuration: baseParams.get('obscuration'),
          acc_below_or_equal: baseParams.get('acc_below_or_equal')
        }
      });

      if (onProgress) {
        onProgress(allObservations.length, totalResults);
      }

      // Break if no more results or reached total
      if (results.length < perPage || allObservations.length >= totalResults) {
        break;
      }

      page++;

      // Safety limit to avoid infinite loops
      if (page > 50) break;

      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.debug('[iNat fetch] complete', {
      taxonId,
      fetchedResults: allObservations.length,
      missingLocation: allObservations.filter(observation => !observation.location).length,
      missingDate: allObservations.filter(observation => !observation.observed_on_details?.date).length,
      dates: allObservations.map(observation => observation.observed_on_details?.date || null)
    });

    return allObservations;
  } catch (error) {
    console.error('Error fetching iNaturalist observations:', error);
    return allObservations; // Return what we have so far
  }
}

/**
 * Fetch the complete observation set once per taxon. Consumers decide how to
 * use the data: trends keep all observations, while the map ignores records
 * without usable public coordinates during spatial aggregation.
 */
export function fetchAllInatObservations(
  taxonId: number,
  onProgress?: (current: number, total: number) => void,
  _options?: { includeObscured?: boolean }
): Promise<InatObservation[]> {
  const cacheKey = `${taxonId}|observation-fields-v2`;
  if (!completeInatFetchCache[cacheKey]) {
    completeInatFetchCache[cacheKey] = fetchAllInatObservationsUncached(
      taxonId,
      onProgress,
      { includeObscured: true }
    );
  }
  return completeInatFetchCache[cacheKey];
}
