require('dotenv').config();

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-lite'; // 512 dims, fast & cheap

/**
 * Generate embedding vector for a single text string
 */
async function embed(text) {
  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: [text] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call
 * Returns array of embedding vectors in the same order as input
 */
async function embedBatch(texts) {
  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  // Sort by index to ensure correct ordering
  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

/**
 * Build text representation for a project entry
 */
function projectToText(project) {
  return [
    project.title,
    project.category,
    project.problem,
    project.solution,
    (project.tags || []).join(', '),
    project.sector_refs,
  ].filter(Boolean).join(' — ');
}

/**
 * Build text representation for an experience entry
 */
function experienceToText(exp) {
  return `${exp.company} ${exp.role} ${exp.period} ${exp.description} ${(exp.tags || []).join(' ')}`;
}

module.exports = { embed, embedBatch, projectToText, experienceToText };
