import { makeExecutableSchema } from '@graphql-tools/schema';
import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { join } from 'path';

const typesArray = loadFilesSync(join(process.cwd(), 'src/**/*.graphql'));
const resolversArray = loadFilesSync(join(process.cwd(), 'src/**/*.resolver.*'));

const graphqlSchema = makeExecutableSchema({
    typeDefs: mergeTypeDefs(typesArray),
    resolvers: mergeResolvers(resolversArray)
})

export default graphqlSchema;