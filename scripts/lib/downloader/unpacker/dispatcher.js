import { join } from 'path';

import { quoteString, splitURL } from '../fomatting.js';
import OriginHandler from './origin-handler.js';

export default class URLDispatcher {
    handlers = {};
    trivialOrigin;

    static _instance = null;

    constructor(url, outputDirectory, gateway) {
        this.url = url;
        this.outputDirectory = outputDirectory;
        this.gateway = gateway;
        URLDispatcher._instance = this;
        this.trivialOrigin = splitURL(this.url).origin;
    }

    static getInstance() {
        return URLDispatcher._instance;
    }

    async dispatchURI(path, origin) {
        if (origin === undefined) {
            origin = splitURL(this.url).origin;
        }
        if (/https?:\/\//i.test(path)) {
            const splitted = splitURL(path);
            [origin, path] = [splitted.origin, splitted.uri];
        }
        if (this.handlers[origin] === undefined) {
            this.handlers[origin] = new OriginHandler(
                origin,
                join(this.outputDirectory, quoteString(origin)),
                this.gateway
            );
        }
        await this.handlers[origin].processScript(path).catch(() => undefined);
    }
}
