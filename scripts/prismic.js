import fs from 'fs'
import path from 'path'
import { getPrismicTokenFromGatsbySite, fetchJson, getGraphqlSchemaFromUrl } from './lib/helpers.js'
import express from "express";
import https from 'https';
import { buildSchema } from "graphql";
import open from 'open';
import { graphqlHTTP } from "express-graphql";

const config = {}
const url = process.argv[2] ?? '';
const launch = process.argv[3] !== '0';

const schemelessUrl = url.replace(/(^\w+:|^)\/\//, '')
const urlWithScheme = `https://${url}/`;

const outputDir = `output/${schemelessUrl}`;
const configFilePath = path.join(outputDir, 'graphql-config.json');
const schemaFilePath = path.join(outputDir, 'schema.graphql');
const agent = new https.Agent({
    rejectUnauthorized: false
});

const checkPrismic = async () => {
    if (!config.prismic) {
        config.prismic = {};
    }
    if (!config.prismic.repositoryName || !config.prismic.accessToken) {
        console.log('Checking for exposed Prismic token...')
        const { repositoryName, accessToken } = await getPrismicTokenFromGatsbySite(urlWithScheme);
        if (repositoryName && accessToken) {
            // Update the configuration
            config.prismic.repositoryName = repositoryName;
            config.prismic.accessToken = accessToken;
            // Write the updated configuration back to the file
            console.log('Prismic token found and saved to graphql-config.json');
        } else {
            config.prismic.found = false;
            console.log('No exposed Prismic token found.');
        }
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    }
}


const generatePrismicSchema = async () => {
    try {
        if (fs.existsSync(schemaFilePath)) {
            return;
        }
        if (!config.prismic || !config.prismic.repositoryName || !config.prismic.accessToken) {
            return;
        }
        console.log(`Generating Prismic Graphql schema for ${schemelessUrl}`);

        const apiUrl = `https://${config.prismic.repositoryName}.prismic.io/api`;
        const gqlUrl = `https://${config.prismic.repositoryName}.prismic.io/graphql`;

        const { refs } = await fetchJson(apiUrl);
        const masterRef = refs.find((ref) => ref.isMasterRef);

        if (!masterRef) {
            throw new Error("Failed to find the master reference from Prismic.");
        }


        config.prismic.ref = masterRef.ref;
        config.prismic.apiUrl = apiUrl;
        config.prismic.gqlUrl = gqlUrl;
        config.prismic.method = "GET";
        config.prismic.headers = {
            "Prismic-ref": masterRef.ref,
            authorization: config.prismic.accessToken,
        }

        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));

        const sdl = await getGraphqlSchemaFromUrl(gqlUrl, {
            "Prismic-ref": masterRef.ref,
        }, "GET");

        fs.writeFileSync(schemaFilePath, sdl);

        console.log(`Schema saved to ${schemaFilePath}`);
    } catch (err) {
        console.error("Error generating Prismic schema:", err);
        throw err;
    }
}

const startGraphiql = async (endpoint, headers, method = 'GET') => {
    const schema = fs.readFileSync(schemaFilePath, 'utf8')
    const app = express();
    app.use(express.json());
    app.use("/graphql", graphqlHTTP(req => ({
        schema: buildSchema(schema),
        graphiql: true,
        customExecuteFn: async () =>
            await fetchJson(
                method === 'GET' ? `${endpoint}?query=${req.body.query}` : endpoint, {
                method,
                headers,
                agent
            })
    })));

    app.listen(4444, async () => {
        console.log(`GraphiQL for ${schemelessUrl} running on http://localhost:4444/graphql`);
        await open("http://localhost:4444/graphql");
    });

}


const main = async () => {
    fs.mkdirSync(outputDir, { recursive: true });
    if (!url) {
        console.log('Please provide a url as a command-line argument.');
        exit(1);
    }
    if (fs.existsSync(configFilePath)) {
        Object.assign(config, JSON.parse(fs.readFileSync(configFilePath)))
    }
    config.url = urlWithScheme;
    if (config.prismic?.found !== false) {
        await checkPrismic()
        await generatePrismicSchema()
    }
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    if (launch) {
        await startGraphiql(
            config.prismic.gqlUrl,
            config.prismic.headers,
            config.prismic.method
        )
    }
}
main()