/**
 * Seed script — populates projects & experience tables with embeddings.
 * Usage: node seed.js
 * Requires: DATABASE_URL, OPENAI_API_KEY in .env
 */
require('dotenv').config();
const { pool } = require('./lib/db');
const { embedProject, embedExperience } = require('./services/embeddings');
const { upsertProject, insertExperience } = require('./services/vectordb');

// ══════════════════════════════════════════════
// 19 CATALOGUE ENTRIES
// ══════════════════════════════════════════════
const projects = [
  {
    code: 'RAG', title: 'Chatbot RAG sur-mesure', category: "Systèmes d'information",
    problem: "Les LLM pré-entraînés ne peuvent pas intégrer les données métier ni les mettre à jour.",
    solution: "RAG (Retrieval Augmented Generation) sur-mesure adapté aux données métier. Mise à jour temps-réel, agents pour requêtes complexes, RAGtime pour évaluation et monitoring.",
    tags: ['RAG', 'LLM', 'Embedding', 'Agent IA', 'Monitoring'],
    sector_refs: "Caisse d'Épargne (analyse avis clients) · Predict4Health (data médicale) · Acteur assurances NDA",
    proto_price: '7.5k€', prod_price: '~40k€',
  },
  {
    code: 'NLP', title: 'Analyse retours clients automatisée', category: 'Automatisation',
    problem: "Les retours clients sont dispersés dans des formats longs, identifier les tendances majeures est manuel et lent.",
    solution: "IA qui parcourt et regroupe automatiquement les retours pour identifier sujets récurrents, KPIs, interface chatbot et rapports mensuels automatiques.",
    tags: ['LLM', 'Data Science', 'BI', 'NLP', 'Clustering'],
    sector_refs: "Caisse d'Épargne (clustering agences) · Servier (patterns ventes) · AGPM/Klésia",
    proto_price: '15k€', prod_price: '~50k€',
  },
  {
    code: 'SQL', title: 'Self-Service BI (NL2SQL)', category: "Systèmes d'information",
    problem: "L'accès aux données est limité à quelques experts. Une simple requête peut prendre plusieurs jours.",
    solution: "Self-Service BI : tous les utilisateurs effectuent des requêtes en langage naturel. Gouvernance stricte par profil, résultats Excel/CSV/texte.",
    tags: ['LLM', 'NL2SQL', 'Data Gov.', 'BI'],
    sector_refs: "CHU Bordeaux (Data Lake) · Caisse d'Épargne · Servier",
    proto_price: '5k€', prod_price: '~25k€',
  },
  {
    code: 'DOC', title: 'Validation & extraction de dossiers', category: 'Automatisation',
    problem: "La vérification manuelle de pièces jointes est coûteuse et source d'erreurs à volume.",
    solution: "Analyse automatique de pièces jointes (PDF, manuscrits). Validation documents d'identité, alertes dossiers incomplets, API intégrable backoffice.",
    tags: ['Doc Understanding', 'OCR', 'LLM', 'API'],
    sector_refs: "Acteur assurances NDA (sinistres) · Predict4Health (bilans médicaux) · Collectivités locales",
    proto_price: '10k€', prod_price: '~95k€',
  },
  {
    code: 'RPT', title: 'Aide à la rédaction de rapports', category: 'Automatisation',
    problem: "Rédiger des rapports conformes aux normes demande une expertise métier pointue et beaucoup de temps.",
    solution: "LLM entraîné sur base de connaissances métier. Rapports conformes, extraction multi-documents, GraphRAG pour corpus complexes.",
    tags: ['LLM', 'GraphRAG', 'Automatisation', 'NLP'],
    sector_refs: "Collectivités locales (PLU) · Secteur public · Ministère de la Santé",
    proto_price: '20k€', prod_price: '>100k€',
  },
  {
    code: 'OCR', title: 'Enrichissement OCR & vision', category: 'Automatisation',
    problem: "Des informations stratégiques sont piégées dans des supports non-structurés : PDF scannés, manuscrits, photos.",
    solution: "Extraction d'informations depuis tout support. Modèle entraîné sur cas d'usage spécifique pour maximiser précision et réduire coûts (<0,05€ / requête).",
    tags: ['OCR', 'Computer Vision', 'LLM'],
    sector_refs: "Predict4Health (bilans médicaux) · Stanford/CHU (données cliniques) · Acteur assurances NDA",
    proto_price: '5k€', prod_price: '10–50k€',
  },
  {
    code: 'IMG', title: 'Détection fraude sinistres (images)', category: 'Automatisation',
    problem: "Les clients uploadent librement des photos lors de déclarations. Vérifier la cohérence avec le sinistre déclaré est impossible manuellement à volume.",
    solution: "Analyse et reconnaissance des éléments photographiques. Évaluation quantitative des dégâts. API intégrable en backoffice. Coûts <0,05€ / requête.",
    tags: ['IA Custom', 'Multimodal', 'Computer Vision', 'API'],
    sector_refs: "Acteur assurances NDA (dossiers habitation) · AGPM/Klésia",
    proto_price: '7.5k€', prod_price: '~40k€',
  },
  {
    code: 'SRC', title: 'Moteur de recherche multimédia', category: "Systèmes d'information",
    problem: "La recherche dans des bases documentaires multimédia est inefficace avec les outils standard.",
    solution: "Recherche sémantique et recommandation sur textes, images, vidéos et documents. Transcription automatique vidéos, API REST.",
    tags: ['Embedding', 'Multimodal', 'Recherche sémantique'],
    sector_refs: "AXA France (showroom IA) · Plateformes médias · Content management",
    proto_price: '10k€', prod_price: '~75k€',
  },
  {
    code: 'BOT', title: 'Chatbot structuré (collecte données)', category: 'RH / Automatisation',
    problem: "Collecter des données structurées via des formulaires crée de la friction et des taux d'abandon élevés.",
    solution: "Chatbot menant une conversation libre tout en collectant silencieusement des données structurées. Parsing CV/contrats intégré.",
    tags: ['LLM', 'Agent IA', 'RH', 'NLP'],
    sector_refs: "AGPM/Klésia (cycle de vie client) · Cabinets conseil · Secteur RH",
    proto_price: '20k€', prod_price: '~40k€',
  },
  {
    code: 'KPI', title: 'Compréhension utilisateur avancée', category: 'Analytics',
    problem: "Les données comportementales textuelles ne sont pas exploitées pour créer des KPIs actionnables.",
    solution: "Classification supervisée/non-supervisée, KPIs catégoriels/numériques, enrichissement données textuelles pour tableaux de bord opérationnels.",
    tags: ['Data Science', 'LLM', 'Clustering', 'Analytics'],
    sector_refs: "AGPM/Klésia (Millicare) · Caisse d'Épargne · Servier",
    proto_price: '5k€', prod_price: '~15k€',
  },
  {
    code: 'CRM', title: 'CRM sur-mesure pour cabinet conseil', category: "Systèmes d'information",
    problem: "Un cabinet conseil gère son activité dans des outils dispersés (Excel, emails), sans vue unifiée pipeline, consultants, missions et facturation.",
    solution: "CRM sur-mesure pensé pour les besoins d'Infinitif : gestion des opportunités, fiches consultants enrichies, matching missions/profils par IA, suivi facturation, alertes proactives et tableau de bord commercial.",
    tags: ['CRM', 'IA Custom', 'Matching', 'Pipeline', 'LLM'],
    sector_refs: "Infinitif (cabinet conseil)",
    proto_price: '8k€', prod_price: '~35k€',
  },
  {
    code: 'INS', title: "Comparateur de documents d'assurance", category: 'Assurance',
    problem: "Les tunnels de souscription assurance sont longs : les prospects abandonnent face à des documents épais et incompréhensibles, sans pouvoir comparer simplement avec leurs contrats en cours.",
    solution: "L'utilisateur uploade ses contrats actuels. L'IA extrait les garanties clés, les compare avec le nouveau produit, et génère un résumé décisionnel structuré en moins de 30 secondes. Réduction mesurée du taux d'abandon.",
    tags: ['Doc Understanding', 'LLM', 'OCR', 'Assurance', 'UX'],
    sector_refs: "Acteur assurances NDA · Mutuelle santé · Prévoyance",
    proto_price: '10k€', prod_price: '~50k€',
  },
  {
    code: 'CRD', title: 'Simulation crédit self-service', category: 'Banque',
    problem: "Les conseillers bancaires gèrent des simulations crédit chronophages. Les outils existants sont rigides et peu personnalisés, générant une forte dépendance au conseiller.",
    solution: "Agent conversationnel de simulation et pré-souscription en self-service. Collecte intelligente des données, scoring préliminaire, génération d'une offre indicative personnalisée, bascule conseiller si besoin.",
    tags: ['Agent IA', 'LLM', 'Banque', 'Self-Service', 'UX'],
    sector_refs: "Caisse d'Épargne · Acteur bancaire NDA · Crédit Mutuel",
    proto_price: '15k€', prod_price: '~80k€',
  },
  {
    code: 'PLG', title: 'Stratégie Product Led Growth banque marque blanche', category: 'Banque / Stratégie',
    problem: "Les banques en marque blanche peinent à convertir et activer leurs utilisateurs finaux. Les funnels sont pensés pour les partenaires B2B, pas pour les usagers.",
    solution: "Stratégie PLG complète : analyse parcours, identification moments d'activation, instrumentation produit, expérimentations A/B, boucles de rétention IA, scoring comportemental personnalisant l'acquisition et la fidélisation.",
    tags: ['Product Strategy', 'PLG', 'Analytics', 'Growth', 'UX'],
    sector_refs: "Acteur bancaire marque blanche NDA · Fintech B2B2C",
    proto_price: '20k€', prod_price: '~120k€',
  },
  {
    code: 'GOV', title: 'Gouvernance data & IA pour TPA', category: 'Data Strategy',
    problem: "Un Tiers Payant Administrateur manipule des données de santé sensibles sans cadre data structuré : SI hétérogènes, pas de catalogue de données, risques RGPD non maîtrisés.",
    solution: "Diagnostic data complet, définition de l'architecture cible, politique de gouvernance (référentiels, ownership, qualité), roadmap IA 12–24 mois et implémentation des premières briques fondamentales.",
    tags: ['Data Strategy', 'Gouvernance', 'RGPD', 'IA', 'Architecture Data'],
    sector_refs: "TPA Santé NDA · Secteur assurance santé · Mutuelles",
    proto_price: '12k€', prod_price: '~60k€',
  },
  {
    code: 'OPT', title: 'Automatisation process équipes gestion', category: 'Automatisation',
    problem: "Les équipes de gestion passent un temps excessif sur des tâches répétitives à faible valeur : saisie, contrôles, relances, reporting — souvent manuels et non tracés.",
    solution: "Cartographie des processus, identification des gains rapides, déploiement de workflows automatisés (RPA + IA), intégration aux outils existants. Gain de productivité documenté et mesuré dès les premières semaines.",
    tags: ['RPA', 'Automatisation', 'Workflow', 'LLM', 'Process'],
    sector_refs: "BeTomorrow · Cabinets de gestion NDA · Opérations",
    proto_price: '8k€', prod_price: '~45k€',
  },
  {
    code: 'CRA', title: 'Génération de CRA en langage naturel', category: 'Automatisation / RH',
    problem: "Les consultants rédigent leurs comptes-rendus d'activité après coup, souvent avec des oublis et une qualité variable, dans des formats imposés peu intuitifs.",
    solution: "Le consultant décrit librement sa semaine à l'oral ou à l'écrit. L'IA structure automatiquement le CRA selon le format imposé, complète les champs obligatoires, calcule les temps, et soumet pour validation en 1 clic.",
    tags: ['LLM', 'NLP', 'Automatisation', 'RH', 'Agent IA'],
    sector_refs: "Infinitif · Cabinet conseil",
    proto_price: '5k€', prod_price: '~20k€',
  },
  {
    code: 'NWL', title: 'Newsletter auto-améliorée par feedback', category: 'Marketing / IA',
    problem: "Les newsletters B2B sont difficiles à personnaliser. Le feedback lecteur n'est pas collecté, encore moins utilisé pour améliorer le contenu suivant.",
    solution: "Pipeline complet : génération du contenu par LLM, distribution, collecte de feedback en langage naturel via bot post-envoi, analyse des retours, réinjection automatique dans le prompt de la prochaine édition. La newsletter s'améliore d'elle-même.",
    tags: ['LLM', 'NLP', 'Marketing IA', 'Feedback Loop', 'Automatisation'],
    sector_refs: "Infinitif · Cabinet conseil NDA · Secteur services",
    proto_price: '7.5k€', prod_price: '~30k€',
  },
  {
    code: 'AO', title: "Facilitation réponse aux appels d'offres", category: 'Automatisation / Conseil',
    problem: "Répondre à un AO mobilise des heures : retrouver les bonnes références, constituer les équipes, rédiger les textes. La qualité est inégale selon les personnes disponibles.",
    solution: "Outil de génération assistée : analyse du CDC, sélection automatique des meilleures références cabinets et profils CV consultants par RAG, génération d'un premier jet complet, cycle de révision collaboratif avec historique.",
    tags: ['RAG', 'LLM', 'Automatisation', 'AO', 'Conseil'],
    sector_refs: "Infinitif · Cabinets conseil",
    proto_price: '10k€', prod_price: '~50k€',
  },
];

