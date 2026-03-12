const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate embedding vector for a text string
 * Uses text-embedding-3-small (1536 dims, ~$0.02/M tokens)
 */
async function embed(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

/**
 * Generate embedding for a project entry (concatenates all fields)
 */
async function embedProject(project) {
  const text = [
    project.title,
    project.category,
    project.problem,
    project.solution,
    (project.tags || []).join(', '),
    project.sector_refs,
  ].filter(Boolean).join(' — ');
  return embed(text);
}

/**
 * Generate embedding for an experience entry
 */
async function embedExperience(exp) {
  const text = `${exp.company} ${exp.role} ${exp.period} ${exp.description} ${(exp.tags || []).join(' ')}`;
  return embed(text);
}

module.exports = { embed, embedProject, embedExperience };
