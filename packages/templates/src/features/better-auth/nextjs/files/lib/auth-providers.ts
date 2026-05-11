// Toggle the public flags below alongside the matching server-side OAuth
// secrets in `.env.local` and on your Convex deployment to expose providers
// in the auth UI.
export const oauthProviders = {
  google: process.env.NEXT_PUBLIC_OAUTH_GOOGLE === "1",
  github: process.env.NEXT_PUBLIC_OAUTH_GITHUB === "1",
} as const;

export type OAuthProvider = keyof typeof oauthProviders;

export const hasAnyOAuth = oauthProviders.google || oauthProviders.github;
