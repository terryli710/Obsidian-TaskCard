// Adopted from https://github.com/YukiGasai/obsidian-google-calendar/blob/master/src/googleApi/GoogleAuth.ts

import OAuth2Client from 'google-auth-library';
import { getRefreshToken, setAccessToken, setExpirationTime, setRefreshToken } from './localStorage';
import { Notice, requestUrl, Plugin } from 'obsidian';
import TaskCardPlugin from '../..';

const {google} = require('googleapis');
const http = require('http');
const url = require('url');

import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../utils/log';


const PORT: number = 8888;
// const PORT: number = 42813;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

let authSession = {server: null, verifier: null, challenge: null, state:null};


export async function GoogleCalendarLogin(): Promise<boolean> {
    const plugin = TaskCardPlugin.getInstance();
    const clientID = plugin.settings.syncSettings.googleSyncSetting.clientID;

    if (!authSession.state) {
        authSession.state = generateState();
        authSession.verifier = await generateVerifier();
        authSession.challenge = await generateChallenge(authSession.verifier);
    }

    const authURL = getAuthUrl(clientID, authSession);

    // Ensure no server is running before starting a new one
    if (!authSession.server) {
        window.open(authURL);
    }

    return startServerAndHandleResponse(plugin, authURL);
}

function getAuthUrl(clientID: string, authSession: any): string {
    return 'https://accounts.google.com/o/oauth2/v2/auth'
        + `?client_id=${clientID}`
        + '&response_type=code'
        + `&redirect_uri=${REDIRECT_URI}`
        + '&prompt=consent'
        + '&access_type=offline'
        + `&state=${authSession.state}`
        + `&code_challenge=${authSession.challenge}`
        + '&code_challenge_method=S256'
        + '&scope=email%20profile%20https://www.googleapis.com/auth/calendar';
}

async function startServerAndHandleResponse(plugin: any, authURL: string): Promise<boolean> {
    return new Promise((resolve) => {
        authSession.server = http.createServer(async (req, res) => {
            try {
                if (!isValidCallback(req)) {
                    return resolve(false);
                }

                const { code, received_state } = extractParamsFromRequest(req);

                if (received_state !== authSession.state) {
                    return resolve(false);
                }

                const token = await exchangeCodeForToken(plugin, authSession.state, authSession.verifier, code, false);

                if (!token) {
                    return resolve(false);
                }

                if (token?.refresh_token) {
                    storeTokensAndExpiration(token);
                    logger.info("Tokens acquired.");
                    res.end("[Obsidian Task Card] Authentication successful! Please return to obsidian.");
                    plugin.settings.syncSettings.googleSyncSetting.isLogin = true;
                }

            } catch (e) {
                logger.error(`Error: ${e}, Authentication failed`);
                return resolve(false);
            } finally {
                closeServer();
                resetAuthSession();
                resolve(true);
            }

        }).listen(PORT, () => window.open(authURL));
    });
}

function isValidCallback(req: IncomingMessage): boolean {
    return req.url && req.url.indexOf("/callback") >= 0;
}

function extractParamsFromRequest(req: IncomingMessage) {
    const qs = new url.URL(req.url!, `http://127.0.0.1:${PORT}`).searchParams;
    return {
        code: qs.get("code"),
        received_state: qs.get("state")
    };
}

function storeTokensAndExpiration(token: any) {
    setRefreshToken(token.refresh_token);
    setAccessToken(token.access_token);
    setExpirationTime(+new Date() + token.expires_in * 1000);
}

function closeServer() {
    authSession.server.close(() => {
        logger.info("Server closed.")
    });
}

function resetAuthSession() {
    authSession = { server: null, verifier: null, challenge: null, state: null };
}


const exchangeCodeForToken = async (plugin: TaskCardPlugin, state: string, verifier:string, code: string, isMobile: boolean): Promise<any> => {
	
    const clientID = plugin.settings.syncSettings.googleSyncSetting.clientID;
    const clientSecret = plugin.settings.syncSettings.googleSyncSetting.clientSecret;

    const url = `https://oauth2.googleapis.com/token`
        + `?grant_type=authorization_code`
        + `&client_id=${clientID}`
        + `&client_secret=${clientSecret}`
        + `&code_verifier=${verifier}`
        + `&code=${code}`
        + `&state=${state}`
        + `&redirect_uri=${REDIRECT_URI}`;

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


function generateState(): string {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function generateVerifier(): Promise<string> {
	const array = new Uint32Array(56);
	await window.crypto.getRandomValues(array);
	return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

async function generateChallenge(verifier: string): Promise<string> {
	const data = new TextEncoder().encode(verifier);
	const hash = await window.crypto.subtle.digest('SHA-256', data);
	return btoa(String.fromCharCode(...new Uint8Array(hash)))
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

