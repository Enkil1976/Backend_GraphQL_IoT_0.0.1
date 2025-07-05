require('dotenv').config();
const axios = require('axios');

async function testWeatherAPI() {
  const apiKey = process.env.WEATHER_API_KEY;
  const location = process.env.WEATHER_LOCATION;
  
  console.log('🌤️  Testing Weather API Configuration');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
  console.log('Location:', location);
  console.log('');

  if (!apiKey) {
    console.error('❌ WEATHER_API_KEY not configured');
    return;
  }

  try {
    console.log('📡 Fetching current weather data...');
    
    const response = await axios.get('http://api.weatherapi.com/v1/current.json', {
      params: {
        key: apiKey,
        q: location,
        aqi: 'yes',
        lang: 'es'
      },
      timeout: 10000
    });

    const data = response.data;
    
    console.log('✅ Weather API Test Successful!');
    console.log('');
    console.log('📍 Location:', data.location.name, data.location.region, data.location.country);
    console.log('🌡️  Temperature:', data.current.temp_c + '°C');
    console.log('💧 Humidity:', data.current.humidity + '%');
    console.log('🌤️  Condition:', data.current.condition.text);
    console.log('💨 Wind:', data.current.wind_kph + ' km/h', data.current.wind_dir);
    console.log('🔍 Visibility:', data.current.vis_km + ' km');
    console.log('☀️  UV Index:', data.current.uv);
    console.log('📊 Pressure:', data.current.pressure_mb + ' mb');
    
    if (data.current.air_quality) {
      console.log('🌫️  Air Quality:');
      console.log('   PM2.5:', data.current.air_quality.pm2_5);
      console.log('   PM10:', data.current.air_quality.pm10);
    }
    
    console.log('');
    console.log('🎉 Weather service is ready for GraphQL backend!');
    
  } catch (error) {
    console.error('❌ Weather API Test Failed:');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    
    if (error.response?.status === 401) {
      console.error('💡 Check if your WEATHER_API_KEY is correct');
    } else if (error.response?.status === 400) {
      console.error('💡 Check if your WEATHER_LOCATION is valid');
    }
  }
}

// Run the test
testWeatherAPI().catch(console.error);