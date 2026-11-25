export interface CityResult {
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface LiveWeather {
  temperature: number;
  windspeed: number;
  winddirection: number;
  cloudcover: number;
  precipitation: number;
  isDay: boolean;
}

export interface MonthlyClimate {
  month: number; // 1 = Jan, 12 = Dec
  average_temperature: number;
  total_rainfall: number;
  average_humidity: number;
  average_wind_speed: number;
}

export async function searchCity(query: string): Promise<CityResult[]> {
  if (!query.trim()) return [];

  const apiUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=5&language=en&format=json`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Error fetching city data: ${response.statusText}`);
  }
  const data = await response.json();
  return data.results || [];
}

export async function fetchLiveWeather(
  latitude: number,
  longitude: number
): Promise<LiveWeather> {
  // Using modern &current=... so cloud_cover and precipitation are actually returned!
  const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,is_day,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Error fetching live weather data: ${response.statusText}`);
  }
  const data = await response.json();
  const curr = data.current;
  if (!curr) {
    throw new Error("Current weather data is not available.");
  }

  return {
    temperature: curr.temperature_2m,
    windspeed: curr.wind_speed_10m,
    winddirection: curr.wind_direction_10m,
    cloudcover: curr.cloud_cover,
    precipitation: curr.precipitation,
    isDay: curr.is_day === 1,
  };
}

export async function fetchMonthlyClimate(
  latitude: number,
  longitude: number
): Promise<MonthlyClimate[]> {
  const apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=2025-01-01&end_date=2025-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max&timezone=auto`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Error fetching monthly climate data: ${response.statusText}`);
  }
  const data = await response.json();
  const dailyData = data.daily;
  if (!dailyData) {
    throw new Error("Daily climate data is not available.");
  }
    const monthlyData: MonthlyClimate[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    average_temperature: 0,
    total_rainfall: 0,
    average_humidity: 0,
    average_wind_speed: 0,
  }));

  const dayCounts = new Array(12).fill(0);

  for (let i = 0; i < dailyData.time.length; i++) {
    // Parse "YYYY-MM-DD" safely without UTC timezone shift
    const monthIndex = Number(dailyData.time[i].split("-")[1]) - 1;
    if (monthIndex < 0 || monthIndex > 11) continue;

    dayCounts[monthIndex]++;

    const maxT = dailyData.temperature_2m_max[i] ?? 20;
    const minT = dailyData.temperature_2m_min[i] ?? 20;

    monthlyData[monthIndex].average_temperature += (maxT + minT) / 2;
    monthlyData[monthIndex].total_rainfall += dailyData.precipitation_sum[i] ?? 0;
    monthlyData[monthIndex].average_humidity += dailyData.relative_humidity_2m_mean[i] ?? 50;
    monthlyData[monthIndex].average_wind_speed += dailyData.wind_speed_10m_max[i] ?? 10;
  }

  for (let i = 0; i < 12; i++) {
    const count = dayCounts[i] || 1;
    monthlyData[i].average_temperature = Number((monthlyData[i].average_temperature / count).toFixed(1));
    monthlyData[i].total_rainfall = Number(monthlyData[i].total_rainfall.toFixed(1));
    monthlyData[i].average_humidity = Math.round(monthlyData[i].average_humidity / count);
    monthlyData[i].average_wind_speed = Number((monthlyData[i].average_wind_speed / count).toFixed(1));
  }

  return monthlyData;
}
