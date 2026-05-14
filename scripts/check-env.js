const requiredEnvVars = [
  'DATABASE_URL',
  'RESEND_API_KEY'
];

const recommendedEnvVars = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_API_BASE_URL',
  'DEFAULT_USER_ID'
];

const missingRequired = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return value === undefined || value === null || value.trim() === '';
});

const missingRecommended = recommendedEnvVars.filter((key) => {
  const value = process.env[key];
  return value === undefined || value === null || value.trim() === '';
});

if (missingRequired.length > 0) {
  console.error('❌ Ontbrekende verplichte omgevingsvariabelen:', missingRequired.join(', '));
  console.error('Configureer deze variabelen voordat Yeshua Academy Finance wordt gestart.');
  process.exit(1);
}

if (missingRecommended.length > 0) {
  console.warn('⚠️ Aanbevolen omgevingsvariabelen ontbreken:', missingRecommended.join(', '));
}

console.log('✅ Verplichte omgevingsvariabelen zijn aanwezig.');
