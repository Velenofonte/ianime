const JIKAN_URL = 'https://api.jikan.moe/v4';

interface JikanRelationEntry {
  mal_id: number;
  type: string;
  name: string;
}

interface JikanRelation {
  relation: string;
  entry: JikanRelationEntry[];
}

export async function fetchJikanTvSeasonMalIds(malId: number): Promise<number[]> {
  try {
    const res = await fetch(`${JIKAN_URL}/anime/${malId}/relations`);
    if (!res.ok) return [];
    const json = await res.json();
    const relations: JikanRelation[] = json.data ?? [];
    return relations
      .filter((r) => r.relation === 'Prequel' || r.relation === 'Sequel')
      .flatMap((r) => r.entry.filter((e) => e.type === 'anime').map((e) => e.mal_id));
  } catch {
    return [];
  }
}

export async function fetchJikanBroadcast(malId: number): Promise<{ day: string | null; time: string | null } | undefined> {
  try {
    const res = await fetch(`${JIKAN_URL}/anime/${malId}`);
    if (!res.ok) return undefined;
    const json = await res.json();
    return {
      day: json.data?.broadcast?.day || null,
      time: json.data?.broadcast?.time || null,
    };
  } catch {
    return undefined;
  }
}
