import axios, {AxiosError, AxiosRequestConfig, Method} from "axios";
import {APIException, NetworkConnectionException} from "../Exception";
import {parseWithDate} from "./json";

axios.defaults.transformResponse = (data, headers) => {
    const contentType = headers["content-type"];
    if (contentType && contentType.startsWith("application/json")) {
        return parseWithDate(data);
    }
    return data;
};

axios.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
        const requestURL = error.config.url!;
        if (error.response) {
            // Try to get server error message/ID/code from response
            const responseData = error.response.data;
            const errorMessage = responseData && responseData.message ? responseData.message : `failed to call ${requestURL}`;
            const errorId = responseData && responseData.id ? responseData.id : null;
            const errorCode = responseData && responseData.errorCode ? responseData.errorCode : null;

            if (!errorId && (error.response.status === 502 || error.response.status === 504)) {
                // Treat "cloud" error as Network Exception, e.g: gateway issue, load balancer unconnected to application server
                throw new NetworkConnectionException(`gateway error (${error.response.status})`, requestURL);
            } else {
                throw new APIException(errorMessage, error.response.status, requestURL, responseData, errorId, errorCode);
            }
        } else {
            throw new NetworkConnectionException(`failed to connect to ${requestURL}`, requestURL);
        }
    }
);

export function ajax<Request, Response>(method: Method, path: string, pathParams: object, request: Request): Promise<Response> {
    const config: AxiosRequestConfig = {method, url: url(path, pathParams)};

    if (method === "GET" || method === "DELETE") {
        config.params = request;
    } else if (method === "POST" || method === "PUT" || method === "PATCH") {
        config.data = request;
    }

    return axios.request(config).then(response => response.data);
}

export function url(pattern: string, params: object): string {
    if (!params) {
        return pattern;
    }
    let url = pattern;
    Object.entries(params).forEach(([name, value]) => {
        const encodedValue = encodeURIComponent(value.toString());
        url = url.replace(":" + name, encodedValue);
    });
    return url;
}
