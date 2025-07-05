# Arquitectura SaaS Multi-Tenant - Sistema IoT GraphQL

## 🎯 Visión General

Transformación del sistema IoT en una plataforma SaaS multi-tenant que permite:
- **Súper Administrador**: Control total de la plataforma, organizaciones y facturación
- **Administradores de Organización**: Gestión de sus propios usuarios y dispositivos
- **Modelo Freemium**: Funcionalidades básicas gratuitas + componentes premium
- **Escalabilidad**: Soporta miles de organizaciones y millones de dispositivos

## 🏗️ Arquitectura Multi-Tenant

### 1. Modelo de Datos Jerárquico

```sql
-- Tabla de Organizaciones (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan_type VARCHAR(50) NOT NULL DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    max_devices INTEGER DEFAULT 10,
    max_users INTEGER DEFAULT 5,
    max_sensors INTEGER DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    billing_email VARCHAR(255),
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    timezone VARCHAR(100) DEFAULT 'UTC',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Tabla de Planes de Suscripción
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    max_devices INTEGER DEFAULT 10,
    max_users INTEGER DEFAULT 5,
    max_sensors INTEGER DEFAULT 20,
    max_rules INTEGER DEFAULT 10,
    max_notifications INTEGER DEFAULT 1000,
    storage_gb INTEGER DEFAULT 1,
    api_calls_per_month INTEGER DEFAULT 10000,
    features JSONB DEFAULT '{}',
    ai_features_enabled BOOLEAN DEFAULT false,
    premium_integrations BOOLEAN DEFAULT false,
    priority_support BOOLEAN DEFAULT false,
    custom_branding BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Suscripciones Activas
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    amount DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'USD',
    payment_method_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Modificar tabla de usuarios para multi-tenancy
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN is_org_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '{}';

-- Modificar tablas existentes para multi-tenancy
ALTER TABLE devices ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE rules ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE temhum1_data ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE temhum2_data ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE calidad_agua_data ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE power_monitor_logs ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
```

### 2. Nuevos Roles y Permisos

```sql
-- Tabla de Roles del Sistema
CREATE TABLE system_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    is_system_role BOOLEAN DEFAULT false,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Permisos de Usuario
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES system_roles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Insertar roles del sistema
INSERT INTO system_roles (name, description, permissions, is_system_role) VALUES
('super_admin', 'Súper Administrador del Sistema', 
 '{"manage_organizations": true, "manage_billing": true, "manage_system": true, "view_analytics": true}', true),
('org_admin', 'Administrador de Organización', 
 '{"manage_users": true, "manage_devices": true, "manage_rules": true, "view_reports": true}', true),
('org_editor', 'Editor de Organización', 
 '{"create_devices": true, "edit_rules": true, "view_data": true}', true),
('org_viewer', 'Visor de Organización', 
 '{"view_data": true, "view_devices": true}', true);
```

## 🎁 Sistema de Planes Freemium/Premium

### 1. Definición de Planes

```javascript
// src/config/subscriptionPlans.js
const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    limits: {
      devices: 5,
      users: 2,
      sensors: 10,
      rules: 5,
      notifications: 100,
      storage_gb: 0.5,
      api_calls: 1000
    },
    features: {
      basic_dashboard: true,
      email_notifications: true,
      webhook_notifications: false,
      ai_features: false,
      premium_integrations: false,
      custom_branding: false,
      priority_support: false
    }
  },
  starter: {
    name: 'Starter',
    price: 29,
    limits: {
      devices: 25,
      users: 10,
      sensors: 50,
      rules: 25,
      notifications: 1000,
      storage_gb: 5,
      api_calls: 10000
    },
    features: {
      basic_dashboard: true,
      email_notifications: true,
      webhook_notifications: true,
      ai_features: false,
      premium_integrations: true,
      custom_branding: false,
      priority_support: true
    }
  },
  professional: {
    name: 'Professional',
    price: 99,
    limits: {
      devices: 100,
      users: 50,
      sensors: 200,
      rules: 100,
      notifications: 5000,
      storage_gb: 25,
      api_calls: 50000
    },
    features: {
      basic_dashboard: true,
      email_notifications: true,
      webhook_notifications: true,
      ai_features: true,
      premium_integrations: true,
      custom_branding: true,
      priority_support: true
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    limits: {
      devices: 'unlimited',
      users: 'unlimited',
      sensors: 'unlimited',
      rules: 'unlimited',
      notifications: 'unlimited',
      storage_gb: 100,
      api_calls: 'unlimited'
    },
    features: {
      basic_dashboard: true,
      email_notifications: true,
      webhook_notifications: true,
      ai_features: true,
      premium_integrations: true,
      custom_branding: true,
      priority_support: true,
      dedicated_support: true,
      white_label: true
    }
  }
};

module.exports = { SUBSCRIPTION_PLANS };
```

