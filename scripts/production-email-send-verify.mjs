#!/usr/bin/env node

/**
 * Bounded production email send verification.
 *
 * Sends exactly ONE test email via Resend to verify production email capability.
 * Requires explicit flags and confirmation token.
 *
 * Usage:
 *   node scripts/production-email-send-verify.mjs \
 *     --send-one-test-email \
 *     --confirm-send YESHUA_FINANCE_SEND_ONE_TEST_EMAIL
 *
 * Required environment:
 *   RESEND_API_KEY          — Resend provider key (from production runtime)
 *   EMAIL_TEST_RECIPIENT    — single test recipient email address
 *
 * Optional environment:
 *   EMAIL_FROM_ADDRESS      — from address (defaults to configured production address)
 */

const EXPECTED_TOKEN = 'YESHUA_FINANCE_SEND_ONE_TEST_EMAIL';
const DEFAULT_FROM = 'Yeshua Academy Finance <info@yeshua.academy>';
const SAFE_SUBJECT = 'Yeshua Academy Finance — productie e-mail verificatie';
const SAFE_BODY = `
<div style="font-family: sans-serif; padding: 24px;">
  <h2>Productie e-mail verificatie</h2>
  <p>Dit is een begrensde productie-verificatie van de e-mailverzending via Resend.</p>
  <p>Dit bericht bevat geen financiële gegevens, geen ruwe transactierijen, geen eigenaarbestanden, en geen geheimen.</p>
  <p>Verzonden door: Yeshua Academy Finance productie-verificatiescript.</p>
</div>
`;

async function main() {
  const args = process.argv.slice(2);

  // Require explicit flag
  if (!args.includes('--send-one-test-email')) {
    console.error('GEWEIGERD: --send-one-test-email vlag is vereist.');
    process.exit(1);
  }

  // Require confirmation token
  const confirmIdx = args.indexOf('--confirm-send');
  if (confirmIdx === -1 || args[confirmIdx + 1] !== EXPECTED_TOKEN) {
    console.error('GEWEIGERD: --confirm-send YESHUA_FINANCE_SEND_ONE_TEST_EMAIL is vereist.');
    process.exit(1);
  }

  // Validate API key presence (do NOT print it)
  const resendRuntimeValue = process.env.RESEND_API_KEY;
  if (!resendRuntimeValue) {
    console.error('GEWEIGERD: RESEND_API_KEY ontbreekt in runtime-omgeving.');
    process.exit(1);
  }

  // Validate recipient
  const recipient = process.env.EMAIL_TEST_RECIPIENT;
  if (!recipient) {
    console.error('GEWEIGERD: EMAIL_TEST_RECIPIENT ontbreekt in runtime-omgeving.');
    process.exit(1);
  }

  // Refuse multiple recipients
  if (recipient.includes(',') || recipient.includes(';')) {
    console.error('GEWEIGERD: slechts één ontvanger toegestaan (geen komma of puntkomma).');
    process.exit(1);
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())) {
    console.error('GEWEIGERD: ongeldig e-mailadresformaat.');
    process.exit(1);
  }

  const fromAddress = process.env.EMAIL_FROM_ADDRESS || DEFAULT_FROM;

  console.log('--- Productie e-mail verificatie ---');
  console.log('Provider: Resend');
  console.log('Modus: begrensde single-email verificatie');
  console.log('Credentials: NIET afgedrukt');
  console.log('Provider payloads: NIET afgedrukt');
  console.log('Ontvanger: [geconfigureerd in runtime env]');
  console.log('');

  // Dynamic import of Resend
  const { Resend } = await import('resend');
  const resend = new Resend(resendRuntimeValue);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipient.trim()],
      subject: SAFE_SUBJECT,
      html: SAFE_BODY,
    });

    if (error) {
      const sanitizedMsg = String(error.message || 'Onbekende fout')
        .replace(/re_[A-Za-z0-9_]+/g, '[REDACTED]')
        .slice(0, 200);
      console.error(`MISLUKT: provider fout — ${sanitizedMsg}`);
      process.exit(1);
    }

    const shortId = data?.id ? data.id.slice(0, 8) + '...' : 'onbekend';
    console.log('RESULTAAT:');
    console.log('  provider call: uitgevoerd');
    console.log('  e-mails verzonden: 1');
    console.log(`  provider bericht-id (verkort): ${shortId}`);
    console.log('  credentials afgedrukt: NEE');
    console.log('  provider payloads afgedrukt: NEE');
    console.log('');
    console.log('Productie e-mail verificatie GESLAAGD.');
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Onbekende fout';
    const sanitized = msg.replace(/re_[A-Za-z0-9_]+/g, '[REDACTED]').slice(0, 200);
    console.error(`MISLUKT: ${sanitized}`);
    process.exit(1);
  }
}

main();
