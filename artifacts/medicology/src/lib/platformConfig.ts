import { useEffect, useState } from "react";
import { fetchPublicSettings, PublicSettings } from "@/lib/adminSettings";

export interface PlatformConfig {
  general?: PublicSettings["general"];
  branding: PublicSettings["branding"];
  seo: PublicSettings["seo"];
  footer: PublicSettings["footer"];
  maintenance: { enabled: boolean };
}

const EMPTY: PlatformConfig = {
  general: undefined,
  branding: {} as PublicSettings["branding"],
  seo: {} as PublicSettings["seo"],
  footer: {} as PublicSettings["footer"],
  maintenance: { enabled: false },
};

/**
 * Loads the platform-wide public configuration (branding, SEO, footer/social)
 * from the server and applies SEO meta tags to the document.
 *
 * The app should be rebrandable without a rebuild — never hard-code brand
 * values in components when they come from this config.
 */
export function usePlatformConfig(): PlatformConfig {
  const [config, setConfig] = useState<PlatformConfig>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    fetchPublicSettings()
      .then(({ settings, maintenance }) => {
        if (cancelled) return;
        const next: PlatformConfig = {
          general: settings.general,
          branding: settings.branding,
          seo: settings.seo,
          footer: settings.footer,
          maintenance,
        };
        setConfig(next);
        applySeo(next.seo);
      })
      .catch(() => {
        // Public config is best-effort; keep defaults on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}

function setMeta(attr: "name" | "property", key: string, value: string) {
  if (!value) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function applySeo(seo: PublicSettings["seo"]) {
  if (!seo || !seo.siteTitle) return;
  document.title = seo.siteTitle;
  setMeta("name", "description", seo.metaDescription);
  setMeta("name", "keywords", Array.isArray(seo.keywords) ? seo.keywords.join(", ") : seo.keywords);
  setMeta("property", "og:title", seo.ogTitle || seo.siteTitle);
  setMeta("property", "og:description", seo.ogDescription || seo.metaDescription);
  if (seo.ogImage) setMeta("property", "og:image", seo.ogImage);
  setMeta("name", "robots", seo.robots);
  if (seo.canonicalUrl) {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", seo.canonicalUrl);
  }
}
