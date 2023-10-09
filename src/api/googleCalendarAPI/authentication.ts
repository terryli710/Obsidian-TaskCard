// Adopted from https://github.com/YukiGasai/obsidian-google-calendar/blob/master/src/googleApi/GoogleAuth.ts

import OAuth2Client from 'google-auth-library';
import { getRefreshToken, setAccessToken, setExpirationTime, setRefreshToken } from './localStorage';
import { Notice, requestUrl } from 'obsidian';
import TaskCardPlugin from '../..';

const {google} = require('googleapis');
// const calendar = google.calendar('v3');
// const http = require('http');
// const url = require('url');
// const opn = require('open');
// const destroyer = require('server-destroy');

import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../utils/log';


// const PORT: number = 8888;
const PORT: number = 42813;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

let authSession = {server: null, verifier: null, challenge: null, state:null};



export async function GoogleCalendarLogin(): Promise<void> {
    const plugin = TaskCardPlugin.getInstance();
    // const clientID = plugin.settings.syncSettings.GoogleSyncSetting.clientID || "1092403450430-ef10a6poh36bmbt5vl9bo2tbuvr4j3he.apps.googleusercontent.com";
    // const clientID = "1092403450430-ef10a6poh36bmbt5vl9bo2tbuvr4j3he.apps.googleusercontent.com";
    const clientID = "1092403450430-l172ifl5j5vhqf3euhiqh4ll75ou1n67.apps.googleusercontent.com";

	if(!authSession.state){
		authSession.state = generateState();
		authSession.verifier = await generateVerifier();
		authSession.challenge = await generateChallenge(authSession.verifier);
	}
    
	const authURL = 'https://accounts.google.com/o/oauth2/v2/auth'
	+ `?client_id=${clientID}`
	+ `&response_type=code`
	+ `&redirect_uri=${REDIRECT_URI}`
	+ `&prompt=consent`
	+ `&access_type=offline`
	+ `&state=${authSession.state}`
	+ `&code_challenge=${authSession.challenge}`
	+ `&code_challenge_method=S256`
	+ `&scope=email%20profile%20https://www.googleapis.com/auth/calendar`;
	

	// Make sure no server is running before starting a new one
	if(authSession.server) {
		window.open(authURL);
		return
	}

	const http = require("http");
	const url = require("url");

	authSession.server = http
		.createServer(async (req: IncomingMessage, res: ServerResponse) => {
		try {
			// Make sure the callback url is used
			if (req.url.indexOf("/callback") < 0)return; 
			
			// acquire the code from the querystring, and close the web server.
			const qs = new url.URL(
				req.url,
				`http://127.0.0.1:${PORT}`
			).searchParams;
			const code = qs.get("code");
			const received_state = qs.get("state");
            logger.debug(`Received code: ${code}`);
			if (received_state !== authSession.state) {
				return;
			}
			let token;
			
            token = await exchangeCodeForToken(plugin, authSession.state, authSession.verifier, code, false);

			if(token?.refresh_token) {
				setRefreshToken(token.refresh_token);
				setAccessToken(token.access_token);
				setExpirationTime(+new Date() + token.expires_in * 1000);
			}
			console.info("Tokens acquired.");

			res.end(
				"Authentication successful! Please return to obsidian."
			);

			authSession.server.close(()=>{
				console.log("Server closed")
			});

            // NOTE: we don't need to refresh setting display
            
		} catch (e) {   
			logger.error(`Error: ${e}, Authentication failed`);

			authSession.server.close(()=>{
				console.log("Server closed")
			});
		}
		authSession = {server: null, verifier: null, challenge: null, state:null};
	})
	.listen(PORT, async () => {
		// open the browser to the authorize url to start the workflow
		window.open(authURL);
	});
}



const exchangeCodeForToken = async (plugin: TaskCardPlugin, state: string, verifier:string, code: string, isMobile: boolean): Promise<any> => {
	const url = `https://oauth2.googleapis.com/token`
	+ `?grant_type=authorization_code`
	// + `&client_id=${plugin.settings.syncSettings.GoogleSyncSetting.clientID?.trim()}`
    // + `&client_id="1092403450430-ef10a6poh36bmbt5vl9bo2tbuvr4j3he.apps.googleusercontent.com"`
    + `&client_id=${"1092403450430-l172ifl5j5vhqf3euhiqh4ll75ou1n67.apps.googleusercontent.com"}`
	// + `&client_secret=${plugin.settings.syncSettings.GoogleSyncSetting.clientSecret?.trim() || "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"}`
    // + `&client_secret="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"`
    + `&client_secret=${"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"}`
	+ `&code_verifier=${verifier}`
	+ `&code=${code}`
	+ `&state=${state}`
	+ `&redirect_uri=${REDIRECT_URI}`;

    // logger.debug(`url: ${url}`);
    // TODO: handle error code in response. (e.g. response.status = 401)
	const response = await fetch(url, {
		method: 'POST',
		headers: {'content-type': 'application/x-www-form-urlencoded'},
	});
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

