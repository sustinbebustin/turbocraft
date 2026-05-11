// Toggle the public flags below alongside the matching server-side OAuth
// secrets in `.env.local` and on your Convex deployment to expose providers
// in the auth UI.
export const oauthProviders = {
  google: import.meta.env.VITE_OAUTH_GOOGLE === "1",
  github: import.meta.env.VITE_OAUTH_GITHUB === "1",
} as const;

export type OAuthProvider = keyof typeof oauthProviders;

export const hasAnyOAuth = oauthProviders.google || oauthProviders.github;
