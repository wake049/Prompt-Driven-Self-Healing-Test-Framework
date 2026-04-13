import { useEffect } from 'react';

interface SeoMetadataProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  robots?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
}

const DEFAULT_SITE_NAME = 'FluxTest';
const DEFAULT_IMAGE_PATH = '/og-image.png';
const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://fluxtest.io').replace(/\/$/, '');

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
};

const upsertLink = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
};

export const SeoMetadata: React.FC<SeoMetadataProps> = ({
  title,
  description,
  path = '/',
  image = DEFAULT_IMAGE_PATH,
  robots = 'index,follow',
  structuredData,
}) => {
  useEffect(() => {
    const canonicalUrl = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image.startsWith('/') ? image : `/${image}`}`;
    const fullTitle = title.includes(DEFAULT_SITE_NAME) ? title : `${title} | ${DEFAULT_SITE_NAME}`;

    document.title = fullTitle;
    document.documentElement.lang = 'en';

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: DEFAULT_SITE_NAME });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });

    const existingStructuredData = Array.from(document.head.querySelectorAll('script[data-seo-json-ld="true"]'));
    existingStructuredData.forEach(node => node.remove());

    if (structuredData) {
      const items = Array.isArray(structuredData) ? structuredData : [structuredData];

      items.forEach(item => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo-json-ld', 'true');
        script.text = JSON.stringify(item);
        document.head.appendChild(script);
      });
    }
  }, [description, image, path, robots, structuredData, title]);

  return null;
};

export default SeoMetadata;