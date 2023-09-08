import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { URLSearchParams } from "url";
import { OAuth2Options } from "../types";
import { Scopes, UserInfo, ConnectionType, Guild } from "../types";
import { snowflake } from "../global";
import { GuildJoinOptions } from "../types/Authorize";
import {
  generateLink,
  getConnections,
  getGuilds,
  getInfo,
  getProfileInGuilds,
  getTokens,
  username,
} from "../rest";
import getType from "../util/getType";

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
   * Generates an OAuth2 authorization link for Discord.
   * @param {{ scopes: Scopes[] }} param0 - Authorization scopes array.
   * @param {string} [state="1bac472"] - Authorization state
   * @returns {string} - OAuth2 authorization link.
   */
  public generateOauth2Link(
    { scopes }: { scopes: Scopes[] },
    state: string = "1bac472"
  ): string {
    const url = generateLink(
      { scopes: scopes },
      state,
      this.clientId,
      this.redirectUri
    );
    return url;
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
    const { accessToken, refreshToken } = await getTokens(
      code,
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
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
    const info = await getInfo(this.accessToken as string);

    return info;
  }

  /**
   * Retrieves information about the authorized user.
   * @returns {Promise<UserInfo>} - User information.
   * @throws {Error} - If fetching user information fails.
   */
  public async getMyInfo(): Promise<any> {
    const info = await getInfo(this.accessToken as string);

    return info;
  }

  /**
   * Retrieves connections of the authorized user.
   * @returns {Promise<ConnectionType[]>} - User connections information.
   * @throws {Error} - If fetching user connections fails.
   * @deprecated
   */
  public async getUserConnections(): Promise<ConnectionType[]> {
    const info = await getConnections(this.accessToken as string);

    return info;
  }

  /**
   * Retrieves connections of the authorized user.
   * @returns {Promise<ConnectionType[]>} - User connections information.
   * @throws {Error} - If fetching user connections fails.
   */
  public async getMyConnections(): Promise<ConnectionType[]> {
    const info = await getConnections(this.accessToken as string);

    return info;
  }

  /**
   * Retrives joined guilds of the authorized user.
   * @returns {Promise<Guild[]>} - User guilds information
   */
  public async getGuilds(): Promise<Guild[]> {
    const info = await getGuilds(this.accessToken as string);

    return info;
  }

  /**
   * Get info of the bot.
   */
  public async getApplication(): Promise<any> {
    throw new Error("Use discord.js or eris or any other module for it.");
  }

  /**
   * Joins a guild with the specified options.
   * @param {GuildJoinOptions} options - The options for joining the guild.
   * @returns {Promise<any>} A promise that resolves with the response data upon successful joining.
   * @throws {Error} If an error occurs during the join process.
   */
  public async joinGuild(options: GuildJoinOptions): Promise<any> {
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
    const r = await getProfileInGuilds(guildId, this.accessToken as string);

    return r;
  }

  public async getMyInfoFromGuild(guildId: snowflake): Promise<any> {
    const r = await getProfileInGuilds(guildId, this.accessToken as string);

    return r;
  }

  /**
   * Retrieves the username of the authorized user.
   * @returns {Promise<string>} - User's username.
   * @throws {Error} - If fetching the username fails.
   */
  async username(): Promise<string> {
    const r = await username(this.accessToken as string);

    return r;
  }
}

export { DiscordAuthorization, Scopes };
