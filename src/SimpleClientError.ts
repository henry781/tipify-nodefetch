export class SimpleClientError extends Error {

    public readonly responseStatus: number;
    public readonly responseBody: any;
    public readonly cause: Error;

    constructor(message: string, cause?: Error, responseStatus?: number, responseBody?: any) {
        super(message);

        this.responseStatus = responseStatus;
        this.responseBody = responseBody;
        this.cause = cause;
        this.name = 'SimpleClientError';
    }
}
