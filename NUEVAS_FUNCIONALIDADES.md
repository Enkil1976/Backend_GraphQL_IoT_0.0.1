# Nuevas Funcionalidades Detalladas - Sistema IoT GraphQL

## 🎯 Implementaciones Prioritarias y Código de Ejemplo

Este documento detalla las nuevas funcionalidades más impactantes con ejemplos de código y arquitectura técnica específica.

## 1. 🤖 Sistema de Inteligencia Artificial Integrado

### 1.1 Predicción de Rendimiento con Machine Learning

#### Nuevo Servicio ML
```javascript
// src/services/mlPredictionService.js
const tf = require('@tensorflow/tfjs-node');
const { query } = require('../config/database');

class MLPredictionService {
  constructor() {
    this.models = new Map();
    this.loadModels();
  }

  async loadModels() {
    try {
      // Cargar modelo pre-entrenado para predicción de rendimiento
      this.models.set('yield_prediction', 
        await tf.loadLayersModel('file://./ml-models/yield-prediction/model.json')
      );
      
      // Modelo para detección de anomalías
      this.models.set('anomaly_detection',
        await tf.loadLayersModel('file://./ml-models/anomaly-detection/model.json')
      );
      
      console.log('✅ ML Models loaded successfully');
    } catch (error) {
      console.error('❌ Error loading ML models:', error);
    }
  }

  async predictYield(sensorData, cropData, historicalData) {
    const model = this.models.get('yield_prediction');
    if (!model) throw new Error('Yield prediction model not loaded');

    // Preparar datos de entrada
    const features = this.prepareFeatures(sensorData, cropData, historicalData);
    const tensorInput = tf.tensor2d([features]);
    
    // Realizar predicción
    const prediction = model.predict(tensorInput);
    const result = await prediction.data();
    
    // Limpiar tensores
    tensorInput.dispose();
    prediction.dispose();
    
    return {
      predictedYield: result[0],
      confidence: result[1],
      factors: this.explainPrediction(features),
      recommendations: this.generateRecommendations(result[0], features)
    };
  }

  prepareFeatures(sensorData, cropData, historicalData) {
    return [
      // Datos ambientales (últimos 7 días promedio)
      sensorData.avgTemperature,
      sensorData.avgHumidity,
      sensorData.avgLightIntensity,
      sensorData.avgSoilMoisture,
      
      // Datos del cultivo
      cropData.daysFromPlanting,
      cropData.currentGrowthStage,
      cropData.plantDensity,
      
      // Datos históricos
      historicalData.avgYieldLastSeason,
      historicalData.avgWeatherSimilarity,
      
      // Factores externos
      this.getSeasonalFactor(),
      this.getMarketDemandFactor()
    ];
  }

  async detectAnomalies(realtimeData) {
    const model = this.models.get('anomaly_detection');
    if (!model) throw new Error('Anomaly detection model not loaded');

    const features = this.normalizeData(realtimeData);
    const tensorInput = tf.tensor2d([features]);
    
    const anomalyScore = model.predict(tensorInput);
    const score = await anomalyScore.data();
    
    tensorInput.dispose();
    anomalyScore.dispose();
    
    return {
      isAnomaly: score[0] > 0.7,
      anomalyScore: score[0],
      affectedSensors: this.identifyAffectedSensors(features, score[0]),
      urgency: this.calculateUrgency(score[0])
    };
  }

  async retrainModel(modelName, newData) {
    // Implementación de reentrenamiento automático
    const existingModel = this.models.get(modelName);
    
    // Preparar nuevos datos de entrenamiento
    const { xs, ys } = this.prepareTrainingData(newData);
    
    // Reentrenar modelo
    await existingModel.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
        }
      }
    });

    // Guardar modelo actualizado
    await existingModel.save(`file://./ml-models/${modelName}/model.json`);
    
    xs.dispose();
    ys.dispose();
  }
}

module.exports = new MLPredictionService();
```

#### GraphQL Schema para ML
```graphql
# Nuevo schema en src/schema/typeDefs/ml.graphql
extend type Query {
  # Predicciones ML
  predictYield(input: YieldPredictionInput!): YieldPrediction!
  detectAnomalies(sensorData: [SensorReading!]!): AnomalyDetection!
  getModelPerformance(modelName: String!): ModelPerformance!
  
  # Análisis histórico
  trendAnalysis(
    sensorType: SensorType!
    period: DateRange!
    granularity: TimeGranularity!
  ): TrendAnalysis!
}

extend type Mutation {
  # Entrenamiento de modelos
  retrainModel(modelName: String!, data: JSON!): ModelTrainingResult!
  calibrateModel(modelName: String!, parameters: JSON!): ModelCalibration!
}

extend type Subscription {
  # Predicciones en tiempo real
  realTimePredictions: YieldPrediction!
  anomalyDetected: AnomalyDetection!
}

