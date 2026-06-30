// Hugging Face "trending models" — the closest honest free parallel to ZroCrypto's
// trending coins. Public JSON API, no key required. trendingScore reflects what the
// HF community is engaging with right now (recent likes/downloads momentum).
// We over-fetch and filter so the line stays to real model releases, not the
// hobbyist quant/re-upload churn that often tops the raw trending list.
const URL = 'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=40';

// A human task label for the raw pipeline_tag, kept short for the trending line.
const TASK_LABEL = {
  'text-generation': 'LLM',
  'text-to-image': 'image',
  'image-text-to-text': 'vision',
  'text-to-video': 'video',
  'image-to-video': 'video',
  'text-to-speech': 'TTS',
  'automatic-speech-recognition': 'ASR',
  'any-to-any': 'multimodal',
};

// Re-upload / derivative formats we don't want to surface as "trending" — these are
// community conversions of someone else's model, not their own release.
const NOISE = /\b(GGUF|GPTQ|AWQ|EXL2|EXL3|MLX|bnb|nf4|int4|int8|fp8|[48]bit)\b|-i1-|imatrix|quant/i;

const MIN_LIKES = 5; // a small quality floor; keeps out brand-new empty repos

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
        return { id, name, org, task: TASK_LABEL[m.pipeline_tag] || null, likes: m.likes ?? 0 };
      })
      .filter(Boolean)
      .filter((m) => !NOISE.test(m.id))
      .filter((m) => m.likes >= MIN_LIKES)
      .slice(0, limit)
      .map(({ likes, ...m }) => m); // drop the internal likes field from the output
  } catch (e) {
    console.error('Trending error:', e.message);
    return [];
  }
};
