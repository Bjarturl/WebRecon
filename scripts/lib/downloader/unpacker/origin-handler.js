import { join } from 'path';

import { exists, readFileContent, saveFileToPath } from '../fs-helpers.js';
import { findSourceMapping, getImportList } from './parsing.js';
import URLDispatcher from './dispatcher.js';
import { joinURL } from '../fomatting.js';


export default class OriginHandler {
    requestedURIs = new Set();

    constructor(origin, baseDir, gateway) {
        this.origin = origin;
        this.baseDir = baseDir;
        this.gateway = gateway;
    }

    async saveRaw(path, data) {
        return await saveFileToPath(join(this.baseDir, 'raw', path), data);
    }

    async processScript(uri) {
        const mapping = await this.fetchSource(uri);
        if (mapping) {
            const mappingData = await this.fetchMapping(mapping);
            await this.saveRaw(uri, JSON.stringify(mappingData));
            await this.unpackScript(mappingData);
        }
    }

    async fetchSource(uri) {
        if (uri === undefined || this.requestedURIs.has(uri)) return;
        this.requestedURIs.add(uri);
        const data = (await this.gateway.schedule(joinURL(this.origin, uri))).data;
        await this.saveRaw(uri, data);
        const mapping = findSourceMapping(data);
        if (mapping) {
            if (/https?:\/\//i.test(mapping)) {
                return mapping;
            }
            return joinURL(this.origin, uri.replace(/\/[^/]+$/, '/'), mapping);
        }
        return null;
    }

    async fetchMapping(uri) {
        const mappingData = (await this.gateway.schedule(uri)).data;
        return mappingData;
    }

    async unpackSourceMapSources(mapping) {
        await Promise.all(
            (mapping.sources || []).map(async (value, index) => {
                const code = mapping.sourcesContent[index];
                await saveFileToPath(
                    join(this.baseDir, value.replace('webpack://', '').replaceAll(/\.\.\//g, '')),
                    code
                );
            })
        );
    }

    async unpackScript(mapping) {
        await this.unpackSourceMapSources(mapping);
        const bootstrapPath = joinURL(this.baseDir, 'webpack/bootstrap');
        if (await exists(bootstrapPath)) {
            const bootstrapContent = await readFileContent(bootstrapPath);
            const chunks = getImportList(bootstrapContent) || [];
            const dispatcher = URLDispatcher.getInstance();
            await Promise.all(chunks.map((chunk) => dispatcher.dispatchURI(chunk, this.origin)));
        }
    }
}
