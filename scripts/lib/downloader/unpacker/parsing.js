const requiresRegex = /return __webpack_require__\.p.*/;
const sriHashesRegex = /__webpack_require__\.sriHashes = (.*);/;
const webpackRequirePathRegex = /__webpack_require__.p = (.*);/;

const sourceMapExpession = /\/\/# sourceMappingURL=(.*)/m;


export function getImportList(bootstrap) {
    const getRequiresFnParts = bootstrap.match(requiresRegex);
    const sriTableParts = bootstrap.match(sriHashesRegex);
    const webpackPath = bootstrap.match(webpackRequirePathRegex);
    if (getRequiresFnParts && sriTableParts && webpackPath) {
        const fnString = `(chunkId) => { ${getRequiresFnParts[0]} }`.replace('__webpack_require__.p', webpackPath[1]);
        const getDependency = eval(fnString);
        const sriHashes = JSON.parse(sriTableParts[1]);
        return Object.keys(sriHashes).map(getDependency);
    }
}

export function findSourceMapping(script) {
    const parts = Array.from(script.match(sourceMapExpession) || []);
    if (parts && parts.length > 1) return parts[1];
    return null;
}
