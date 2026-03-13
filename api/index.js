const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const chatRouter = require('./routes/chat');
const whatsappRouter = require('./routes/whatsapp');
const vizRouter = require('./routes/viz');

const app = express();

// ── CORS ──
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://ijen.fr')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS non autorisé'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: ['X-Conversation-Id'],
}));

// ── Body parsing ──
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Rate limiting ──
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans un instant.' },
});

// ── Routes ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/chat', chatLimiter, chatRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/viz', vizRouter);

// ── Error handler ──
app.use((err, req, res, _next) => {
  console.error('[Server]', err.message);
  res.status(500).json({ error: 'Erreur serveur.' });
});

// ── Start (local dev only, Vercel uses serverless export) ──
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`[Ijen API] Listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
