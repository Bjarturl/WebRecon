import { Builder } from 'selenium-webdriver'

import { printSchema, buildClientSchema } from "graphql/utilities/index.js";
import { INTROSPECTION_QUERY } from "./constants.js";
import https from 'https';
import fetch from "isomorphic-fetch";



export const findValueByKey = (object, key) => {
    if (object === null || typeof object !== 'object') {
        return null;
    }

    if (key in object) {
        return object[key];
    }

    for (const k in object) {
        if (typeof object[k] === 'object') {
            const found = findValueByKey(object[k], key);
            if (found) {
                return found;
            }
        }
    }
    return null;
};

export const getPrismicTokenFromGatsbySite = async (url) => {
    const driver = await new Builder().forBrowser('chrome').build();
    try {
        await driver.get(url);
        let gatsbySourcePrismic = await driver.executeScript("return window.__GATSBY_SOURCE_PRISMIC__;");

        const repositoryName = findValueByKey(gatsbySourcePrismic, 'repositoryName');
        const accessToken = findValueByKey(gatsbySourcePrismic, 'accessToken');

        return {
            repositoryName,
            accessToken
        }
    } finally {
        await driver.quit();
    }
};



export const getGraphqlSchemaFromUrl = async (
    url,
    headers = {},
    method = "POST"
) => {
    const miniIntrospection = '{ __schema { __typename } }'

    const agent = new https.Agent({
        rejectUnauthorized: false
    });

    const config = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        agent: url.startsWith('https') ? agent : null,
    };

    if (method === "POST") {
        config.body = JSON.stringify({ query: miniIntrospection });
    }


    // check if introspection is enabled first
    const check = await fetchJson(
        method === "POST" ? url : `${url}?query=${miniIntrospection}`,
        config
    );
    if (!check) {
        throw new Error('Failed to do introspection on graphql endpoint');
    }
    if (method === "POST") {
        config.body = JSON.stringify({ query: INTROSPECTION_QUERY });
    }

    const responseJson = await fetchJson(
        method === "POST" ? url : `${url}?query=${INTROSPECTION_QUERY}`,
        config
    );

    const sdl = convertJsonToSdl(responseJson).replace(/Json/gm, "JSON");
    return sdl;
}


export const convertJsonToSdl = (raw) => {
    if (!raw || typeof raw !== "object") {
        throw new Error("Invalid JSON object received");
    }

    if (raw.errors) {
        throw new Error(
            `Errors received from GraphQL endpoint: ${JSON.stringify(
                raw.errors,
                null,
                2
            )}`
        );
    }
    const schemaData = raw.data;
    if (!schemaData || !schemaData.__schema) {
        throw new Error('No "data" or "__schema" key found in JSON object');
    }

    const schema = buildClientSchema(schemaData);
    return printSchema(schema);
}


export const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Failed to fetch from ${url}. Status: ${response.status}`);
    }
    return response.json();
}
