const { gql } = require('apollo-server-express');
const fs = require('fs');
const path = require('path');

// Import scalar types
const { DateTimeTypeDefinition, JSONTypeDefinition } = require('graphql-scalars');

// Base type definitions
const baseTypeDefs = gql`
  # Custom Scalars
  scalar DateTime
  scalar Date
  scalar JSON

  # Base Query, Mutation, and Subscription types
  type Query {
    # Health check
    health: HealthStatus!
  }

  type Mutation {
    # Placeholder for mutations
    _empty: String
  }

  type Subscription {
    # Placeholder for subscriptions  
    _empty: String
  }

  # Health Status
  type HealthStatus {
    status: String!
    timestamp: DateTime!
    services: ServiceStatus!
  }

  type ServiceStatus {
    database: String!
    redis: String!
    mqtt: String!
  }

  # Common Types
  enum Status {
    ONLINE
    OFFLINE
    ERROR
    MAINTENANCE
  }

  # Pagination
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  input TimeRange {
    from: DateTime!
    to: DateTime!
  }

  type TimeRangeOutput {
    from: DateTime!
    to: DateTime!
  }

  # Error Types
  type ValidationError {
    field: String!
    message: String!
    code: String!
  }

  type ValidationResult {
    isValid: Boolean!
    errors: [ValidationError!]!
    warnings: [String!]!
  }
`;

// Function to load GraphQL files
function loadGraphQLFile(filename) {
  try {
    const filePath = path.join(__dirname, filename);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.warn(`Warning: Could not load GraphQL file ${filename}:`, error.message);
    return '';
  }
}

// Load additional type definitions
const sensorTypeDefs = loadGraphQLFile('sensor.graphql');
const deviceTypeDefs = loadGraphQLFile('device.graphql');
const userTypeDefs = loadGraphQLFile('user.graphql');
const ruleTypeDefs = loadGraphQLFile('rule.graphql');
const notificationTypeDefs = loadGraphQLFile('notification.graphql');
const weatherTypeDefs = loadGraphQLFile('weather.graphql');
const pumpCycleTypeDefs = loadGraphQLFile('pumpCycles.graphql');

// Combine all type definitions
const typeDefs = [
  DateTimeTypeDefinition,
  JSONTypeDefinition,
  baseTypeDefs,
  sensorTypeDefs,
  deviceTypeDefs,
  userTypeDefs,
  ruleTypeDefs,
  notificationTypeDefs,
  weatherTypeDefs,
  pumpCycleTypeDefs
].filter(Boolean); // Remove empty strings

module.exports = typeDefs;