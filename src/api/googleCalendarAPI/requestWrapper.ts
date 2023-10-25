// Adopted from https://github.com/YukiGasai/obsidian-google-calendar/blob/master/src/helper/RequestWrapper.ts

import { throwGoogleApiError } from './googleAPIError';
import { requestUrl } from "obsidian";
import { GoogleCalendarAuthenticator } from './authentication';
import { logger } from '../../utils/log';

export const callRequest = async (url: string, method: string, body: any, noAuth = false, retryCount = 0): Promise<any> => {
    const MAX_RETRIES = 3; // HARDCODED VALUE
    const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    
    if (!noAuth) {
        const bearer = await new GoogleCalendarAuthenticator().getGoogleAuthToken();
        if (!bearer) {
            throwGoogleApiError("Missing Auth Token", method, url, body, 401, {error: "Missing Auth Token"});
        }
        requestHeaders['Authorization'] = `Bearer ${bearer}`;
    }

    // Send request
    let response;
    try {
        logger.info(`Sending request - url: ${url}, method: ${method}, body: ${JSON.stringify(body)}, headers: ${JSON.stringify(requestHeaders)}`);
        response = await requestUrl({
            method,
            url,
            body: body ? JSON.stringify(body) : null,
            headers: requestHeaders,
            throw: false,
        });
    } catch (error) {
        logger.info(`Request failed - ${error}`);
        throwGoogleApiError("Request failed", method, url, body, response?.status ?? 500, { error: error.message });
    }

    // If the response indicates unauthorized and retry count is less than the max, refresh token and retry
    if (response.status === 401 && retryCount < MAX_RETRIES) {
        logger.info("Unauthorized response. Attempting to refresh token and retry.");
        await new GoogleCalendarAuthenticator().refreshAccessToken();  // Assuming you have this method.
        return callRequest(url, method, body, noAuth, retryCount + 1);
    }

    if (response.status >= 300) {
        let responseBody;
        try {
            responseBody = await response.json();
        } catch (error) {
            logger.error(`Failed to parse response JSON - ${error}`);
            responseBody = { error: "Invalid JSON response" };
        }
        throwGoogleApiError("Error in Google API request", method, url, body, response.status, responseBody);
    }

    if (method.toLowerCase() === "delete") {
        return { status: "success" };
    }

    const responseJson = await processResponse(response);

    return responseJson;
};

async function processResponse(response: any) {
    // logger.debug(`Received response - status: ${response.status}`);
    // logger.debug(`Type of response: ${typeof response}, response properties: ${Object.keys(response)}`);

    let jsonData;

    // If response.json is an object, it's likely the response body already parsed.
    // So, we directly assign it to jsonData.
    if (response.json && typeof response.json === 'object') {
        // logger.debug(`response.json is an object, assigning as jsonData...`);
        jsonData = response.json;
    }

    // If jsonData wasn't set above, and if response.json is a function, 
    // we try to parse the response's body as JSON.
    if (!jsonData && response.json && typeof response.json === 'function') {
        // logger.debug(`response.json is a function, trying to parse...`);
        try {
            jsonData = await response.json();
        } catch (error) {
            logger.error(`Error parsing response as JSON: ${error}`);
            // If an error occurs here, it means the JSON parsing method has failed.
            // You should handle the error appropriately, maybe re-throwing it or handling it based on your application's logic.
        }
    }

    // If jsonData is still not set (neither an object nor parsed), 
    // it indicates an unusual state, possibly an error in the response process.
    if (!jsonData) {
        logger.error('Unexpected state: jsonData is not set. Response might not contain JSON or parsing might have failed.');
        // Handle or throw error as per your error handling logic.
    } else {
        // Log the final jsonData after attempted parsing or direct assignment
        // logger.debug(`jsonData after processing: ${JSON.stringify(jsonData)}`);
    }

    return jsonData; // This will return undefined in case of an error, consider throwing an error if that's not desired.
}