### 2. Middleware de Verificación de Límites

```javascript
// src/middleware/subscriptionLimits.js
const { SUBSCRIPTION_PLANS } = require('../config/subscriptionPlans');
const { query } = require('../config/database');

class SubscriptionLimitsMiddleware {
  static async checkDeviceLimit(organizationId) {
    const org = await query(
      'SELECT plan_type FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    if (!org.rows[0]) throw new Error('Organization not found');
    
    const plan = SUBSCRIPTION_PLANS[org.rows[0].plan_type];
    if (plan.limits.devices === 'unlimited') return true;
    
    const deviceCount = await query(
      'SELECT COUNT(*) FROM devices WHERE organization_id = $1',
      [organizationId]
    );
    
    if (deviceCount.rows[0].count >= plan.limits.devices) {
      throw new Error(`Device limit exceeded. Upgrade to add more devices.`);
    }
    
    return true;
  }
  
  static async checkUserLimit(organizationId) {
    const org = await query(
      'SELECT plan_type FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    const plan = SUBSCRIPTION_PLANS[org.rows[0].plan_type];
    if (plan.limits.users === 'unlimited') return true;
    
    const userCount = await query(
      'SELECT COUNT(*) FROM users WHERE organization_id = $1',
      [organizationId]
    );
    
    if (userCount.rows[0].count >= plan.limits.users) {
      throw new Error(`User limit exceeded. Upgrade to add more users.`);
    }
    
    return true;
  }
  
  static async checkFeatureAccess(organizationId, feature) {
    const org = await query(
      'SELECT plan_type FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    const plan = SUBSCRIPTION_PLANS[org.rows[0].plan_type];
    
    if (!plan.features[feature]) {
      throw new Error(`Feature '${feature}' not available in your plan. Please upgrade.`);
    }
    
    return true;
  }
}

module.exports = SubscriptionLimitsMiddleware;
```

## 🔐 Sistema de Autenticación Multi-Tenant

### 1. Middleware de Contexto de Organización

```javascript
// src/middleware/tenantContext.js
const { query } = require('../config/database');

class TenantContextMiddleware {
  static async injectTenantContext(req, res, next) {
    if (!req.user) return next();
    
    // Obtener organización del usuario
    const orgResult = await query(
      'SELECT o.* FROM organizations o JOIN users u ON o.id = u.organization_id WHERE u.id = $1',
      [req.user.id]
    );
    
    if (orgResult.rows[0]) {
      req.organization = orgResult.rows[0];
      req.tenantId = orgResult.rows[0].id;
    }
    
    // Verificar si es súper admin
    if (req.user.is_super_admin) {
      req.isSuperAdmin = true;
    }
    
    next();
  }
  
  static requireSuperAdmin(req, res, next) {
    if (!req.user?.is_super_admin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  }
  
  static requireOrgAdmin(req, res, next) {
    if (!req.user?.is_org_admin && !req.user?.is_super_admin) {
      return res.status(403).json({ error: 'Organization admin access required' });
    }
    next();
  }
}

module.exports = TenantContextMiddleware;
```

### 2. Servicios Multi-Tenant

```javascript
// src/services/organizationService.js
const { query } = require('../config/database');
const { SUBSCRIPTION_PLANS } = require('../config/subscriptionPlans');

class OrganizationService {
  async createOrganization(data) {
    const { name, slug, plan_type = 'free', admin_user } = data;
    
    // Verificar que el slug no existe
    const existingOrg = await query(
      'SELECT id FROM organizations WHERE slug = $1',
      [slug]
    );
    
    if (existingOrg.rows.length > 0) {
      throw new Error('Organization slug already exists');
    }
    
    // Crear organización
    const orgResult = await query(`
      INSERT INTO organizations (name, slug, plan_type, max_devices, max_users, max_sensors)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name,
      slug,
      plan_type,
      SUBSCRIPTION_PLANS[plan_type].limits.devices,
      SUBSCRIPTION_PLANS[plan_type].limits.users,
      SUBSCRIPTION_PLANS[plan_type].limits.sensors
    ]);
    
    const organization = orgResult.rows[0];
    
    // Crear usuario administrador
    if (admin_user) {
      await query(`
        INSERT INTO users (username, email, password, role, organization_id, is_org_admin, is_active)
        VALUES ($1, $2, $3, 'admin', $4, true, true)
      `, [
        admin_user.username,
        admin_user.email,
        admin_user.password,
        organization.id
      ]);
    }
    
    return organization;
  }
  
  async getOrganizationStats(organizationId) {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM devices WHERE organization_id = $1) as device_count,
        (SELECT COUNT(*) FROM users WHERE organization_id = $1) as user_count,
        (SELECT COUNT(*) FROM rules WHERE organization_id = $1) as rule_count,
        (SELECT COUNT(*) FROM notifications WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '30 days') as notification_count
    `, [organizationId]);
    
    return stats.rows[0];
  }
  
  async upgradeSubscription(organizationId, newPlan) {
    const plan = SUBSCRIPTION_PLANS[newPlan];
    if (!plan) throw new Error('Invalid subscription plan');
    
    await query(`
      UPDATE organizations 
      SET plan_type = $1, max_devices = $2, max_users = $3, max_sensors = $4, updated_at = NOW()
      WHERE id = $5
    `, [
      newPlan,
      plan.limits.devices === 'unlimited' ? 999999 : plan.limits.devices,
      plan.limits.users === 'unlimited' ? 999999 : plan.limits.users,
      plan.limits.sensors === 'unlimited' ? 999999 : plan.limits.sensors,
      organizationId
    ]);
    
    return { success: true, plan: newPlan };
  }
}

module.exports = new OrganizationService();
```

