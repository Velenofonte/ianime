const JIKAN_URL = 'https://api.jikan.moe/v4';

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
