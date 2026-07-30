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
}

export interface FetchObservationsResult {
  observations: InatObservation[];
  totalResults: number;
}

/**
 * Fetch ALL observations for a specific taxon in Hong Kong with filters
 * Filters: Research Grade, Open Location, Accuracy <= 1km
 */
export async function fetchAllInatObservations(
  taxonId: number,
  onProgress?: (current: number, total: number) => void
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
      geoprivacy: 'open',
      threatened: 'false',
      obscuration: 'none',
      acc_below_or_equal: '1000',
      per_page: perPage.toString(),
      fields: '(id:!t,uri:!t,observed_on_details:(date:!t,hour:!t,minute:!t),time_observed_at:!t,place_guess:!t,location:!t,photos:(url:!t),user:(login:!t,name:!t),quality_grade:!t)',
      total_results: 'true'
    });


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

    return allObservations;
  } catch (error) {
    console.error('Error fetching iNaturalist observations:', error);
    return allObservations; // Return what we have so far
  }
}
