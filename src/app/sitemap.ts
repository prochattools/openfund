import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const currentUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finance.yeshua.academy';

  return [
    {
      url: currentUrl,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
  ];
}
