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


const generateGraphqlSchema = async () => {
    try {
        if (fs.existsSync(schemaFilePath)) {
            return;
        }
        if (!config.api) {
            config.api = {
                method: 'GET',
                url: url,
                headers: {}
            }
            return;
        }
        console.log(`Generating Graphql schema for ${schemelessUrl}`);
        console.log('Please configure graphql-config.json if you run into issues')


        const sdl = await getGraphqlSchemaFromUrl(config.api.url, config.api.headers, config.api.method);

        fs.writeFileSync(schemaFilePath, sdl.replace(/Json/gm, "JSON"));
        config.api.found = true;
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));

        console.log(`Schema saved to ${schemaFilePath}`);
    } catch (err) {
        console.error("Error generating schema:", err);
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
        customFormatErrorFn: (err) => {
            if (typeof err.toJSON === "function") {
                return err.toJSON();
            } else {
                // Custom error formatting
                return {
                    message: err.message,
                    locations: err.locations,
                    stack: err.stack ? err.stack.split('\n') : [],
                    path: err.path
                };
            }
        },
        customExecuteFn: async () => {
            try {
                return await fetchJson(
                    method === 'GET' ? `${endpoint}?query=${req.body.query}` : endpoint,
                    {
                        method,
                        headers,
                        agent
                    });
            } catch (err) {
                console.log(err);
                throw new Error(err.message);
            }
        }
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
    if (config.api?.found !== false) {
        await generateGraphqlSchema()
    }
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    if (launch) {
        await startGraphiql(
            config.api.url,
            config.api.headers,
            config.api.method
        )
    }
}
main()