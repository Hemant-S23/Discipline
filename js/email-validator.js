// ============================================================
// email-validator.js — Smart validation & disposable email blocker
// ============================================================

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'tempmailo.com',
  '10minutemail.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'yopmail.com',
  'yopmail.net',
  'trashmail.com',
  'trashmail.net',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'throwawaymail.com',
  'fakemailgenerator.com',
  'crazymailing.com',
  'mohmal.com',
  'inboxbear.com',
  'maildrop.cc',
  'generator.email',
  'burnermail.io',
  'dropmail.me',
  'fake.com',
  'test.com',
  'example.com',
  'asdf.com',
  'dummy.com',
  'random.com',
  'sample.com',
  'xyz.com'
]);

const DOMAIN_TYPOS = {
  'gmil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaill.co': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmali.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlk.com': 'outlook.com',
  'outlock.com': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'rediffmial.com': 'rediffmail.com',
  'redifmail.com': 'rediffmail.com'
};

/**
 * Validates whether an email is properly formatted, not a temporary/fake domain,
 * and doesn't contain obvious domain typos.
 * 
 * @param {string} rawEmail 
 * @returns {{ isValid: boolean, error?: string, suggestion?: string, normalizedEmail?: string }}
 */
export function validateEmail(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { isValid: false, error: 'Please enter your email address.' };
  }

  const email = rawEmail.trim().toLowerCase();

  // Basic format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email) || email.includes('..')) {
    return {
      isValid: false,
      error: 'Please enter a valid email address (e.g. name@example.com).'
    };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Invalid email format.' };
  }

  const [localPart, domain] = parts;

  // Local part checks
  if (localPart.length < 1 || localPart.length > 64) {
    return { isValid: false, error: 'Email username must be between 1 and 64 characters.' };
  }

  // Domain typo check
  if (DOMAIN_TYPOS[domain]) {
    const suggestedDomain = DOMAIN_TYPOS[domain];
    const suggestedEmail = `${localPart}@${suggestedDomain}`;
    return {
      isValid: false,
      error: `Did you mean ${suggestedEmail}? Please check your email address.`,
      suggestion: suggestedEmail
    };
  }

  // Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Temporary or disposable email addresses are not allowed. Please use your genuine email.'
    };
  }

  // TLD check (must have at least one dot in domain and valid TLD)
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return {
      isValid: false,
      error: 'Please enter an email with a valid domain extension.'
    };
  }

  return { isValid: true, normalizedEmail: email };
}