## 🎛️ Panel de Súper Administrador

### 1. Nuevos Tipos GraphQL

```graphql
# schema/types/SuperAdmin.graphql
type SuperAdminDashboard {
  totalOrganizations: Int!
  activeOrganizations: Int!
  totalUsers: Int!
  totalDevices: Int!
  monthlyRevenue: Float!
  planDistribution: [PlanStats!]!
  systemHealth: SystemHealth!
  recentActivity: [AdminActivity!]!
  topOrganizations: [OrganizationStats!]!
}

type PlanStats {
  planType: String!
  count: Int!
  revenue: Float!
  percentage: Float!
}

type OrganizationStats {
  id: ID!
  name: String!
  slug: String!
  planType: String!
  userCount: Int!
  deviceCount: Int!
  monthlyUsage: Float!
  lastActivity: DateTime!
  status: String!
}

type AdminActivity {
  id: ID!
  action: String!
  resource: String!
  organization: Organization
  user: User
  details: JSON!
  timestamp: DateTime!
}

type BillingOverview {
  totalRevenue: Float!
  monthlyRecurring: Float!
  pendingPayments: Float!
  churnRate: Float!
  growthRate: Float!
}

extend type Query {
  # Súper Admin Queries
  superAdminDashboard: SuperAdminDashboard! @auth(requires: SUPER_ADMIN)
  allOrganizations(
    limit: Int = 20
    offset: Int = 0
    status: String
    planType: String
  ): OrganizationConnection! @auth(requires: SUPER_ADMIN)
  
  organizationDetails(id: ID!): Organization! @auth(requires: SUPER_ADMIN)
  systemAnalytics(period: AnalyticsPeriod!): SystemAnalytics! @auth(requires: SUPER_ADMIN)
  billingOverview: BillingOverview! @auth(requires: SUPER_ADMIN)
  adminActivityLog(limit: Int = 50): [AdminActivity!]! @auth(requires: SUPER_ADMIN)
}

extend type Mutation {
  # Súper Admin Mutations
  createOrganization(input: CreateOrganizationInput!): Organization! @auth(requires: SUPER_ADMIN)
  updateOrganization(id: ID!, input: UpdateOrganizationInput!): Organization! @auth(requires: SUPER_ADMIN)
  suspendOrganization(id: ID!, reason: String!): Organization! @auth(requires: SUPER_ADMIN)
  activateOrganization(id: ID!): Organization! @auth(requires: SUPER_ADMIN)
  
  impersonateUser(userId: ID!): AuthPayload! @auth(requires: SUPER_ADMIN)
  
  createSubscriptionPlan(input: CreatePlanInput!): SubscriptionPlan! @auth(requires: SUPER_ADMIN)
  updateSubscriptionPlan(id: ID!, input: UpdatePlanInput!): SubscriptionPlan! @auth(requires: SUPER_ADMIN)
}
```

### 2. Resolvers del Súper Administrador