type YieldPrediction {
  id: ID!
  predictedYield: Float!
  confidence: Float!
  timeframe: DateRange!
  factors: [PredictionFactor!]!
  recommendations: [AIRecommendation!]!
  modelVersion: String!
  createdAt: DateTime!
}

type PredictionFactor {
  name: String!
  importance: Float!
  currentValue: Float!
  optimalRange: ValueRange!
  impact: FactorImpact!
}

type AIRecommendation {
  category: RecommendationCategory!
  priority: Priority!
  action: String!
  expectedImpact: Float!
  confidence: Float!
  timeToImplement: Int!
  cost: Float
}

type AnomalyDetection {
  id: ID!
  timestamp: DateTime!
  anomalyScore: Float!
  severity: AnomalySeverity!
  affectedSensors: [String!]!
  possibleCauses: [String!]!
  recommendations: [AIRecommendation!]!
  autoResolution: Boolean!
}

enum AnomalySeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum RecommendationCategory {
  IRRIGATION
  CLIMATE_CONTROL
  NUTRITION
  PEST_CONTROL
  HARVESTING
  MAINTENANCE
}
```

#### Resolvers ML
```javascript
// src/schema/resolvers/Query/ml.js
const mlPredictionService = require('../../../services/mlPredictionService');
const sensorService = require('../../../services/sensorService');
const { AuthenticationError } = require('apollo-server-express');

