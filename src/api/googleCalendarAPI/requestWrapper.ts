// Adopted from https://github.com/YukiGasai/obsidian-google-calendar/blob/master/src/helper/RequestWrapper.ts

import { GoogleApiError } from './googleAPIError';
import { requestUrl } from "obsidian";
import { GoogleCalendarAuthenticator } from './authentication';
import { logger } from '../../utils/log';

export const callRequest = async (url: string, method: string, body: any, noAuth = false): Promise<any> => {

    const requestHeaders = { 'Content-Type': 'application/json' };
    if (noAuth == false) {
        const bearer = await new GoogleCalendarAuthenticator().getGoogleAuthToken();
        if (!bearer) {
            throw new GoogleApiError("Error Google API request", 
                { method, url, body, },
                401,
                {error: "Missing Auth Token"}
            );
        }
        requestHeaders['Authorization'] = 'Bearer ' + bearer;
    }

    //Normal request
    let response;
    try { 
        logger.debug(`request url: ${url}, method: ${method}, body: ${body}, headers: ${JSON.stringify(requestHeaders)}`);
        response = await requestUrl({
            method: method,
            url: url,
            body: body ? JSON.stringify(body) : null,
            headers: requestHeaders,
            throw: false,
        });
    }catch (error) {
        if(response) {
        throw new GoogleApiError("Error Google API request", 
            { method, url, body, },
            response.status,
            (await response.json()),
        );
        } else {
            throw new GoogleApiError("Error Google API request", 
            { method, url, body, },
            500,
            {error: "Unknown Error"},
        );
        }
    }

    if (response.status >= 300) {
        throw new GoogleApiError("Error Google API request", 
            { method, url, body, },
            response.status,
            response.json,
        );
    }

    // For to indicate success because the response is empty
    if (method.toLowerCase() == "delete") {
        return { status: "success" };
    }

    return (await response.json);
}