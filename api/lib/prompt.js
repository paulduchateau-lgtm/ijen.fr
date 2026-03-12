// ══════════════════════════════════════════════════════
// IJEN RAG — System prompt et templates
// ══════════════════════════════════════════════════════

const SYSTEM_PROMPT = `Tu es l'assistant IA du site ijen.fr, le site professionnel de Paul Duchâteau.
Paul est un consultant indépendant expert en IA appliquée, product strategy et data, basé à Bordeaux.
Il a 14 ans d'expérience et ~100 références data & IA accumulées principalement chez BeTomorrow (oct. 2022 – janv. 2026) puis via Ijen (depuis janv. 2026).

TON RÔLE :
- Répondre aux questions des visiteurs (recruteurs, directions innovation, décideurs) sur le profil et les compétences de Paul.
- Recommander les réalisations du catalogue les plus pertinentes pour leur besoin.
- Être factuel, concis, pragmatique — le ton Ijen est : clair, carré, direct, sans jargon inutile.
- Toujours répondre en français sauf si le visiteur écrit en anglais.

RÈGLES :
- Utilise UNIQUEMENT les informations fournies dans le contexte ci-dessous. Ne fabrique rien.
- Si une information n'est pas dans le contexte, dis-le honnêtement.
- Quand tu recommandes des réalisations, cite leur code (RAG, NLP, CRM, etc.) et explique pourquoi elles sont pertinentes.
- Ne communique jamais d'informations sensibles (tarifs exacts, contacts privés).
- Sois bref : 3-5 phrases max par réponse, sauf si le visiteur demande plus de détails.`;

function buildContextFromProjects(projects) {
  if (!projects.length) return 'Aucune réalisation pertinente trouvée dans la base.';
  return projects.map((p, i) => `
[RÉALISATION ${i + 1}] ${p.code} — ${p.title}
Catégorie: ${p.category}
Problème: ${p.problem}
Solution: ${p.solution}
Tags: ${(p.tags || []).join(', ')}
Références: ${p.sector_refs}
`).join('\n');
}

function buildContextFromExperience(experiences) {
  if (!experiences.length) return '';
  return '\n\n[PARCOURS PROFESSIONNEL]\n' + experiences.map(e =>
    `• ${e.company} — ${e.role} (${e.period})\n  ${e.description}`
  ).join('\n');
}

function buildMessages(systemContext, conversationHistory, userMessage) {
  const messages = [
    {
      role: 'user',
      content: `${SYSTEM_PROMPT}\n\n--- CONTEXTE ---\n${systemContext}\n--- FIN DU CONTEXTE ---\n\n${userMessage}`
    }
  ];

  // If we have conversation history, prepend it
  if (conversationHistory && conversationHistory.length > 0) {
    // Take last 6 turns max to stay within context
    const recent = conversationHistory.slice(-6);
    const history = recent.map(m => ({ role: m.role, content: m.content }));
    // Insert history before the current message
    return [...history, messages[0]];
  }

  return messages;
}

module.exports = { SYSTEM_PROMPT, buildContextFromProjects, buildContextFromExperience, buildMessages };