```javascript
// src/schema/resolvers/superAdmin.js
const organizationService = require('../../services/organizationService');
const billingService = require('../../services/billingService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');

const superAdminResolvers = {
  Query: {
    superAdminDashboard: async (parent, args, context) => {
      if (!context.user?.is_super_admin) {
        throw new ForbiddenError('Super admin access required');
      }
      
      const [
        orgStats,
        userStats,
        deviceStats,
        revenueStats,
        planStats,
        systemHealth,
        recentActivity
      ] = await Promise.all([
        organizationService.getOrganizationStats(),
        organizationService.getUserStats(),
        organizationService.getDeviceStats(),
        billingService.getRevenueStats(),
        organizationService.getPlanDistribution(),
        organizationService.getSystemHealth(),
        organizationService.getRecentActivity(10)
      ]);
      
      return {
        totalOrganizations: orgStats.total,
        activeOrganizations: orgStats.active,
        totalUsers: userStats.total,
        totalDevices: deviceStats.total,
        monthlyRevenue: revenueStats.monthly,
        planDistribution: planStats,
        systemHealth,
        recentActivity,
        topOrganizations: await organizationService.getTopOrganizations(5)
      };
    },
    
    allOrganizations: async (parent, args, context) => {
      if (!context.user?.is_super_admin) {
        throw new ForbiddenError('Super admin access required');
      }
      
      return await organizationService.getAllOrganizations(args);
    },
    
    systemAnalytics: async (parent, { period }, context) => {
      if (!context.user?.is_super_admin) {
        throw new ForbiddenError('Super admin access required');
      }
      
      return await organizationService.getSystemAnalytics(period);
    }
  },
  
  Mutation: {
    createOrganization: async (parent, { input }, context) => {
      if (!context.user?.is_super_admin) {
        throw new ForbiddenError('Super admin access required');
      }
      
      return await organizationService.createOrganization(input);
    },
    
    suspendOrganization: async (parent, { id, reason }, context) => {
      if (!context.user?.is_super_admin) {
        throw new ForbiddenError('Super admin access required');
      }
      
      return await organizationService.suspendOrganization(id, reason);
    },
    
    impersonateUser: async (parent, { userId }, context) => {
      if (!context.user?.is_super_admin) {
        throw new ForbiddenError('Super admin access required');
      }
      
      return await organizationService.impersonateUser(userId);
    }
  }
};

module.exports = superAdminResolvers;
```

## 💰 Sistema de Facturación

### 1. Integración con Stripe

```javascript
// src/services/billingService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query } = require('../config/database');

class BillingService {
  async createCustomer(organization) {
    const customer = await stripe.customers.create({
      name: organization.name,
      email: organization.billing_email,
      metadata: {
        organization_id: organization.id
      }
    });
    
    await query(
      'UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, organization.id]
    );
    
    return customer;
  }
  
  async createSubscription(organizationId, planId, paymentMethodId) {
    const org = await query(
      'SELECT * FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    const plan = await query(
      'SELECT * FROM subscription_plans WHERE id = $1',
      [planId]
    );
    
    if (!org.rows[0] || !plan.rows[0]) {
      throw new Error('Organization or plan not found');
    }
    
    const subscription = await stripe.subscriptions.create({
      customer: org.rows[0].stripe_customer_id,
      items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: plan.rows[0].name,
          },
          unit_amount: plan.rows[0].price_monthly * 100,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    
    // Guardar suscripción en BD
    await query(`
      INSERT INTO subscriptions (
        organization_id, plan_id, stripe_subscription_id, 
        status, current_period_start, current_period_end, amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      organizationId,
      planId,
      subscription.id,
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000),
      plan.rows[0].price_monthly
    ]);
    
    return subscription;
  }
  
  async handleWebhook(event) {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(event.data.object);
        break;
    }
  }
  
  async handlePaymentSucceeded(invoice) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    await query(`
      UPDATE organizations 
      SET subscription_status = 'active', expires_at = $1
      WHERE stripe_customer_id = $2
    `, [
      new Date(subscription.current_period_end * 1000),
      invoice.customer
    ]);
  }
  
  async getUsageMetrics(organizationId) {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT d.id) as device_count,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT r.id) as rule_count,
        COUNT(DISTINCT n.id) as notification_count_month
      FROM organizations o
      LEFT JOIN devices d ON o.id = d.organization_id
      LEFT JOIN users u ON o.id = u.organization_id
      LEFT JOIN rules r ON o.id = r.organization_id
      LEFT JOIN notifications n ON o.id = n.organization_id AND n.created_at > NOW() - INTERVAL '30 days'
      WHERE o.id = $1
      GROUP BY o.id
    `, [organizationId]);
    
    return result.rows[0];
  }
}

module.exports = new BillingService();
```

## 🛍️ Marketplace de Componentes Premium

### 1. Componentes Premium Disponibles

