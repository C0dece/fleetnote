/**
 * OAuth 2.0 PKCE для Google Drive без client_secret.
 * На ПК используется loopback-редирект, на мобильных — deep link схемы приложения.
 */
/**
 * Ключи, вшитые в сборку. Для установленных приложений Google не считает
 * client secret секретом: он лежит внутри бинарника, как у rclone и ему подобных.
 * Если ключей нет, приложение попросит пользователя создать свои.
 */
export const BUILT_IN_CLIENT = {
  id: (import.meta.env.VITE_GDRIVE_CLIENT_ID ?? "").trim(),
  secret: (import.meta.env.VITE_GDRIVE_CLIENT_SECRET ?? "").trim(),
};

export function hasBuiltInClient(): boolean {
  return BUILT_IN_CLIENT.id.length > 0;
}

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createPkcePair(): Promise<PkcePair> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64Url(random);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  scope?: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scope ?? DRIVE_SCOPE,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  return `${AUTH_ENDPOINT}?${query.toString()}`;
}

export async function exchangeCode(params: {
  clientId: string;
  redirectUri: string;
  code: string;
  verifier: string;
  clientSecret?: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.verifier,
  });
  if (params.clientSecret) body.set("client_secret", params.clientSecret);
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Google OAuth: ${response.status} ${await response.text()}`);
  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export async function refreshToken(params: {
  clientId: string;
  refreshToken: string;
  clientSecret?: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
  if (params.clientSecret) body.set("client_secret", params.clientSecret);
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Google OAuth refresh: ${response.status}`);
  const json = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    refreshToken: params.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}
