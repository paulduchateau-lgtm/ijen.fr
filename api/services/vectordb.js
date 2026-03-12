const { pool } = require('../lib/db');
const { toSql } = require('pgvector/pg');

/**
 * Find top-k projects by cosine similarity
 */
async function findSimilarProjects(embedding, topK = 4, threshold = 0.3) {
  const vectorStr = toSql(embedding);
  const res = await pool.query(`
    SELECT
      id, code, title, category, problem, solution, tags, sector_refs,
      proto_price, prod_price,
      1 - (embedding <=> $1::vector) AS similarity
    FROM projects
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `, [vectorStr, topK]);

  return res.rows.filter(r => r.similarity >= threshold);
}

/**
 * Find top-k experience entries by cosine similarity
 */
async function findSimilarExperience(embedding, topK = 3, threshold = 0.3) {
  const vectorStr = toSql(embedding);
  const res = await pool.query(`
    SELECT
      id, company, role, period, description, tags,
      1 - (embedding <=> $1::vector) AS similarity
    FROM experience
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `, [vectorStr, topK]);

  return res.rows.filter(r => r.similarity >= threshold);
}

/**
 * Insert or update a project with embedding
 */
async function upsertProject(project, embedding) {
  const vectorStr = toSql(embedding);
  await pool.query(`
    INSERT INTO projects (code, title, category, problem, solution, tags, sector_refs, proto_price, prod_price, embedding)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector)
    ON CONFLICT (code) DO UPDATE SET
      title = EXCLUDED.title,
      category = EXCLUDED.category,
      problem = EXCLUDED.problem,
      solution = EXCLUDED.solution,
      tags = EXCLUDED.tags,
      sector_refs = EXCLUDED.sector_refs,
      proto_price = EXCLUDED.proto_price,
      prod_price = EXCLUDED.prod_price,
      embedding = EXCLUDED.embedding,
      updated_at = NOW()
  `, [
    project.code, project.title, project.category,
    project.problem, project.solution, project.tags,
    project.sector_refs, project.proto_price, project.prod_price,
    vectorStr,
  ]);
}

/**
 * Insert an experience entry with embedding
 */
async function insertExperience(exp, embedding) {
  const vectorStr = toSql(embedding);
  await pool.query(`
    INSERT INTO experience (company, role, period, description, tags, embedding)
    VALUES ($1, $2, $3, $4, $5, $6::vector)
  `, [exp.company, exp.role, exp.period, exp.description, exp.tags, vectorStr]);
}

module.exports = {
  findSimilarProjects,
  findSimilarExperience,
  upsertProject,
  insertExperience,
};
