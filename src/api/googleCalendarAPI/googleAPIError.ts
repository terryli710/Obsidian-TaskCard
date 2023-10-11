import { logger } from "../../utils/log";

export const throwGoogleApiError = (errorDetail: string, method: string, url: string, body: any, status: number, response: any) => {
    const errorMessage = `Error Google API request: ${errorDetail}`;
    logger.error(errorMessage, { method, url, body, status, response });
    throw new GoogleApiError(errorMessage, { method, url, body }, status, response);
};

export class GoogleApiError extends Error {
    request: any;
    status: number;
    response: any;

    constructor(message: string, request: any, status: number, response: any) {
        super(message);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, GoogleApiError.prototype);

        this.request = request;
        this.status = status;
        this.response = response;
    }

    sayHello() {
        return "hello " + this.message;
    }

    get detailedMessage() {
        return `${this.message} - Request: ${JSON.stringify(this.request)} - Status: ${this.status} - Response: ${JSON.stringify(this.response)}`;
    }
}