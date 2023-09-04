import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { URLSearchParams } from "url";
import { OAuth2Options } from "../types";
import { Scopes, UserInfo, ConnectionType, Guild } from "../types";
import getType from "../util/getType";
import { snowflake } from "../global";
import { GuildJoinOptions } from "../types/Authorize";
import {
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  RateLimitedError,
  InvalidAccessTokenError,
  DiscordAPIError,
} from "../errors";

/**
 * Represents an instance of Discord OAuth2 authorization flow.
 */
class DiscordAuthorization {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken: string | null = null;
  private baseURL = "https://discord.com/api/v10";
  private refreshToken: string | null = null;
  private clientToken: string | null = null;

  /**
   * Creates an instance of DiscordAuthorization.
   * @param {OAuth2Options} options - Options for OAuth2 authorization.
   */
  constructor(options: OAuth2Options) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    this.clientToken = options.clientToken ?? null;
  }

  /**
   * Makes a request to the Discord API.
   * @private
   * @param {string} method - HTTP method.
   * @param {string} endpoint - API endpoint.
   * @param {AxiosRequestConfig} options - Request configuration options.
   * @returns {Promise<AxiosResponse>} - Response from the API.
   * @throws {Error} - If the request fails.
   */
  private async request(
    method: string,
    endpoint: string,
    options: AxiosRequestConfig = {}
  ): Promise<AxiosResponse> {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${this.accessToken}`,
    };

    const requestOptions: AxiosRequestConfig = {
      ...options,
      method,
      url: `${this.baseURL}${endpoint}`,
      headers,
    };

    if (method === "GET" && options.params) {
      requestOptions.params = options.params;
    } else if (["PUT", "POST", "PATCH"].includes(method)) {
      // For PUT, POST, and PATCH methods, pass the request data
      requestOptions.data = options.data;
    }

    const errorMessages: Record<number, string> = {
      200: "Success",
      300: "Multiple Choices",
      400: "Bad request",
      401: "Access token must be valid.",
      429: "Request limit reached. Try again later.",
      500: "Discord API Server Error",
      404: "Not found.",
      403: "You are not authorized to perform this action.",
    };

    try {
      const response = await axios.request(requestOptions);

      return response.data;
    } catch (error: any) {
      const errorMessage =
        errorMessages[error?.response.status] ||
        `Status ${error?.response.status} is not handled yet.`;

      if (error?.response.data && error?.response.data.message) {
        switch (error?.response.status) {
          case 401:
            throw new InvalidAccessTokenError(
              `${errorMessage}`,
              JSON.stringify(error?.response.data)
            );
          case 404:
            throw new NotFoundError(
              `${errorMessage}`,
              JSON.stringify(error?.response.data)
            );
          case 400:
            throw new BadRequestError(
              `${errorMessage}`,
              JSON.stringify(error?.response.data)
            );
          case 429:
            throw new RateLimitedError(
              `${errorMessage}`,
              JSON.stringify(error?.response.data)
            );
          case 500:
            throw new DiscordAPIError(
              `${errorMessage}`,
              JSON.stringify(error?.response.data)
            );
          case 403:
            throw new UnauthorizedError(
              `${errorMessage}`,
              JSON.stringify(error?.response.data)
            );

          default:
            throw new Error(
              `${errorMessage} Response Data: ${JSON.stringify(
                error?.response.data
              )}`
            );
        }
      } else {
        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Generates an OAuth2 authorization link for Discord.
   * @param {{ scopes: Scopes[] }} param0 - Authorization scopes array.
   * @param {string} [state="1bac472"] - Authorization state
   * @returns {string} - OAuth2 authorization link.
   */
  public generateOauth2Link(
    { scopes }: { scopes: Scopes[] },
    state: string = "1bac472"
  ): string {
    if (getType(state) !== "string") {
      throw new TypeError(
        `Expected type of state to be a 'string' but got ${getType(
          state
        )} instead.`
      );
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      state: state,
      scope: scopes.join(" "),
    });

    return `https://discord.com/oauth2/authorize?${params}`;
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   * @param {string} code - Authorization code.
   * @returns {Promise<object>} - Tokens object containing access and refresh tokens.
   * @throws {Error} - If the exchange process fails.
   */
  public async exchangeCodeForTokens(
    code: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (getType(code) !== "string") {
      throw new TypeError(
        `Expected type of code to exchange to be 'string' but got ${getType(
          code
        )}`
      );
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
    });

    const response = await this.request("POST", `/oauth2/token`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: params.toString(),
    });

    return {
      accessToken: response?.data.access_token,
      refreshToken: response?.data.refresh_token,
    };
  }

  /**
   * Sets the access token.
   * @param {string} token - The access token to set.
   */
  public setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Sets the refresh token.
   * @param {string} token - The refresh token to set.
   */
  public setRevokeToken(token: string): void {
    this.refreshToken = token;
  }

  /**
   * Revokes the existinga ccess token
   */
  async revokeToken(): Promise<void> {
    if (!this.accessToken || !this.refreshToken) {
      throw new Error(
        "Access token and refresh token are required to revoke the token."
      );
    }

    const params = new URLSearchParams();
    params.append("client_id", this.clientId);
    params.append("client_secret", this.clientSecret);
    params.append("token", this.refreshToken);

    const config: AxiosRequestConfig = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    await axios.post(
      "https://discord.com/api/oauth2/token/revoke",
      params.toString(),
      config
    );
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Retrieves information about the authorized user.
   * @returns {Promise<UserInfo>} - User information.
   * @throws {Error} - If fetching user information fails.
   * @deprecated
   */
  public async getUserInfo(): Promise<UserInfo> {
    const response = await this.request("GET", "/users/@me");
    return response?.data;
  }

  /**
   * Retrieves information about the authorized user.
   * @returns {Promise<UserInfo>} - User information.
   * @throws {Error} - If fetching user information fails.
   */
  public async getMyInfo(): Promise<UserInfo> {
    const response = await this.request("GET", "/users/@me");
    return response?.data;
  }

  /**
   * Retrieves connections of the authorized user.
   * @returns {Promise<ConnectionType[]>} - User connections information.
   * @throws {Error} - If fetching user connections fails.
   * @deprecated
   */
  public async getUserConnections(): Promise<ConnectionType[]> {
    const response = await this.request("GET", "/users/@me/connections");
    return response?.data;
  }

  /**
   * Retrieves connections of the authorized user.
   * @returns {Promise<ConnectionType[]>} - User connections information.
   * @throws {Error} - If fetching user connections fails.
   */
  public async getMyConnections(): Promise<ConnectionType[]> {
    const response = await this.request("GET", "/users/@me/connections");
    return response?.data;
  }

  /**
   * Retrives joined guilds of the authorized user.
   * @returns {Promise<Guild[]>} - User guilds information
   */
  public async getGuilds(): Promise<Guild[]> {
    const response = await this.request("GET", "/users/@me/guilds");
    return response?.data;
  }

  /**
   * This method is not implimented correctly yet.
   */
  public async getApplication(): Promise<any> {
    const response = await this.request("GET", "/oauth2/applications/@me", {
      headers: { Authorization: `Bot ${this.clientToken}` },
    });
    return response?.data;
  }

  /**
   * Joins a guild with the specified options.
   * @param {GuildJoinOptions} options - The options for joining the guild.
   * @returns {Promise<any>} A promise that resolves with the response data upon successful joining.
   * @throws {Error} If an error occurs during the join process.
   */
  public async joinGuild(options: GuildJoinOptions): Promise<any> {
    if (getType(options.guildId) !== "snowflake") {
      throw new TypeError(
        `Expected guild id to be a 'snowflake' but got ${getType(
          options.guildId
        )} instead.`
      );
    }
    if (getType(options.roles) !== "array") {
      throw new TypeError(
        `Expected roles to be an 'array' but got ${getType(
          options.roles
        )} instead.`
      );
    }
    if (getType(options.userId) !== "snowflake") {
      throw new TypeError(
        `Expected user id to be a 'snowflake' but got ${getType(
          options.userId
        )} instead.`
      );
    }
    const endpoint = `/guilds/${options.guildId}/members/${options.userId}`;
    const rolesToAdd = options.roles || [];

    const response = await axios.put(
      `${this.baseURL}${endpoint}`,
      { roles: rolesToAdd, access_token: this.accessToken },
      {
        headers: {
          Authorization: `Bot ${this.clientToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  }

  /**
   *@deprecated
   */
  public async getGuildMember(guildId: snowflake): Promise<any> {
    if (getType(guildId) !== "snowflake") {
      throw new TypeError(
        `guildId is not a valid snowflake.\nExpected: 'snowflake'\tReceived: ${getType(
          guildId
        )}`
      );
    }
    const response = await this.request(
      "GET",
      `/users/@me/guilds/${guildId}/member`
    );
    return response?.data;
  }

  public async getMyInfoFromGuild(guildId: snowflake): Promise<any> {
    if (getType(guildId) !== "snowflake") {
      throw new TypeError(
        `guildId is not a valid snowflake.\nExpected: 'snowflake'\tReceived: ${getType(
          guildId
        )}`
      );
    }
    const response = await this.request(
      "GET",
      `/users/@me/guilds/${guildId}/member`
    );
    return response?.data;
  }

  /**
   * Retrieves the username of the authorized user.
   * @returns {Promise<string>} - User's username.
   * @throws {Error} - If fetching the username fails.
   */
  async username(): Promise<string> {
    const userInfo = await this.getMyInfo();
    return userInfo.username;
  }
}

export { DiscordAuthorization, Scopes };
