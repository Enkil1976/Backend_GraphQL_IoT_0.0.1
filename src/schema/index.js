const { gql } = require('apollo-server-express');
const fs = require('fs');
const path = require('path');

/**
 * Load and combine all GraphQL type definitions
 */
function loadTypeDefs() {
  const typeDefsDir = path.join(__dirname, 'typeDefs');
  const typeDefs = [];

  // Base types and scalars
  const baseTypeDefs = gql`
    scalar DateTime
    scalar JSON
    scalar Upload

    # Base types
    type PageInfo {
      hasNextPage: Boolean!
      hasPreviousPage: Boolean!
      startCursor: String
      endCursor: String
    }

    type HealthCheck {
      status: String!
      timestamp: DateTime!
      services: JSON!
    }

    # Root types (will be extended by other schemas)
    type Query {
      health: HealthCheck!
    }

    type Mutation {
      _empty: String
    }

    type Subscription {
      _empty: String
    }
  `;

  typeDefs.push(baseTypeDefs);

  // Load all .graphql files from typeDefs directory
  const schemaFiles = [
    'sensor.graphql',
    'device.graphql',
    'user.graphql',
    'rule.graphql',
    'notification.graphql'
    // 'pumpCycles.graphql' // Temporarily disabled until deployment
  ];

  schemaFiles.forEach(filename => {
    const filePath = path.join(typeDefsDir, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      typeDefs.push(gql(content));
    } else {
      console.warn(`⚠️ Schema file not found: ${filename}`);
    }
  });

  return typeDefs;
}

module.exports = loadTypeDefs();