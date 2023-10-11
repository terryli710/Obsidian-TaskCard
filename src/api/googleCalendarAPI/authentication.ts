// Adopted from https://github.com/YukiGasai/obsidian-google-calendar/blob/master/src/googleApi/GoogleAuth.ts

import OAuth2Client from 'google-auth-library';
import { getAccessToken, getExpirationTime, getRefreshToken, setAccessToken, setExpirationTime, setRefreshToken } from './localStorage';
import { Notice, requestUrl, Plugin } from 'obsidian';
import TaskCardPlugin from '../..';

const {google} = require('googleapis');
const http = require('http');
const url = require('url');

import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../utils/log';
import { GoogleSyncSetting, SettingStore, SyncSettings } from '../../settings';


export class GoogleCalendarAuthenticator {
    private static PORT: number = 8888;
    private static REDIRECT_URI = `http://127.0.0.1:${GoogleCalendarAuthenticator.PORT}/callback`;

    private authSession = {server: null, verifier: null, challenge: null, state: null};
    private syncSettings: GoogleSyncSetting;
    public isLogin: boolean = false;

    constructor() {
        SettingStore.subscribe((settings) => {
            this.syncSettings = settings.syncSettings.googleSyncSetting;
            this.isLogin = settings.syncSettings.googleSyncSetting.isLogin;
        });
    }

    async login(): Promise<boolean> {
        const clientID = this.syncSettings.clientID;

        if (!this.authSession.state) {
            this.authSession.state = this.generateState();
            this.authSession.verifier = await this.generateVerifier();
            this.authSession.challenge = await this.generateChallenge(this.authSession.verifier);
        }

        const authURL = this.getAuthUrl(clientID, this.authSession);

        // Ensure no server is running before starting a new one
        if (!this.authSession.server) {
            window.open(authURL);
        }

        return this.startServerAndHandleResponse(this.syncSettings, authURL);
    }

    async getGoogleAuthToken(): Promise<string | null> {
        if (!this.syncSettings.isLogin) {
            new Notice(`[TaskCard] Not logged in to Google Calendar`);
            return null;
        }

        let token = getAccessToken();
        if (!token || this.needsToRefreshToken()) {
            // need to refresh token
            this.refreshAccessToken();
            token = getAccessToken();
        }
        return token;
    }


    async refreshAccessToken(): Promise<string> {
        const clientID = this.syncSettings.clientID;
        const clientSecret = this.syncSettings.clientSecret;
        const refreshToken = getRefreshToken();

        let refreshBody = {
            grant_type: "refresh_token",
            client_id: clientID,
            client_secret: clientSecret,
            refresh_token: refreshToken,
        };

        const {json: tokenData} = await requestUrl({
            method: 'POST',
            url: `https://oauth2.googleapis.com/token`,
            headers: {'content-type': 'application/json'},
            body: JSON.stringify(refreshBody)
        })

        if (!tokenData) {
            new Notice("[TaskCard] Error while refreshing authentication");
            return;
        }
        
        //Save new Access token and Expiration Time
        setAccessToken(tokenData.access_token);
        setExpirationTime(+new Date() + tokenData.expires_in * 1000);
        return tokenData.access_token;
    }


    needsToRefreshToken(): boolean {
        const timestamp = getExpirationTime()
        if (!timestamp) {
            return true;
        }
        if (timestamp < +new Date()) {
            return true;
        } else {
            return false;
        }
    }

    getAuthUrl(clientID: string, authSession: any): string {
        return 'https://accounts.google.com/o/oauth2/v2/auth'
            + `?client_id=${clientID}`
            + '&response_type=code'
            + `&redirect_uri=${GoogleCalendarAuthenticator.REDIRECT_URI}`
            + '&prompt=consent'
            + '&access_type=offline'
            + `&state=${authSession.state}`
            + `&code_challenge=${authSession.challenge}`
            + '&code_challenge_method=S256'
            + '&scope=email%20profile%20https://www.googleapis.com/auth/calendar';
    }

    async startServerAndHandleResponse(syncSettings: GoogleSyncSetting, authURL: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.authSession.server = http.createServer(async (req, res) => {
                try {
                    if (!this.isValidCallback(req)) {
                        return resolve(false);
                    }
    
                    const { code, received_state } = this.extractParamsFromRequest(req);
    
                    if (received_state !== this.authSession.state) {
                        return resolve(false);
                    }
    
                    const token = await this.exchangeCodeForToken(
                        syncSettings,
                        this.authSession.state, 
                        this.authSession.verifier, 
                        code, false);
    
                    if (!token) {
                        return resolve(false);
                    }
    
                    if (token?.refresh_token) {
                        this.storeTokensAndExpiration(token);
                        logger.info("Tokens acquired.");
                        res.end("[Obsidian Task Card] Authentication successful! Please return to obsidian.");
                        syncSettings.isLogin = true;
                    }
    
                } catch (e) {
                    logger.error(`Error: ${e}, Authentication failed`);
                    return resolve(false);
                } finally {
                    this.closeServer();
                    this.resetAuthSession();
                    resolve(true);
                }
    
            }).listen(GoogleCalendarAuthenticator.PORT, () => window.open(authURL));
        });
    }


    isValidCallback(req: IncomingMessage): boolean {
        return req.url && req.url.indexOf("/callback") >= 0;
    }

    extractParamsFromRequest(req: IncomingMessage) {
        const qs = new url.URL(req.url!, 
            `http://127.0.0.1:${GoogleCalendarAuthenticator.PORT}`)
        .searchParams;
        return {
            code: qs.get("code"),
            received_state: qs.get("state")
        };
    }

    storeTokensAndExpiration(token: any) {
        setRefreshToken(token.refresh_token);
        setAccessToken(token.access_token);
        setExpirationTime(+new Date() + token.expires_in * 1000);
    }

    closeServer() {
        this.authSession.server.close(() => {
            logger.info("Server closed.")
        });
    }

    resetAuthSession() {
        this.authSession = { server: null, verifier: null, challenge: null, state: null };
    }


    async exchangeCodeForToken (syncSettings: GoogleSyncSetting, state: string, verifier:string, code: string, isMobile: boolean): Promise<any> {
        
        const clientID = syncSettings.clientID;
        const clientSecret = syncSettings.clientSecret;

        const url = `https://oauth2.googleapis.com/token`
            + `?grant_type=authorization_code`
            + `&client_id=${clientID}`
            + `&client_secret=${clientSecret}`
            + `&code_verifier=${verifier}`
            + `&code=${code}`
            + `&state=${state}`
            + `&redirect_uri=${GoogleCalendarAuthenticator.REDIRECT_URI}`;

        logger.debug(`url: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {'content-type': 'application/x-www-form-urlencoded'},
        });
        // TODO: handle error code in response. (e.g. response.status = 401)
        if (!response.ok) {
            new Notice(`Log in failed. ${response.status}: ${await response.text()}`);
            return;
        }

        const jsonResponse = await response.json();
        // console.log(jsonResponse);
        return jsonResponse;
    }


    generateState(): string {
        return Math.random().toString(36).substring(2, 15) + 
            Math.random().toString(36).substring(2, 15);
    }

    async generateVerifier(): Promise<string> {
        const array = new Uint32Array(56);
        await window.crypto.getRandomValues(array);
        return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
    }

    async generateChallenge(verifier: string): Promise<string> {
        const data = new TextEncoder().encode(verifier);
        const hash = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }


}