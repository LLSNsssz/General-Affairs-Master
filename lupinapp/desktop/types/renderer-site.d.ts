declare global {
  type SitePreset = {
    id: string;
    key: string;
    name: string;
    url: string;
    mobileUrl?: string;
    loginUrl?: string;
    mobileLoginUrl?: string;
  };
}

export {};
