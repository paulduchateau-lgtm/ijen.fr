const express = require('express');
const router = express.Router();
const { embed } = require('../services/embeddings');
const { findSimilarProjects, findSimilarExperience } = require('../services/vectordb');
const { chat } = require('../services/llm');
const { buildContextFromProjects, buildContextFromExperience, buildMessages } = require('../lib/prompt');
const { pool } = require('../lib/db');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/whatsapp — Twilio webhook verification
 */
router.get('/', (req, res) => {
  res.status(200).send('WhatsApp webhook ready.');
});

/**
 * POST /api/whatsapp — Twilio incoming message webhook
 * Twilio sends: Body, From, To, MessageSid, etc.
 */
router.post('/', async (req, res) => {
  try {
    const { Body: message, From: from } = req.body;

    if (!message) {
      return res.status(200).send('<Response></Response>');
    }

    // Normalise phone as user_id
    const userId = from?.replace('whatsapp:', '') || 'unknown';

    // Find or create conversation for this user
    let convRes = await pool.query(
      'SELECT id FROM conversations WHERE channel = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      ['whatsapp', userId]
    );

    let convId;
    if (convRes.rows.length > 0) {
      convId = convRes.rows[0].id;
    } else {
      convId = uuidv4();
      await pool.query(
        'INSERT INTO conversations (id, channel, user_id) VALUES ($1, $2, $3)',
        [convId, 'whatsapp', userId]
      );
    }

    // Load history
    const historyRes = await pool.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 8',
      [convId]
    );

    // Save user message
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'user', message]
    );

    // RAG pipeline
    const queryEmbedding = await embed(message);
    const [projects, experience] = await Promise.all([
      findSimilarProjects(queryEmbedding, 4, 0.25),
      findSimilarExperience(queryEmbedding, 2, 0.25),
    ]);

    const systemContext = buildContextFromProjects(projects) + buildContextFromExperience(experience);
    const messages_arr = buildMessages(systemContext, historyRes.rows, message);

    // Non-streaming response for WhatsApp
    const reply = await chat(messages_arr);

    // Save assistant response
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'assistant', reply]
    );

    // Send TwiML response
    const twiml = `<Response><Message>${escapeXml(reply)}</Message></Response>`;
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(twiml);

  } catch (err) {
    console.error('[WhatsApp] Error:', err.message);
    const twiml = `<Response><Message>Désolé, une erreur est survenue. Réessayez dans un instant.</Message></Response>`;
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(twiml);
  }
});

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
