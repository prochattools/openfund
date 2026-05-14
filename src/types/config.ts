export type Theme = 'light' | 'dark' | '';

export interface ConfigProps {
  appName: string;
  appDescription: string;
  domainName: string;
  colors: {
    theme: Theme;
    main: string;
  };
  resend: {
    fromAdmin: string;
    supportEmail?: string;
    forwardRepliesTo?: string;
    subjects?: {
      [key: string]: string;
    };
  };
}