```javascript
// src/config/premiumComponents.js
const PREMIUM_COMPONENTS = {
  ai_prediction: {
    name: 'AI Prediction Engine',
    description: 'Predictive analytics for crop yield and equipment maintenance',
    price: 49,
    category: 'AI/ML',
    features: [
      'Yield prediction with 95% accuracy',
      'Equipment failure prediction',
      'Optimal harvest timing',
      'Resource optimization recommendations'
    ],
    requiredPlan: 'professional'
  },
  
  computer_vision: {
    name: 'Computer Vision Analysis',
    description: 'AI-powered plant health monitoring through image analysis',
    price: 79,
    category: 'AI/ML',
    features: [
      'Disease detection from images',
      'Growth stage identification',
      'Pest recognition',
      'Automated quality assessment'
    ],
    requiredPlan: 'professional'
  },
  
  advanced_analytics: {
    name: 'Advanced Analytics Dashboard',
    description: 'Executive-level insights and business intelligence',
    price: 29,
    category: 'Analytics',
    features: [
      'ROI calculation and tracking',
      'Predictive maintenance schedules',
      'Resource optimization insights',
      'Custom KPI definitions'
    ],
    requiredPlan: 'starter'
  },
  
  weather_integration: {
    name: 'Premium Weather Integration',
    description: 'Professional weather data with forecasting',
    price: 19,
    category: 'Integrations',
    features: [
      'Hyperlocal weather data',
      '14-day forecasting',
      'Historical weather analysis',
      'Weather-based automation'
    ],
    requiredPlan: 'starter'
  },
  
  market_prices: {
    name: 'Market Price Integration',
    description: 'Real-time commodity pricing and market trends',
    price: 39,
    category: 'Integrations',
    features: [
      'Real-time commodity prices',
      'Market trend analysis',
      'Optimal selling time predictions',
      'Profit margin calculations'
    ],
    requiredPlan: 'starter'
  }
};

module.exports = { PREMIUM_COMPONENTS };
```

### 2. Sistema de Componentes

```javascript
// src/services/componentService.js
const { PREMIUM_COMPONENTS } = require('../config/premiumComponents');
const { query } = require('../config/database');

class ComponentService {
  async getAvailableComponents(organizationId) {
    const org = await query(
      'SELECT plan_type FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    const enabledComponents = await query(
      'SELECT component_id FROM organization_components WHERE organization_id = $1 AND enabled = true',
      [organizationId]
    );
    
    const enabled = enabledComponents.rows.map(row => row.component_id);
    
    return Object.entries(PREMIUM_COMPONENTS).map(([id, component]) => ({
      id,
      ...component,
      enabled: enabled.includes(id),
      canEnable: this.canEnableComponent(org.rows[0].plan_type, component.requiredPlan)
    }));
  }
  
  async enableComponent(organizationId, componentId) {
    const component = PREMIUM_COMPONENTS[componentId];
    if (!component) throw new Error('Component not found');
    
    // Verificar plan
    const org = await query(
      'SELECT plan_type FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    if (!this.canEnableComponent(org.rows[0].plan_type, component.requiredPlan)) {
      throw new Error('Plan upgrade required for this component');
    }
    
    // Habilitar componente
    await query(`
      INSERT INTO organization_components (organization_id, component_id, enabled, enabled_at)
      VALUES ($1, $2, true, NOW())
      ON CONFLICT (organization_id, component_id) 
      DO UPDATE SET enabled = true, enabled_at = NOW()
    `, [organizationId, componentId]);
    
    return { success: true, component };
  }
  
  canEnableComponent(currentPlan, requiredPlan) {
    const planHierarchy = {
      free: 0,
      starter: 1,
      professional: 2,
      enterprise: 3
    };
    
    return planHierarchy[currentPlan] >= planHierarchy[requiredPlan];
  }
}

module.exports = new ComponentService();
```

## 🚀 Plan de Implementación

### Fase 1: Arquitectura Base (4-6 semanas)
1. **Semana 1-2**: Migración de base de datos multi-tenant
2. **Semana 3-4**: Sistema de autenticación y autorización
3. **Semana 5-6**: Middleware de límites y verificación

### Fase 2: Funcionalidades SaaS (6-8 semanas)
1. **Semana 1-2**: Panel de súper administrador
2. **Semana 3-4**: Sistema de organizaciones
3. **Semana 5-6**: Integración de facturación
4. **Semana 7-8**: Marketplace de componentes

### Fase 3: Componentes Premium (8-10 semanas)
1. **Semana 1-3**: Motor de IA básico
2. **Semana 4-6**: Computer Vision
3. **Semana 7-8**: Analytics avanzados
4. **Semana 9-10**: Integraciones premium

¿Te gustaría que comience implementando alguna fase específica o prefieres que desarrolle más detalles de algún componente en particular?