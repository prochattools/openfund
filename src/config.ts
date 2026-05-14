import { ConfigProps } from '@/types';

const config: ConfigProps = {
  appName: 'Yeshua Academy Finance',
  appDescription:
    'Interne financiële administratie voor Yeshua Academy: ING-import, categorisatie, controle en rapportage.',
  domainName: 'finance.yeshua.academy',
  colors: {
    theme: 'light',
    main: '#1f5f4a',
  },
  resend: {
    fromAdmin: 'Yeshua Academy Finance <info@yeshua.academy>',
    supportEmail: 'info@yeshua.academy',
    forwardRepliesTo: 'info@yeshua.academy',
    subjects: {
      monthlySummary: 'Financieel maandoverzicht Yeshua Academy',
    },
  },
};

export default config;
