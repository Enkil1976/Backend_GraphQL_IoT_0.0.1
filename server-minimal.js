#!/usr/bin/env node

/**
 * Servidor GraphQL mínimo para testing
 */

const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { typeDefs } = require('./src/schema/typeDefs');
const { resolvers } = require('./src/schema/resolvers');
const { createContext } = require('./src/middleware/auth');

async function startServer() {
  console.log('🚀 Iniciando servidor GraphQL mínimo...');
  
  // Crear servidor Apollo
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: createContext,
    introspection: true,
    playground: true,
    debug: true
  });

  await server.start();
  
  // Crear app Express
  const app = express();
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Aplicar middleware GraphQL
  server.applyMiddleware({ app, path: '/graphql' });
  
  const PORT = process.env.PORT || 4001;
  
  app.listen(PORT, () => {
    console.log(`🚀 GraphQL Server ready at http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`🔗 Health check at http://localhost:${PORT}/health`);
  });
}

// Configurar variables de entorno necesarias
process.env.NODE_ENV = 'development';
process.env.PG_HOST = 'localhost';
process.env.PG_PORT = '5432';
process.env.PG_DATABASE = 'invernadero_iot';
process.env.PG_USER = 'postgres';
process.env.PG_PASSWORD = 'postgres123';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'redis123';
process.env.JWT_SECRET = 'super_secret_jwt_key_for_local_development_only_32_chars';
process.env.ACCESS_TOKEN_SECRET = 'access_token_secret_for_local_dev_different_from_jwt';
process.env.REFRESH_TOKEN_SECRET = 'refresh_token_secret_for_local_dev_unique_value';

startServer().catch(error => {
  console.error('❌ Error starting server:', error);
  process.exit(1);
});