function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTextForMatch(text) {
  const lowered = (text || '').toLowerCase();
  const leetspeak = lowered
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');
  const spaced = leetspeak.replace(/[^a-z0-9]+/g, ' ').trim();
  const compact = spaced.replace(/[^a-z0-9]/g, '');
  return { spaced, compact };
}

function containsTerm(text, term) {
  const { spaced, compact } = normalizeTextForMatch(text);
  const spacedRe = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
  if (spacedRe.test(spaced)) return true;

  // Also match compacted variants for longer terms (avoid false positives like "class" -> "ass")
  if (term.length >= 4) {
    const termCompact = normalizeTextForMatch(term).compact;
    if (termCompact && compact.includes(termCompact)) return true;
  }

  return false;
}

function findMatchingTerm(text, terms) {
  for (const term of terms) {
    if (containsTerm(text, term)) return term;
  }
  return null;
}

function containsMarketplaceProfanity(text) {
  // "Marketplace strict": prohibit all profanity/swear words.
  const terms = [
    // Common profanity
    'fuck',
    'fucking',
    'motherfucker',
    'shit',
    'bitch',
    'ass',
    'asshole',
    'bastard',
    'damn',
    'hell',
    'crap',
    'piss',
    // Slurs
    'retard',
    'nigger',
    'nigga',
    'faggot',
    // Sex terms used as profanity
    'dick',
    'cock',
    'pussy',
    'cunt',
    'slut',
    'whore'
  ];

  return findMatchingTerm(text, terms);
}

function containsMarketplaceSexualContent(text) {
  // "Marketplace strict": prohibit sexual content even if it isn't profanity.
  const terms = [
    'porn',
    'porno',
    'hentai',
    'nsfw',
    'nude',
    'nudes',
    'naked',
    'onlyfans',
    'sex',
    'sexy',
    'sext',
    'sexting',
    'blowjob',
    'handjob',
    'anal',
    'cum',
    'cumming',
    'orgasm',
    'fetish'
  ];

  return findMatchingTerm(text, terms);
}

function getMarketplaceStrictTextRejectionReason({ name, description, systemPrompt } = {}) {
  const input = `${name || ''}\n${description || ''}\n${systemPrompt || ''}`.trim();

  const profanityHit = containsMarketplaceProfanity(input);
  if (profanityHit) return 'Marketplace prohibits profanity';

  const sexualHit = containsMarketplaceSexualContent(input);
  if (sexualHit) return 'Marketplace prohibits sexual content';

  return null;
}

module.exports = {
  normalizeTextForMatch,
  containsMarketplaceProfanity,
  containsMarketplaceSexualContent,
  getMarketplaceStrictTextRejectionReason
};