// ══════════════════════════════════════════════
// EXPERIENCE ENTRIES
// ══════════════════════════════════════════════
const experience = [
  {
    company: 'Ijen (indépendant)',
    role: 'Consultant IA appliquée & Product Strategy',
    period: 'Janvier 2026 – présent',
    description: "Micro-entreprise de conseil en IA appliquée. Stratégie produit, delivery, architecture data & IA pour grands comptes et scale-ups. ~100 références accumulées.",
    tags: ['IA', 'Product Strategy', 'Consulting', 'Data', 'LLM'],
  },
  {
    company: 'BeTomorrow',
    role: 'Directeur conseil / Head of Data & IA',
    period: 'Octobre 2022 – Janvier 2026',
    description: "Pilotage de ~100 missions data & IA conseil. Clients : AXA France, Caisse d'Épargne, Servier, AGPM/Klésia, CHU Bordeaux, Vinci Energies, Ministère de la Santé, IPSEN. Structuration de l'offre data & IA, recrutement équipe, delivery.",
    tags: ['Data', 'IA', 'Management', 'Conseil', 'LLM', 'NLP', 'Product'],
  },
  {
    company: 'Lucine (DTx / MedTech)',
    role: 'Chief Product Officer',
    period: '2019 – 2022',
    description: "CPO d'une startup MedTech digital therapeutics. Levée de fonds 5,5 M€. Équipe produit ×4. Dispositif médical numérique pour la douleur chronique. Product management, UX research, data science médicale.",
    tags: ['CPO', 'MedTech', 'Startup', 'Product', 'UX', 'Health'],
  },
  {
    company: 'Maincare Solutions',
    role: 'Product Owner / Chef de projet digital',
    period: '2016 – 2019',
    description: "Product Owner logiciels médicaux (EHPAD, cabinets médicaux, hôpitaux). Refonte UX, migration cloud, gestion backlog multi-produit.",
    tags: ['Product Owner', 'Santé', 'SaaS', 'B2B', 'UX'],
  },
  {
    company: 'Predict4Health / Okeiro',
    role: 'Data Product Manager',
    period: '2021 – 2022',
    description: "Données médicales synthétiques et analyse de bilans cliniques. Collaboration Stanford University et CHU. OCR bilans médicaux, pipeline data science.",
    tags: ['Data', 'MedTech', 'OCR', 'Stanford', 'IA'],
  },
];

// ══════════════════════════════════════════════
// SEED RUNNER
// ══════════════════════════════════════════════
async function seed() {
  console.log('[Seed] Starting...');
  console.log(`[Seed] ${projects.length} projects, ${experience.length} experience entries`);

  // Seed projects
  for (const p of projects) {
    try {
      console.log(`[Seed] Embedding project ${p.code}...`);
      const embedding = await embedProject(p);
      await upsertProject(p, embedding);
      console.log(`[Seed] ✓ ${p.code} — ${p.title}`);
    } catch (err) {
      console.error(`[Seed] ✗ ${p.code}:`, err.message);
    }
    // Small delay to avoid rate limits
    await sleep(200);
  }

  // Seed experience
  for (const e of experience) {
    try {
      console.log(`[Seed] Embedding experience ${e.company}...`);
      const embedding = await embedExperience(e);
      await insertExperience(e, embedding);
      console.log(`[Seed] ✓ ${e.company}`);
    } catch (err) {
      console.error(`[Seed] ✗ ${e.company}:`, err.message);
    }
    await sleep(200);
  }

  console.log('[Seed] Done.');
  await pool.end();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

seed().catch(err => {
  console.error('[Seed] Fatal:', err);
  process.exit(1);
});