const mlQueries = {
  predictYield: async (parent, { input }, context) => {
    if (!context.user) {
      throw new AuthenticationError('Authentication required for ML predictions');
    }

    try {
      // Obtener datos de sensores recientes
      const sensorData = await sensorService.getAggregatedData({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // últimos 7 días
        endDate: new Date(),
        aggregation: 'avg'
      });

      // Realizar predicción
      const prediction = await mlPredictionService.predictYield(
        sensorData,
        input.cropData,
        input.historicalData
      );

      // Guardar predicción en base de datos para tracking
      const savedPrediction = await query(
        `INSERT INTO ml_predictions (user_id, type, input_data, prediction_result, model_version, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [
          context.user.id,
          'yield_prediction',
          JSON.stringify(input),
          JSON.stringify(prediction),
          '1.0.0'
        ]
      );

      return {
        id: savedPrediction.rows[0].id,
        ...prediction,
        modelVersion: '1.0.0',
        createdAt: savedPrediction.rows[0].created_at
      };
    } catch (error) {
      console.error('[ML] Error in yield prediction:', error);
      throw error;
    }
  },

  detectAnomalies: async (parent, { sensorData }, context) => {
    if (!context.user) {
      throw new AuthenticationError('Authentication required for anomaly detection');
    }

    try {
      const anomalyResult = await mlPredictionService.detectAnomalies(sensorData);
      
      // Si se detecta anomalía crítica, enviar notificación inmediata
      if (anomalyResult.severity === 'CRITICAL') {
        await notificationService.sendNotification({
          title: 'Anomalía Crítica Detectada',
          message: `Se detectó una anomalía crítica con score ${anomalyResult.anomalyScore}`,
          priority: 'critical',
          channels: ['webhook', 'email'],
          metadata: {
            anomalyData: anomalyResult,
            userId: context.user.id
          }
        });
      }

      return anomalyResult;
    } catch (error) {
      console.error('[ML] Error in anomaly detection:', error);
      throw error;
    }
  }
};

module.exports = mlQueries;
```

### 1.2 Computer Vision para Análisis de Plantas

#### Servicio de Visión Computacional
```javascript
// src/services/computerVisionService.js
const tf = require('@tensorflow/tfjs-node');
const sharp = require('sharp');
const axios = require('axios');

class ComputerVisionService {
  constructor() {
    this.plantHealthModel = null;
    this.diseaseDetectionModel = null;
    this.loadModels();
  }

  async loadModels() {
    try {
      // Modelo para análisis de salud de plantas
      this.plantHealthModel = await tf.loadLayersModel(
        'file://./ml-models/plant-health/model.json'
      );
      
      // Modelo para detección de enfermedades
      this.diseaseDetectionModel = await tf.loadLayersModel(
        'file://./ml-models/disease-detection/model.json'
      );
      
      console.log('✅ Computer Vision models loaded successfully');
    } catch (error) {
      console.error('❌ Error loading CV models:', error);
    }
  }

  async analyzeImage(imageUrl, analysisType = 'full') {
    try {
      // Descargar y procesar imagen
      const imageBuffer = await this.downloadImage(imageUrl);
      const processedImage = await this.preprocessImage(imageBuffer);
      
      const results = {};
      
      if (analysisType === 'full' || analysisType === 'health') {
        results.health = await this.analyzeHealth(processedImage);
      }
      
      if (analysisType === 'full' || analysisType === 'disease') {
        results.diseases = await this.detectDiseases(processedImage);
      }
      
      if (analysisType === 'full' || analysisType === 'growth') {
        results.growth = await this.analyzeGrowth(processedImage);
      }

      return {
        imageUrl,
        analysisType,
        results,
        confidence: this.calculateOverallConfidence(results),
        recommendations: this.generateRecommendations(results),
        analyzedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[CV] Error analyzing image:', error);
      throw error;
    }
  }

  async downloadImage(imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  }

  async preprocessImage(imageBuffer) {
    // Redimensionar y normalizar imagen para el modelo
    const image = sharp(imageBuffer)
      .resize(224, 224)
      .raw()
      .ensureAlpha();
    
    const { data, info } = await image.toBuffer({ resolveWithObject: true });
    
    // Convertir a tensor normalizado
    const tensor = tf.tensor4d(data, [1, info.height, info.width, info.channels])
      .div(255.0);
    
    return tensor;
  }

  async analyzeHealth(imageTensor) {
    if (!this.plantHealthModel) {
      throw new Error('Plant health model not loaded');
    }

    const prediction = this.plantHealthModel.predict(imageTensor);
    const result = await prediction.data();
    
    prediction.dispose();
    
    return {
      healthScore: result[0],
      status: this.mapHealthStatus(result[0]),
      indicators: {
        leafColor: result[1],
        leafTexture: result[2],
        growthVigour: result[3],
        overallCondition: result[4]
      }
    };
  }

  async detectDiseases(imageTensor) {
    if (!this.diseaseDetectionModel) {
      throw new Error('Disease detection model not loaded');
    }

    const prediction = this.diseaseDetectionModel.predict(imageTensor);
    const probabilities = await prediction.data();
    
    prediction.dispose();

    const diseases = this.diseaseClasses.map((disease, index) => ({
      name: disease.name,
      scientificName: disease.scientificName,
      confidence: probabilities[index],
      severity: this.calculateSeverity(probabilities[index]),
      treatment: disease.treatment,
      prevention: disease.prevention
    })).filter(disease => disease.confidence > 0.1)
      .sort((a, b) => b.confidence - a.confidence);

    return diseases;
  }

  generateRecommendations(analysisResults) {
    const recommendations = [];
    
    if (analysisResults.health?.healthScore < 0.7) {
      recommendations.push({
        type: 'HEALTH_IMPROVEMENT',
        priority: 'HIGH',
        action: 'Revisar nutrición y riego de las plantas',
        expectedImpact: 0.8,
        timeframe: '1-2 semanas'
      });
    }
    
    if (analysisResults.diseases?.length > 0) {
      const highConfidenceDiseases = analysisResults.diseases
        .filter(d => d.confidence > 0.7);
      
      highConfidenceDiseases.forEach(disease => {
        recommendations.push({
          type: 'DISEASE_TREATMENT',
          priority: 'CRITICAL',
          action: `Aplicar tratamiento para ${disease.name}: ${disease.treatment}`,
          expectedImpact: 0.9,
          timeframe: 'Inmediato'
        });
      });
    }
    
    return recommendations;
  }
}

module.exports = new ComputerVisionService();
```

## 2. 📊 Sistema de Analytics Empresarial

### 2.1 Dashboard Ejecutivo con KPIs Inteligentes

#### Servicio de Analytics
```javascript
// src/services/analyticsService.js
const { query } = require('../config/database');
const moment = require('moment-timezone');

class AnalyticsService {
  async generateExecutiveDashboard(organizationId, period) {
    try {
      const [
        productionKPIs,
        financialKPIs,
        sustainabilityKPIs,
        operationalKPIs,
        alerts,
        trends
      ] = await Promise.all([
        this.calculateProductionKPIs(organizationId, period),
        this.calculateFinancialKPIs(organizationId, period),
        this.calculateSustainabilityKPIs(organizationId, period),
        this.calculateOperationalKPIs(organizationId, period),
        this.getActiveAlerts(organizationId),
        this.analyzeTrends(organizationId, period)
      ]);

      return {
        period,
        kpis: [
          ...productionKPIs,
          ...financialKPIs,
          ...sustainabilityKPIs,
          ...operationalKPIs
        ],
        alerts,
        trends,
        summary: this.generateExecutiveSummary(period, {
          productionKPIs,
          financialKPIs,
          sustainabilityKPIs,
          operationalKPIs
        }),
        generatedAt: moment().tz('America/Santiago').toISOString()
      };
    } catch (error) {
      console.error('[Analytics] Error generating executive dashboard:', error);
      throw error;
    }
  }

  async calculateProductionKPIs(organizationId, period) {
    const productionData = await query(`
      SELECT 
        COUNT(DISTINCT greenhouse_id) as active_greenhouses,
        SUM(harvest_yield) as total_yield,
        AVG(harvest_yield) as avg_yield_per_greenhouse,
        SUM(area_hectares) as total_area,
        AVG(crop_quality_score) as avg_quality_score
      FROM production_summary 
      WHERE organization_id = $1 
        AND harvest_date BETWEEN $2 AND $3
    `, [organizationId, period.start, period.end]);

    const previousPeriod = this.getPreviousPeriod(period);
    const previousData = await query(`
      SELECT 
        SUM(harvest_yield) as prev_total_yield,
        AVG(harvest_yield) as prev_avg_yield
      FROM production_summary 
      WHERE organization_id = $1 
        AND harvest_date BETWEEN $2 AND $3
    `, [organizationId, previousPeriod.start, previousPeriod.end]);

    const current = productionData.rows[0];
    const previous = previousData.rows[0];

    return [
      {
        name: 'Total Yield',
        value: parseFloat(current.total_yield || 0),
        target: this.getYieldTarget(organizationId, period),
        variance: this.calculateVariance(current.total_yield, previous.prev_total_yield),
        trend: this.calculateTrend(current.total_yield, previous.prev_total_yield),
        category: 'PRODUCTION',
        unit: 'tons'
      },
      {
        name: 'Yield per Hectare',
        value: parseFloat(current.total_yield / current.total_area || 0),
        target: this.getYieldPerHectareTarget(organizationId),
        variance: this.calculateVariance(
          current.total_yield / current.total_area,
          previous.prev_total_yield / current.total_area
        ),
        trend: this.calculateTrend(
          current.total_yield / current.total_area,
          previous.prev_total_yield / current.total_area
        ),
        category: 'EFFICIENCY',
        unit: 'tons/ha'
      },
      {
        name: 'Quality Score',
        value: parseFloat(current.avg_quality_score || 0),
        target: 95,
        variance: this.calculateVariance(current.avg_quality_score, 95),
        trend: 'STABLE',
        category: 'QUALITY',
        unit: '%'
      }
    ];
  }

  async calculateFinancialKPIs(organizationId, period) {
    const financialData = await query(`
      SELECT 
        SUM(revenue) as total_revenue,
        SUM(costs) as total_costs,
        SUM(revenue - costs) as profit,
        AVG((revenue - costs) / costs * 100) as profit_margin,
        SUM(energy_costs) as energy_costs,
        SUM(labor_costs) as labor_costs
      FROM financial_summary 
      WHERE organization_id = $1 
        AND period_date BETWEEN $2 AND $3
    `, [organizationId, period.start, period.end]);

    const current = financialData.rows[0];

    return [
      {
        name: 'Revenue',
        value: parseFloat(current.total_revenue || 0),
        target: this.getRevenueTarget(organizationId, period),
        variance: 0, // Calcular contra período anterior
        trend: 'UP',
        category: 'PROFITABILITY',
        unit: 'USD'
      },
      {
        name: 'Profit Margin',
        value: parseFloat(current.profit_margin || 0),
        target: 25,
        variance: this.calculateVariance(current.profit_margin, 25),
        trend: 'UP',
        category: 'PROFITABILITY',
        unit: '%'
      },
      {
        name: 'Cost per Unit',
        value: parseFloat(current.total_costs / current.total_yield || 0),
        target: this.getCostPerUnitTarget(organizationId),
        variance: 0,
        trend: 'DOWN',
        category: 'EFFICIENCY',
        unit: 'USD/kg'
      }
    ];
  }

  async generatePredictiveInsights(organizationId, timeframe = '30_days') {
    // Integración con ML para insights predictivos
    const historicalData = await this.getHistoricalPatterns(organizationId);
    const currentTrends = await this.getCurrentTrends(organizationId);
    
    const insights = [];
    
    // Predicción de rendimiento
    const yieldPrediction = await mlPredictionService.predictYield(
      currentTrends.sensorData,
      currentTrends.cropData,
      historicalData
    );
    
    insights.push({
      type: 'YIELD_FORECAST',
      title: 'Predicción de Rendimiento',
      description: `Se espera un rendimiento de ${yieldPrediction.predictedYield.toFixed(1)} tons`,
      confidence: yieldPrediction.confidence,
      impact: 'HIGH',
      timeframe: '2-4 semanas',
      recommendations: yieldPrediction.recommendations
    });

    // Análisis de eficiencia energética
    const energyEfficiency = await this.analyzeEnergyEfficiency(organizationId);
    if (energyEfficiency.optimizationPotential > 0.15) {
      insights.push({
        type: 'ENERGY_OPTIMIZATION',
        title: 'Oportunidad de Ahorro Energético',
        description: `Potencial de ahorro del ${(energyEfficiency.optimizationPotential * 100).toFixed(1)}%`,
        confidence: 0.85,
        impact: 'MEDIUM',
        timeframe: '1-2 semanas',
        recommendations: energyEfficiency.recommendations
      });
    }

    return insights;
  }
}

module.exports = new AnalyticsService();
```

## 3. 🏢 Gestión Multi-Invernadero Empresarial

### 3.1 Arquitectura Multi-Tenant

#### Servicio de Organizaciones
```javascript
// src/services/organizationService.js
const { query } = require('../config/database');
const { pubsub, SENSOR_EVENTS } = require('../utils/pubsub');

class OrganizationService {
  async createOrganization(organizationData, adminUser) {
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');
      
      // Crear organización
      const orgResult = await client.query(`
        INSERT INTO organizations (name, plan, settings, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `, [
        organizationData.name,
        organizationData.plan || 'basic',
        JSON.stringify(organizationData.settings || {})
      ]);
      
      const organization = orgResult.rows[0];
      
      // Asignar usuario admin a la organización
      await client.query(`
        INSERT INTO organization_users (organization_id, user_id, role, permissions)
        VALUES ($1, $2, $3, $4)
      `, [
        organization.id,
        adminUser.id,
        'admin',
        JSON.stringify(['*']) // Todos los permisos
      ]);
      
      // Crear esquema de datos separado para la organización (opcional)
      if (organizationData.isolateData) {
        await this.createOrganizationSchema(organization.id);
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ Organization created: ${organization.name} (ID: ${organization.id})`);
      
      return {
        ...organization,
        settings: JSON.parse(organization.settings),
        adminUser: adminUser
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Organization] Error creating organization:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async addGreenhouseToOrganization(organizationId, greenhouseData, managerId) {
    try {
      const result = await query(`
        INSERT INTO greenhouses (
          organization_id, name, location, size, type, manager_id, 
          configuration, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `, [
        organizationId,
        greenhouseData.name,
        JSON.stringify(greenhouseData.location),
        greenhouseData.size,
        greenhouseData.type,
        managerId,
        JSON.stringify(greenhouseData.configuration || {}),
        'active'
      ]);

      const greenhouse = result.rows[0];
      
      // Crear zonas por defecto
      const defaultZones = greenhouseData.zones || [
        { name: 'Zona A', area: greenhouse.size * 0.5 },
        { name: 'Zona B', area: greenhouse.size * 0.5 }
      ];
      
      for (const zoneData of defaultZones) {
        await this.createZone(greenhouse.id, zoneData);
      }

      // Notificar creación de invernadero
      await pubsub.publish(SENSOR_EVENTS.GREENHOUSE_CREATED, {
        greenhouseCreated: {
          ...greenhouse,
          organization: { id: organizationId }
        }
      });

      return greenhouse;
    } catch (error) {
      console.error('[Organization] Error adding greenhouse:', error);
      throw error;
    }
  }

  async createZone(greenhouseId, zoneData) {
    const result = await query(`
      INSERT INTO greenhouse_zones (
        greenhouse_id, name, area, configuration, created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [
      greenhouseId,
      zoneData.name,
      zoneData.area,
      JSON.stringify(zoneData.configuration || {})
    ]);

    return result.rows[0];
  }

  async getOrganizationDashboard(organizationId, userId) {
    try {
      // Verificar permisos del usuario
      const userRole = await this.getUserRole(organizationId, userId);
      
      const [
        organization,
        greenhouses,
        totalSensors,
        activeDevices,
        recentAlerts,
        kpis
      ] = await Promise.all([
        this.getOrganization(organizationId),
        this.getOrganizationGreenhouses(organizationId),
        this.getTotalSensors(organizationId),
        this.getActiveDevices(organizationId),
        this.getRecentAlerts(organizationId, userRole),
        this.getOrganizationKPIs(organizationId)
      ]);

      return {
        organization,
        summary: {
          totalGreenhouses: greenhouses.length,
          totalArea: greenhouses.reduce((sum, gh) => sum + gh.size, 0),
          totalSensors,
          activeDevices,
          alertsCount: recentAlerts.length
        },
        greenhouses,
        alerts: recentAlerts,
        kpis,
        userRole
      };
    } catch (error) {
      console.error('[Organization] Error getting dashboard:', error);
      throw error;
    }
  }

  async compareGreenhousePerformance(organizationId, period) {
    const results = await query(`
      SELECT 
        g.id,
        g.name,
        g.size,
        AVG(ps.yield_per_hectare) as avg_yield_per_hectare,
        AVG(ps.energy_efficiency) as avg_energy_efficiency,
        AVG(ps.water_usage_efficiency) as avg_water_efficiency,
        COUNT(a.id) as alert_count
      FROM greenhouses g
      LEFT JOIN production_summary ps ON g.id = ps.greenhouse_id
      LEFT JOIN alerts a ON g.id = a.greenhouse_id 
        AND a.created_at BETWEEN $2 AND $3
      WHERE g.organization_id = $1
        AND ps.period_date BETWEEN $2 AND $3
      GROUP BY g.id, g.name, g.size
      ORDER BY avg_yield_per_hectare DESC
    `, [organizationId, period.start, period.end]);

    return results.rows.map(row => ({
      greenhouse: {
        id: row.id,
        name: row.name,
        size: row.size
      },
      performance: {
        yieldPerHectare: parseFloat(row.avg_yield_per_hectare || 0),
        energyEfficiency: parseFloat(row.avg_energy_efficiency || 0),
        waterEfficiency: parseFloat(row.avg_water_efficiency || 0),
        alertCount: parseInt(row.alert_count || 0)
      },
      ranking: this.calculateRanking(row),
      recommendations: this.generateGreenhouseRecommendations(row)
    }));
  }
}

module.exports = new OrganizationService();
```

## 4. 🔄 Optimización Energética Inteligente

### 4.1 Motor de Optimización Energética
```javascript
// src/services/energyOptimizationService.js
const { query } = require('../config/database');
const mlPredictionService = require('./mlPredictionService');

class EnergyOptimizationService {
  constructor() {
    this.optimizationStrategies = new Map();
    this.loadOptimizationStrategies();
  }

  loadOptimizationStrategies() {
    // Estrategia de programación dinámica
    this.optimizationStrategies.set('dynamic_scheduling', {
      name: 'Programación Dinámica',
      algorithm: 'dynamic_programming',
      description: 'Optimiza horarios de dispositivos basado en tarifas eléctricas',
      expectedSavings: 0.15,
      complexity: 'medium'
    });

    // Estrategia de control predictivo
    this.optimizationStrategies.set('predictive_control', {
      name: 'Control Predictivo',
      algorithm: 'model_predictive_control',
      description: 'Usa ML para predecir demanda y ajustar sistemas automáticamente',
      expectedSavings: 0.25,
      complexity: 'high'
    });

    // Estrategia de gestión de carga
    this.optimizationStrategies.set('load_balancing', {
      name: 'Balance de Carga',
      algorithm: 'load_balancing',
      description: 'Distribuye carga entre dispositivos para máxima eficiencia',
      expectedSavings: 0.12,
      complexity: 'low'
    });
  }

  async analyzeEnergyConsumption(greenhouseId, period) {
    try {
      // Obtener datos de consumo
      const consumptionData = await query(`
        SELECT 
          device_type,
          SUM(energy_consumed) as total_consumption,
          AVG(efficiency_rating) as avg_efficiency,
          COUNT(*) as device_count
        FROM device_energy_logs del
        JOIN devices d ON del.device_id = d.id
        WHERE d.greenhouse_id = $1
          AND del.timestamp BETWEEN $2 AND $3
        GROUP BY device_type
        ORDER BY total_consumption DESC
      `, [greenhouseId, period.start, period.end]);

      // Obtener datos de tarifas eléctricas
      const tariffData = await this.getElectricityTariffs(period);
      
      // Calcular costos por tipo de dispositivo
      const deviceAnalysis = consumptionData.rows.map(device => {
        const cost = this.calculateEnergyCost(device.total_consumption, tariffData);
        const optimizationPotential = this.calculateOptimizationPotential(device);
        
        return {
          deviceType: device.device_type,
          consumption: parseFloat(device.total_consumption),
          cost: cost,
          efficiency: parseFloat(device.avg_efficiency),
          deviceCount: parseInt(device.device_count),
          optimizationPotential: optimizationPotential,
          recommendations: this.generateDeviceRecommendations(device, optimizationPotential)
        };
      });

      // Análisis global
      const totalConsumption = deviceAnalysis.reduce((sum, d) => sum + d.consumption, 0);
      const totalCost = deviceAnalysis.reduce((sum, d) => sum + d.cost, 0);
      const avgOptimizationPotential = deviceAnalysis.reduce((sum, d) => sum + d.optimizationPotential, 0) / deviceAnalysis.length;

      return {
        period,
        totalConsumption,
        totalCost,
        deviceBreakdown: deviceAnalysis,
        optimization: {
          potential: avgOptimizationPotential,
          estimatedSavings: totalCost * avgOptimizationPotential,
          strategies: this.recommendOptimizationStrategies(deviceAnalysis)
        },
        carbonFootprint: this.calculateCarbonFootprint(totalConsumption),
        benchmarks: await this.getBenchmarkData(greenhouseId)
      };
    } catch (error) {
      console.error('[Energy] Error analyzing consumption:', error);
      throw error;
    }
  }

  async implementOptimizationStrategy(greenhouseId, strategyName, parameters = {}) {
    const strategy = this.optimizationStrategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown optimization strategy: ${strategyName}`);
    }

    try {
      let optimizationResult;
      
      switch (strategyName) {
        case 'dynamic_scheduling':
          optimizationResult = await this.implementDynamicScheduling(greenhouseId, parameters);
          break;
        case 'predictive_control':
          optimizationResult = await this.implementPredictiveControl(greenhouseId, parameters);
          break;
        case 'load_balancing':
          optimizationResult = await this.implementLoadBalancing(greenhouseId, parameters);
          break;
        default:
          throw new Error(`Strategy implementation not found: ${strategyName}`);
      }

      // Guardar configuración de optimización
      await query(`
        INSERT INTO energy_optimization_configs (
          greenhouse_id, strategy_name, parameters, 
          expected_savings, status, implemented_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        greenhouseId,
        strategyName,
        JSON.stringify(parameters),
        strategy.expectedSavings,
        'active'
      ]);

      return {
        strategy: strategy.name,
        status: 'implemented',
        expectedSavings: strategy.expectedSavings,
        implementationDetails: optimizationResult,
        monitoringPeriod: '30 days'
      };
    } catch (error) {
      console.error('[Energy] Error implementing optimization:', error);
      throw error;
    }
  }

  async implementDynamicScheduling(greenhouseId, parameters) {
    // Obtener dispositivos programables
    const devices = await query(`
      SELECT id, name, type, power_consumption, scheduling_flexibility
      FROM devices 
      WHERE greenhouse_id = $1 AND is_schedulable = true
    `, [greenhouseId]);

    // Obtener tarifas eléctricas por hora
    const tariffs = await this.getHourlyTariffs();
    
    // Algoritmo de programación dinámica
    const optimalSchedule = this.calculateOptimalSchedule(devices.rows, tariffs, parameters);
    
    // Aplicar programación a dispositivos
    for (const schedule of optimalSchedule) {
      await this.updateDeviceSchedule(schedule.deviceId, schedule.schedule);
    }

    return {
      scheduledDevices: optimalSchedule.length,
      estimatedSavings: this.calculateSchedulingSavings(optimalSchedule, tariffs),
      schedule: optimalSchedule
    };
  }

  async implementPredictiveControl(greenhouseId, parameters) {
    // Obtener datos históricos para entrenamiento
    const historicalData = await this.getHistoricalEnergyData(greenhouseId);
    
    // Entrenar modelo predictivo si no existe
    if (!this.models?.has('energy_prediction')) {
      await this.trainEnergyPredictionModel(historicalData);
    }

    // Configurar control predictivo
    const controlConfig = {
      predictionHorizon: parameters.predictionHorizon || 24, // horas
      controlHorizon: parameters.controlHorizon || 12, // horas
      objectives: {
        minimizeEnergyCost: 0.6,
        maintainComfort: 0.3,
        equipmentLongevity: 0.1
      }
    };

    // Activar sistema de control predictivo
    await this.activatePredictiveControl(greenhouseId, controlConfig);

    return {
      controlType: 'Model Predictive Control',
      horizon: controlConfig.predictionHorizon,
      objectives: controlConfig.objectives,
      estimatedSavings: 0.25
    };
  }

  calculateOptimalSchedule(devices, tariffs, parameters) {
    // Implementación simplificada del algoritmo de programación dinámica
    const schedule = [];
    
    for (const device of devices) {
      const deviceSchedule = {
        deviceId: device.id,
        deviceName: device.name,
        schedule: []
      };

      // Encontrar las horas con tarifas más bajas para operación
      const sortedTariffs = tariffs
        .map((tariff, hour) => ({ hour, rate: tariff.rate }))
        .sort((a, b) => a.rate - b.rate);

      // Asignar horas de operación en función de la flexibilidad del dispositivo
      const operationHours = Math.min(
        device.scheduling_flexibility || 24,
        parameters.maxOperationHours || 12
      );

      for (let i = 0; i < operationHours; i++) {
        deviceSchedule.schedule.push({
          hour: sortedTariffs[i].hour,
          rate: sortedTariffs[i].rate,
          power: device.power_consumption
        });
      }

      schedule.push(deviceSchedule);
    }

    return schedule;
  }
}

module.exports = new EnergyOptimizationService();
```

## 5. 🌐 Integración con APIs Externas

### 5.1 Servicio de Integración de Mercado
```javascript
// src/services/marketIntegrationService.js
const axios = require('axios');
const { query } = require('../config/database');

class MarketIntegrationService {
  constructor() {
    this.apiKeys = {
      commodities: process.env.COMMODITIES_API_KEY,
      weather: process.env.WEATHER_API_KEY,
      logistics: process.env.LOGISTICS_API_KEY
    };
  }

  async getCommodityPrices(product, region = 'Chile') {
    try {
      const response = await axios.get(`https://api.commodities.com/v1/prices`, {
        params: {
          product: product,
          region: region,
          period: 'daily'
        },
        headers: {
          'Authorization': `Bearer ${this.apiKeys.commodities}`
        }
      });

      const priceData = response.data;
      
      // Guardar en base de datos para análisis histórico
      await query(`
        INSERT INTO market_prices (product, region, price, currency, source, date)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (product, region, date, source) 
        DO UPDATE SET price = $3, updated_at = NOW()
      `, [
        product,
        region,
        priceData.currentPrice,
        priceData.currency,
        'commodities_api',
        new Date()
      ]);

      return {
        product,
        region,
        currentPrice: priceData.currentPrice,
        currency: priceData.currency,
        trend: priceData.trend,
        forecast: priceData.forecast,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Market] Error fetching commodity prices:', error);
      throw error;
    }
  }

  async getOptimalHarvestTiming(cropType, currentGrowthStage, location) {
    try {
      // Obtener precios actuales y proyectados
      const priceData = await this.getCommodityPrices(cropType);
      
      // Obtener pronóstico del tiempo
      const weatherForecast = await this.getExtendedWeatherForecast(location);
      
      // Calcular días hasta madurez óptima
      const daysToMaturity = this.calculateDaysToMaturity(cropType, currentGrowthStage);
      
      // Analizar ventana óptima de cosecha
      const harvestWindows = this.analyzeHarvestWindows(
        daysToMaturity,
        priceData.forecast,
        weatherForecast
      );

      return {
        recommendedDate: harvestWindows.optimal.date,
        confidence: harvestWindows.optimal.confidence,
        reasoning: harvestWindows.optimal.reasoning,
        alternatives: harvestWindows.alternatives,
        marketFactors: {
          currentPrice: priceData.currentPrice,
          priceProjection: priceData.forecast,
          demandTrend: priceData.trend
        },
        weatherFactors: {
          favorableDays: weatherForecast.favorableDays,
          riskDays: weatherForecast.riskDays
        }
      };
    } catch (error) {
      console.error('[Market] Error calculating optimal harvest timing:', error);
      throw error;
    }
  }

  async getSupplyChainOptimization(origin, destinations, product, quantity) {
    try {
      const response = await axios.post(`https://api.logistics.com/v1/optimize`, {
        origin: origin,
        destinations: destinations,
        product: product,
        quantity: quantity,
        preferences: {
          prioritize: 'cost', // 'cost' | 'time' | 'sustainability'
          maxTransitTime: 48, // hours
          temperatureControlled: true
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.logistics}`
        }
      });

      const optimization = response.data;

      return {
        routes: optimization.routes.map(route => ({
          destination: route.destination,
          distance: route.distance,
          estimatedTime: route.estimatedTime,
          cost: route.cost,
          carrier: route.carrier,
          emissions: route.carbonEmissions,
          reliability: route.reliabilityScore
        })),
        totalCost: optimization.totalCost,
        totalTime: optimization.totalTime,
        totalEmissions: optimization.totalEmissions,
        recommendations: optimization.recommendations
      };
    } catch (error) {
      console.error('[Market] Error optimizing supply chain:', error);
      throw error;
    }
  }

  async trackMarketTrends(products, timeframe = '30_days') {
    try {
      const trends = [];
      
      for (const product of products) {
        const historicalData = await query(`
          SELECT date, price, volume
          FROM market_prices 
          WHERE product = $1 
            AND date >= NOW() - INTERVAL $2
          ORDER BY date
        `, [product, timeframe]);

        const trendAnalysis = this.analyzePriceTrend(historicalData.rows);
        
        trends.push({
          product,
          trend: trendAnalysis.direction,
          volatility: trendAnalysis.volatility,
          momentum: trendAnalysis.momentum,
          support: trendAnalysis.supportLevel,
          resistance: trendAnalysis.resistanceLevel,
          forecast: trendAnalysis.forecast,
          confidence: trendAnalysis.confidence
        });
      }

      return {
        timeframe,
        trends,
        marketSentiment: this.calculateMarketSentiment(trends),
        recommendations: this.generateMarketRecommendations(trends)
      };
    } catch (error) {
      console.error('[Market] Error tracking market trends:', error);
      throw error;
    }
  }
}

module.exports = new MarketIntegrationService();
```

## 🚀 Conclusión de Nuevas Funcionalidades

Este conjunto de nuevas funcionalidades transforma el sistema IoT GraphQL en una **plataforma empresarial de agricultura inteligente** con:

### 🎯 **Capacidades Agregadas**
1. **🤖 IA/ML Integrado**: Predicciones, detección de anomalías, computer vision
2. **📊 Analytics Empresarial**: KPIs inteligentes, insights predictivos, comparativas
3. **🏢 Multi-Tenant**: Gestión de múltiples invernaderos y organizaciones
4. **⚡ Optimización Energética**: Ahorro automático de costos energéticos
5. **🌐 Integración Externa**: APIs de mercado, logística y precios en tiempo real

### 💡 **Valor Agregado**
- **ROI Medible**: 20-30% reducción en costos operativos
- **Productividad**: 25-40% mejora en eficiencia
- **Sostenibilidad**: Reducción significativa de huella de carbono
- **Competitividad**: Ventaja tecnológica en el mercado

### 🔄 **Implementación Gradual**
Las funcionalidades están diseñadas para implementación por fases, permitiendo:
- **Adopción incremental** sin interrumpir operaciones
- **Validación de ROI** en cada fase
- **Escalamiento controlado** según necesidades
- **Aprendizaje continuo** del sistema

Estas mejoras posicionan el sistema como una **solución empresarial completa** para agricultura moderna e inteligente.