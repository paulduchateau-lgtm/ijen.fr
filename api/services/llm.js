const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Stream a chat response from Claude Haiku
 * Returns an async iterator of text chunks
 */
async function* streamChat(messages) {
  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      yield event.delta.text;
    }
  }
}

/**
 * Non-streaming chat for WhatsApp (needs full response)
 */
async function chat(messages) {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: messages,
  });
  return res.content[0]?.text || '';
}

module.exports = { streamChat, chat };
