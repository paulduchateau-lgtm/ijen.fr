const express = require('express');
const router = express.Router();
const { embed } = require('../services/embeddings');
const { findSimilarProjects, findSimilarExperience } = require('../services/vectordb');
const { streamChat } = require('../services/llm');
const { buildContextFromProjects, buildContextFromExperience, buildMessages } = require('../lib/prompt');
const { pool } = require('../lib/db');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/chat
 * Body: { message: string, conversationId?: string }
 * Returns: SSE stream of text chunks
 */
router.post('/', async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message requis.' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message trop long (2000 caractères max).' });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = uuidv4();
      await pool.query(
        'INSERT INTO conversations (id, channel) VALUES ($1, $2)',
        [convId, 'web']
      );
    }

    // Load conversation history
    const historyRes = await pool.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 12',
      [convId]
    );
    const conversationHistory = historyRes.rows;

    // Save user message
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'user', message.trim()]
    );

    // Generate embedding for the query
    const queryEmbedding = await embed(message);

    // Semantic search — projects + experience
    const [projects, experience] = await Promise.all([
      findSimilarProjects(queryEmbedding, 5, 0.25),
      findSimilarExperience(queryEmbedding, 3, 0.25),
    ]);

    // Build RAG context
    const projectContext = buildContextFromProjects(projects);
    const experienceContext = buildContextFromExperience(experience);
    const systemContext = projectContext + experienceContext;

    // Build messages array
    const messages = buildMessages(systemContext, conversationHistory, message.trim());

    // Stream response via SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Conversation-Id', convId);

    let fullResponse = '';

    for await (const chunk of streamChat(messages)) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    // Send sources info
    const sources = projects.map(p => ({
      code: p.code,
      title: p.title,
      similarity: Math.round(p.similarity * 100),
    }));
    res.write(`data: ${JSON.stringify({ done: true, sources, conversationId: convId })}\n\n`);
    res.end();

    // Save assistant response (async, don't block)
    pool.query(
      'INSERT INTO messages (conversation_id, role, content, sources) VALUES ($1, $2, $3, $4)',
      [convId, 'assistant', fullResponse, JSON.stringify(sources)]
    ).catch(err => console.error('[Chat] Failed to save response:', err.message));

  } catch (err) {
    console.error('[Chat] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur interne. Réessayez.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Erreur de génération.' })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
