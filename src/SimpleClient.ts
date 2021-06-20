import {format as authFormat, Token, TokenOptions} from 'auth-header';
import {JsonConverter} from 'tipify';
import {SimpleClientError} from './SimpleClientError';

type Fetch = (url: RequestInfo, init?: RequestInit) => Promise<Response>;
type Converter = (obj: any) => any;
type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

export class SimpleClient {

    public async post(uri: RequestInfo, options: ResponseClientOptions): Promise<Response>;
    public async post<T>(uri: RequestInfo, options: JsonClientOptions): Promise<T>;
    public async post<T>(uri: RequestInfo, options: ResponseClientOptions | JsonClientOptions): Promise<T | Response> {
        return this.http<T>(uri, 'post', options as any);
    }

    public async put(uri: RequestInfo, options: ResponseClientOptions): Promise<Response>;
    public async put<T>(uri: RequestInfo, options: JsonClientOptions): Promise<T>;
    public async put<T>(uri: RequestInfo, options: ResponseClientOptions | JsonClientOptions): Promise<T | Response> {
        return this.http<T>(uri, 'put', options as any);
    }

    public async patch(uri: RequestInfo, options: ResponseClientOptions): Promise<Response>;
    public async patch<T>(uri: RequestInfo, options: JsonClientOptions): Promise<T>;
    public async patch<T>(uri: RequestInfo, options: ResponseClientOptions | JsonClientOptions): Promise<T | Response> {
        return this.http<T>(uri, 'patch', options as any);
    }

    public async delete(uri: RequestInfo, options: ResponseClientOptions): Promise<Response>;
    public async delete<T>(uri: RequestInfo, options: JsonClientOptions): Promise<T>;
    public async delete<T>(uri: RequestInfo, options: ResponseClientOptions | JsonClientOptions): Promise<T | Response> {
        return this.http<T>(uri, 'delete', options as any);
    }

    public async get(uri: RequestInfo, options: ResponseClientOptions): Promise<Response>;
    public async get<T>(uri: RequestInfo, options: JsonClientOptions): Promise<T>;
    public async get<T>(uri: RequestInfo, options: ResponseClientOptions | JsonClientOptions): Promise<T | Response> {
        return this.http<T>(uri, 'get', options as any);
    }

    public async http(uri: RequestInfo, method: Method, options: ResponseClientOptions): Promise<Response>;
    public async http<T>(uri: RequestInfo, method: Method, options: JsonClientOptions): Promise<T>;
    public async http<T>(uri: RequestInfo, method: Method, options: ResponseClientOptions | JsonClientOptions): Promise<T | Response> {

        const logger = this.options.logger('http', this);

        const requestInit = this.buildFetchOptionsInit(method, options);

        let response: Response;
        try {
            response = await this.options.fetch(uri, requestInit);
        } catch (e) {
            const msg = 'fail to execute request : ' + e.message;
            logger.error(msg);
            throw new SimpleClientError(msg, e);
        }

        const expectedStatus = options.expectedStatus ? options.expectedStatus : 200;
        if (response.status !== expectedStatus) {
            const msg = `expecting status <${expectedStatus}> calling <${uri}>, got <${response.status}>`;
            logger.error(msg);
            const text = await response.text();
            let responseBody = text;
            try {
                responseBody = JSON.parse(text);
            } catch (e) {
                logger.debug('cannot deserialize body');
            }
            logger.debug('got body', responseBody);
            throw new SimpleClientError(msg, undefined, response.status, responseBody);
        }

        if (options.mode === 'json') {
            const jsonOptions = options as JsonClientOptions;
            if (jsonOptions.deserializer) {
                return (jsonOptions.deserializer(await response.json()));

            } else if (jsonOptions.deserializeType) {
                return this.options.jsonConverter.deserialize(
                    await response.json(),
                    jsonOptions.deserializeType);

            } else {
                return response.json();
            }
        }

        return response;
    }

    public buildFetchOptionsInit(method: string, options: ResponseClientOptions | JsonClientOptions): RequestInit {

        const logger = this.options.logger('buildHttpOptions', this);

        let headers: { [key: string]: string } = {
            'pragma': 'no-cache',
            'cache-control': 'no-cache',
        };
        let body: any;

        // append request id
        const reqId = this.options.requestId();
        if (reqId) {
            headers['request-id'] = reqId;
        }

        // append authorization header
        if (options.token) {
            logger.debug('setting authorization header from given token');
            headers.Authorization = options.token;
        } else if (options.user && options.user.getToken()) {
            logger.debug('setting authorization header from give user');
            headers.Authorization = authFormat(options.user.getToken() as TokenOptions);
        }

        // append client headers from user
        if (options.user && options.user.getClientHeaders()) {
            headers = {
                ...options.user.getClientHeaders(),
                ...headers,
            };
        }

        // setting json body
        if (options.mode === 'json' && options.json) {
            logger.debug('setting json body');
            headers['Content-Type'] = 'application/json';
            headers.Accept = 'application/json';

            if (options.serializer === false) {
                body = JSON.stringify(options.json);
            } else if (typeof (options.serializer) === 'function') {
                logger.debug('serializing body');
                body = JSON.stringify(options.serializer(options.json));
            } else {
                body = this.options.jsonConverter.serialize(
                    options.json,
                    undefined,
                    {unsafe: true});
            }
        }

        // setting form body
        if (options.form) {
            logger.debug('setting form body');
            body = new URLSearchParams(options.form);
        }

        // build request init
        let requestInit: RequestInit = {body, method};
        if (options.fetchOptions) {
            requestInit = {...requestInit, ...options.fetchOptions};
        }
        if (requestInit.headers) {
            requestInit.headers = {...headers, ...requestInit.headers};
        } else {
            requestInit.headers = headers;
        }

        return requestInit;
    }

    constructor(private options: SimpleClientOptions) {
    }
}

type ClientOptions = {
    user?: AuthenticatedUser;
    token?: string;
    fetchOptions?: RequestInit;
    expectedStatus?: number;
    form?: { [key: string]: string }
}

type ResponseClientOptions = ClientOptions & {
    mode: 'response';
}

type JsonClientOptions = ClientOptions & {
    deserializer?: Converter;
    deserializeType?: any;
    mode: 'json';
    json?: any;
    serializer?: boolean | Converter;
}

interface AuthenticatedUser {
    getToken(): Token;

    getClientHeaders(): { [key: string]: string };
}

type Logger = {
    debug: (...args: string[]) => void,
    error: (...args: string[]) => void
};

export interface SimpleClientOptions {
    fetch: Fetch;
    jsonConverter: JsonConverter;
    logger: (arg1: string, arg2: SimpleClient) => Logger;
    requestId: () => string;
}
