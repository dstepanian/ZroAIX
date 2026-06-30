// Hugging Face "trending models" — the closest honest free parallel to ZroCrypto's
// trending coins. Public JSON API, no key required. trendingScore reflects what the
// HF community is engaging with right now (recent likes/downloads momentum).
const URL = 'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=20&full=false';

// A human task label for the raw pipeline_tag, kept short for the trending line.
const TASK_LABEL = {
  'text-generation': 'LLM',
  'text-to-image': 'image',
  'image-text-to-text': 'vision',
  'text-to-video': 'video',
  'text-to-speech': 'TTS',
  'automatic-speech-recognition': 'ASR',
  'image-to-video': 'video',
  'any-to-any': 'multimodal',
};

// Returns [{ id, name, org, task }] for the top trending models.
// Empty array on failure so the digest still goes out.
export const getTrending = async (limit = 3) => {
  try {
    const res = await fetch(URL, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HuggingFace trending ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : [])
      .map((m) => {
        const id = (m.id || m.modelId || '').trim();
        if (!id) return null;
        const [org, name] = id.includes('/') ? id.split('/') : [null, id];
        return { id, name, org, task: TASK_LABEL[m.pipeline_tag] || null };
      })
      .filter(Boolean)
      .slice(0, limit);
  } catch (e) {
    console.error('Trending error:', e.message);
    return [];
  }
};
