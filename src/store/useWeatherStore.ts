import { create } from "zustand";
import {
  CityResult,
  MonthlyClimate,
  fetchLiveWeather,
  fetchMonthlyClimate,
} from "../lib/openMeteo";

// 1. Define the "shape" of our global state & actions
interface WeatherState {
  // Location & Mode
  city: CityResult | null;
  mode: "live" | "seasonal" | "custom";
  selectedMonth: number; // 0 = Jan, 11 = Dec
  monthlyClimate: MonthlyClimate[];
  isLoading: boolean;

  // Active 3D Diorama Parameters (driven by API OR user sliders)
  temperature: number;
  precipitation: number; // 0 to 100 intensity
  windSpeed: number;     // km/h
  cloudCover: number;    // 0 to 100%
  isDay: boolean;
  elevation: number;     // 3D mountain height multiplier
  seed: number;          // Random terrain shape seed

  // Actions (functions that update state)
  selectCity: (city: CityResult) => Promise<void>;
  setSelectedMonth: (month: number) => void;
  switchToLive: () => Promise<void>;
  setParam: <K extends keyof WeatherState>(key: K, value: WeatherState[K]) => void;
  randomizeSeed: () => void;
}

// 2. Create the Zustand store
export const useWeatherStore = create<WeatherState>((set, get) => ({
  // Default starting diorama (pleasant sunny hills)
  city: null,
  mode: "custom",
  selectedMonth: new Date().getMonth(),
  monthlyClimate: [],
  isLoading: false,

  temperature: 24,
  precipitation: 0,
  windSpeed: 12,
  cloudCover: 25,
  isDay: true,
  elevation: 2.5,
  seed: 42,

  // 3. Action: User picks a city from search -> fetch Live + 12-Month data at once
  selectCity: async (city) => {
    set({ city, isLoading: true });
    try {
      const [live, monthly] = await Promise.all([
        fetchLiveWeather(city.latitude, city.longitude),
        fetchMonthlyClimate(city.latitude, city.longitude),
      ]);

      // Adjust terrain height slightly based on the city's real elevation!
      const mappedElevation = Math.min(4.5, Math.max(1.2, 1.5 + city.elevation / 400));

      set({
        mode: "live",
        monthlyClimate: monthly,
        temperature: live.temperature,
        precipitation: Math.min(100, live.precipitation * 20), // Scale mm to 0-100 intensity
        windSpeed: live.windspeed,
        cloudCover: live.cloudcover,
        isDay: live.isDay,
        elevation: Number(mappedElevation.toFixed(1)),
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load city weather:", error);
      set({ isLoading: false });
    }
  },

  // 4. Action: User drags the Jan–Dec Month Slider
  setSelectedMonth: (month) => {
    const { monthlyClimate } = get();
    const monthStats = monthlyClimate[month];

    if (monthStats) {
      // Estimate cloud cover & rain intensity from monthly rainfall totals
      const rainIntensity = Math.min(100, Math.round(monthStats.total_rainfall / 3));
      const estimatedClouds = Math.min(100, Math.max(15, rainIntensity + 20));

      set({
        mode: "seasonal",
        selectedMonth: month,
        temperature: monthStats.average_temperature,
        precipitation: rainIntensity,
        windSpeed: monthStats.average_wind_speed,
        cloudCover: estimatedClouds,
        isDay: true,
      });
    } else {
      set({ mode: "seasonal", selectedMonth: month });
    }
  },

  // Re-fetch live weather if user switches back from Seasonal/Custom mode
  switchToLive: async () => {
    const { city } = get();
    if (!city) return;
    await get().selectCity(city);
  },

  // Generic helper so any UI slider can update a single parameter cleanly
  setParam: (key, value) => set({ [key]: value, mode: "custom" } as Partial<WeatherState>),

  randomizeSeed: () => set({ seed: Math.floor(Math.random() * 1000) }),
}));
