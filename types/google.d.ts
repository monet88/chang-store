/**
 * Type declarations for Google Identity Services OAuth2 API
 *
 * @see https://developers.google.com/identity/oauth2/web/reference/js-reference
 */

declare namespace google.accounts.oauth2 {
  /**
   * Configuration options for initializing a token client
   */
  interface TokenClientConfig {
    /** The client ID for the application from Google Cloud Console */
    client_id: string;

    /** Space-delimited list of OAuth 2.0 scopes to request */
    scope: string;

    /**
     * Callback function called when a token response is received
     * @param response - The token response from Google
     */
    callback: (response: TokenResponse) => void;

    /**
     * Optional callback for handling errors
     * @param error - The error response from Google
     */
    error_callback?: (error: ErrorResponse) => void;

    /** Optional hint for selecting an account */
    hint?: string;

    /** Optional hosted domain for G Suite users */
    hosted_domain?: string;

    /** Optional prompt parameter for consent screen behavior */
    prompt?: '' | 'none' | 'consent' | 'select_account';

    /** Optional state parameter for CSRF protection */
    state?: string;
  }

  /**
   * Token response from Google OAuth2
   */
  interface TokenResponse {
    /** The access token for API requests */
    access_token: string;

    /** Token type (usually "Bearer") */
    token_type: string;

    /** Number of seconds until the token expires */
    expires_in: number;

    /** Space-delimited list of granted scopes */
    scope: string;

    /** Optional error code if the request failed */
    error?: string;

    /** Optional human-readable error description */
    error_description?: string;

    /** Optional error URI for more information */
    error_uri?: string;
  }

  /**
   * Error response from Google OAuth2
   */
  interface ErrorResponse {
    /** Error type identifier */
    type: string;

    /** Error message */
    message: string;
  }

  /**
   * Token client for requesting access tokens
   */
  interface TokenClient {
    /**
     * Requests an access token from Google
     * @param overrideConfig - Optional configuration overrides
     */
    requestAccessToken(overrideConfig?: Partial<TokenClientConfig>): void;
  }

  /**
   * Initializes a new token client for OAuth2 authentication
   * @param config - Configuration options for the token client
   * @returns A token client instance
   */
  function initTokenClient(config: TokenClientConfig): TokenClient;

  /**
   * Revokes the specified access token
   * @param accessToken - The access token to revoke
   * @param done - Optional callback called when revocation is complete
   */
  function revoke(accessToken: string, done?: () => void): void;

  /**
   * Checks if the user has granted the specified scopes
   * @param tokenResponse - The token response object to check
   * @param scope - List of scopes to verify
   * @returns True if all scopes are granted
   */
  function hasGrantedAllScopes(tokenResponse: TokenResponse, ...scope: string[]): boolean;

  /**
   * Checks if the user has granted any of the specified scopes
   * @param tokenResponse - The token response object to check
   * @param scope - List of scopes to verify
   * @returns True if any scope is granted
   */
  function hasGrantedAnyScope(tokenResponse: TokenResponse, ...scope: string[]): boolean;
}

/** Global google namespace */
declare namespace google {
  namespace accounts {
    /** OAuth2 API */
    const oauth2: typeof google.accounts.oauth2;
  }
}
