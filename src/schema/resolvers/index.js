const { GraphQLScalarType } = require('graphql');
const { DateTimeResolver, JSONResolver, DateResolver } = require('graphql-scalars');

// Import resolver modules
const Query = require('./Query');
const Mutation = require('./Mutation');
const Subscription = require('./Subscription');

// Import type resolvers
const { User, UserConfiguration, NotificationPreferences } = require('./types/User');
const { Sensor, SensorReading, SensorStatistics } = require('./types/Sensor');
const { Device, DeviceEvent } = require('./types/Device');
const { Rule, RuleExecution, RuleStatistics } = require('./types/Rule');
const { Notification, NotificationTemplate, TemplateVariable, NotificationAction } = require('./types/Notification');

// Combine all resolvers
const resolvers = {
  // Scalar types
  DateTime: DateTimeResolver,
  Date: DateResolver,
  JSON: JSONResolver,

  // Root types
  Query,
  Mutation,
  Subscription,

  // Object type resolvers
  User,
  UserConfiguration,
  NotificationPreferences,
  Sensor,
  SensorReading,
  SensorStatistics,
  Device,
  DeviceEvent,
  Rule,
  RuleExecution,
  RuleStatistics,
  Notification,
  NotificationTemplate,
  TemplateVariable,
  NotificationAction
};

module.exports = resolvers;
