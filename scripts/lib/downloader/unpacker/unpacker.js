import cheerio from 'cheerio';
import { join } from 'path';

import { saveFileToPath } from '../fs-helpers.js';
import RequestGateway from './request-gateway.js';
import URLDispatcher from './dispatcher.js';
import { quoteString } from '../fomatting.js';

export class Unpacker {
    gateway = new RequestGateway();
    dispatcher;

    constructor(url, outputDirectory) {
        this.url = url;
        this.outputDirectory = outputDirectory;
        this.dispatcher = new URLDispatcher(url, outputDirectory, this.gateway);
    }

    async start() {
        const page = await this.gateway.schedule(this.url);
        const $ = cheerio.load(page.data);
        const scriptPages = $('script')
            .toArray()
            .map((tag) => $(tag).attr('src'));
        await Promise.all(
            scriptPages.map((sourceURI) => this.dispatcher.dispatchURI(sourceURI, this.dispatcher.trivialOrigin))
        );

        await saveFileToPath(
            join(this.outputDirectory, quoteString(this.dispatcher.trivialOrigin), 'index.html'),
            page.data
        );
    }
}
