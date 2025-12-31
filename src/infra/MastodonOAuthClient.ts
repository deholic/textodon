import type {
  MastodonRegisteredApp,
  OAuthCallbackParams,
  OAuthClient,
  RegisteredApp
} from "../services/OAuthClient";

const OAUTH_SCOPE = "read write follow";

const normalizeInstanceUrl = (instanceUrl: string): string => instanceUrl.replace(/\/$/, "");

export class MastodonOAuthClient implements OAuthClient {
  async registerApp(instanceUrl: string, redirectUri: string): Promise<MastodonRegisteredApp> {
    const normalized = normalizeInstanceUrl(instanceUrl);
    const body = new URLSearchParams({
      client_name: "Deck",
      redirect_uris: redirectUri,
      scopes: OAUTH_SCOPE
    });
    const response = await fetch(`${normalized}/api/v1/apps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error("앱 등록에 실패했습니다.");
    }

    const data = (await response.json()) as Record<string, unknown>;
    const clientId = String(data.client_id ?? "");
    const clientSecret = String(data.client_secret ?? "");
    if (!clientId || !clientSecret) {
      throw new Error("앱 등록 정보가 올바르지 않습니다.");
    }
    return {
      platform: "mastodon",
      instanceUrl: normalized,
      clientId,
      clientSecret,
      redirectUri,
      scope: OAUTH_SCOPE
    };
  }

  buildAuthorizeUrl(app: RegisteredApp, state: string): string {
    if (app.platform !== "mastodon") {
      throw new Error("마스토돈 OAuth 정보가 필요합니다.");
    }
    const authorizeUrl = new URL(`${app.instanceUrl}/oauth/authorize`);
    authorizeUrl.searchParams.set("client_id", app.clientId);
    authorizeUrl.searchParams.set("redirect_uri", app.redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", app.scope);
    authorizeUrl.searchParams.set("state", state);
    return authorizeUrl.toString();
  }

  async exchangeToken(params: { app: RegisteredApp; callback: OAuthCallbackParams }): Promise<string> {
    if (params.app.platform !== "mastodon") {
      throw new Error("마스토돈 OAuth 정보가 필요합니다.");
    }
    if (!params.callback.code) {
      throw new Error("OAuth 코드를 찾지 못했습니다.");
    }
    const body = new URLSearchParams({
      client_id: params.app.clientId,
      client_secret: params.app.clientSecret,
      redirect_uri: params.app.redirectUri,
      grant_type: "authorization_code",
      code: params.callback.code,
      scope: params.app.scope
    });
    const response = await fetch(`${normalizeInstanceUrl(params.app.instanceUrl)}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error("토큰 교환에 실패했습니다.");
    }

    const data = (await response.json()) as Record<string, unknown>;
    const token = String(data.access_token ?? "");
    if (!token) {
      throw new Error("토큰을 받지 못했습니다.");
    }
    return token;
  }
}
