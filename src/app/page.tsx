"use client";

import { FormEvent, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, Stars } from "@react-three/drei";
import {
  Cloud,
  CloudSun,
  Droplets,
  LoaderCircle,
  MapPin,
  Moon,
  Mountain,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Wind,
  X,
} from "lucide-react";
import TerrainMesh from "../components/scene/TerrainMesh";
import { CityResult, searchCity } from "../lib/openMeteo";
import { useWeatherStore } from "../store/useWeatherStore";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Home() {
  const {
    city,
    mode,
    selectedMonth,
    monthlyClimate,
    isLoading,
    temperature,
    precipitation,
    windSpeed,
    cloudCover,
    isDay,
    elevation,
    setParam,
    selectCity,
    setSelectedMonth,
    switchToLive,
    randomizeSeed,
  } = useWeatherStore();

  const [query, setQuery] = useState("");
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  function resetWeatherSettings() {
    setParam("temperature", 24);
    setParam("precipitation", 0);
    setParam("windSpeed", 12);
    setParam("cloudCover", 25);
    setParam("elevation", 2.5);
    setParam("isDay", true);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError("");
    try {
      const results = await searchCity(query);
      setCityResults(results);
      if (results.length === 0) setSearchError("No matching places found. Try another city.");
    } catch (error) {
      console.error("Could not search for a city:", error);
      setSearchError("City search is unavailable right now. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCitySelect(result: CityResult) {
    setQuery(`${result.name}, ${result.country}`);
    setCityResults([]);
    await selectCity(result);
  }

  return (
    <main className="terra-app">
      <div className="scene-backdrop" aria-hidden="true" />
      <Canvas
        className="terrain-canvas"
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [10, 8, 12], fov: 40 }}
      >
        <color attach="background" args={[isDay ? "#b9dbe5" : "#07111f"]} />
        <fog attach="fog" args={[isDay ? "#b9dbe5" : "#07111f", 18, 38]} />
        {isDay ? (
          <Sky sunPosition={[10, 8, 10]} turbidity={8} rayleigh={1.5} />
        ) : (
          <Stars radius={70} depth={40} count={1200} factor={3} fade />
        )}
        <ambientLight intensity={isDay ? 0.72 : 0.28} />
        <directionalLight
          position={[10, 15, 8]}
          intensity={isDay ? 2 : 0.55}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <TerrainMesh />
        <OrbitControls
          makeDefault
          target={[0, 0.4, 0]}
          minDistance={8}
          maxDistance={21}
          maxPolarAngle={Math.PI / 2.05}
          enableDamping
          dampingFactor={0.06}
        />
      </Canvas>

      <header className="topbar">
        <a className="brand" href="/" aria-label="TerraCast 3D home">
          <span className="brand-mark"><Mountain size={19} strokeWidth={2.2} /></span>
          <span className="brand-name">terra<span>cast</span></span>
          <span className="brand-version">3D</span>
        </a>
        <div className="topbar-center">
          <span className="live-indicator" />
          <span>{mode === "live" ? "LIVE WEATHER" : mode === "seasonal" ? "SEASONAL VIEW" : "TERRAIN STUDIO"}</span>
          {city && <span className="topbar-location"><MapPin size={12} /> {city.name}</span>}
        </div>
        <button
          type="button"
          className="icon-button topbar-reset"
          onClick={randomizeSeed}
          aria-label="Generate a new island"
          title="Generate a new island"
        >
          <RotateCcw size={16} />
        </button>
      </header>

      <section className="left-panel spatial-glass" aria-label="Location and weather">
        <div className="panel-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" /> YOUR WEATHER WORLD</p>
            <h1>{city ? city.name : "A world of your own"}</h1>
            <p className="location-subtitle">
              {city ? `${city.country} · ${city.latitude.toFixed(2)}°, ${city.longitude.toFixed(2)}°` : "Explore a living landscape"}
            </p>
          </div>
          <span className="weather-icon">{isDay ? <CloudSun size={24} /> : <Moon size={21} />}</span>
        </div>

        <div className="temperature-block">
          <span className="temperature-value">{Math.round(temperature)}<span>°</span></span>
          <div className="temperature-meta">
            <span>{isDay ? "Daytime" : "Nighttime"} conditions</span>
            <span className="feels-like"><span className="condition-dot" /> {temperature <= 0 ? "Freezing" : temperature < 12 ? "Chilly" : temperature < 25 ? "Mild and pleasant" : "Warm and sunny"}</span>
          </div>
        </div>

        <div className="weather-stats">
          <div className="weather-stat">
            <span className="stat-icon wind-icon"><Wind size={16} /></span>
            <span className="stat-copy"><strong>{Math.round(windSpeed)}<small> km/h</small></strong><span>Wind</span></span>
          </div>
          <div className="weather-stat">
            <span className="stat-icon rain-icon"><Droplets size={16} /></span>
            <span className="stat-copy"><strong>{Math.round(precipitation)}<small>%</small></strong><span>Precipitation</span></span>
          </div>
          <div className="weather-stat">
            <span className="stat-icon cloud-icon"><Cloud size={16} /></span>
            <span className="stat-copy"><strong>{Math.round(cloudCover)}<small>%</small></strong><span>Cloud cover</span></span>
          </div>
        </div>

        <div className="panel-divider" />

        <div className="search-section">
          <div className="section-title-row">
            <span className="section-title">Explore a location</span>
            <span className="section-caption">LIVE WEATHER</span>
          </div>
          <form className="city-search" onSubmit={handleSearch}>
            <Search size={16} className="search-icon" />
            <input
              aria-label="Search for a city"
              placeholder="Search any city..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (cityResults.length) setCityResults([]);
                if (searchError) setSearchError("");
              }}
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setQuery("");
                  setCityResults([]);
                  setSearchError("");
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" className="search-submit" disabled={isSearching}>
              {isSearching ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}
            </button>
          </form>
          {searchError && <p className="search-message" role="status">{searchError}</p>}
          {cityResults.length > 0 && (
            <ul className="city-results" aria-label="City search results">
              {cityResults.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => handleCitySelect(result)} disabled={isLoading}>
                    <MapPin size={15} />
                    <span><strong>{result.name}</strong><small>{result.country}</small></span>
                    <span className="result-arrow">↗</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel-divider season-divider" />

        <div className="season-section">
          <div className="section-title-row">
            <span className="section-title">Travel through time</span>
            <span className="season-year">12 MONTHS</span>
          </div>
          <p className="season-description">
            {monthlyClimate.length ? "See how the landscape changes with the seasons." : "Choose a city to explore its seasonal climate."}
          </p>
          <input
            className="month-slider"
            type="range"
            min="0"
            max="11"
            value={selectedMonth}
            disabled={!monthlyClimate.length}
            onChange={(event) => setSelectedMonth(Number(event.target.value))}
            aria-label="Select month"
          />
          <div className="month-labels"><span>JAN</span><span>APR</span><span>JUL</span><span>OCT</span><span>DEC</span></div>
          <div className="selected-month">
            <span className="month-orbit"><Sun size={13} /></span>
            <span>{months[selectedMonth]} <span className="month-text">in {city?.name ?? "your world"}</span></span>
            {monthlyClimate.length > 0 && <strong>{Math.round(monthlyClimate[selectedMonth]?.average_temperature ?? temperature)}°</strong>}
          </div>
        </div>

        {isLoading && <div className="loading-note"><LoaderCircle size={14} className="spin" /> Updating your weather world…</div>}
      </section>

      <aside className="right-panel spatial-glass" aria-label="Terrain controls">
        <div className="controls-heading">
          <span className="controls-icon"><SlidersHorizontal size={16} /></span>
          <div><p className="eyebrow">MAKE IT YOURS</p><h2>World settings</h2></div>
          <button
            type="button"
            className="icon-button panel-close"
            onClick={resetWeatherSettings}
            aria-label="Reset weather settings"
            title="Reset weather settings"
          ><RotateCcw size={14} /></button>
        </div>

        {city && mode !== "live" && (
          <button type="button" className="live-weather-button" onClick={switchToLive} disabled={isLoading}>
            <span className="live-indicator" /> Return to live weather
          </button>
        )}

        <div className="control-list">
          <label className="control-item">
            <span className="control-label"><span><Sun size={15} /> Temperature</span><strong>{Math.round(temperature)}°C</strong></span>
            <input type="range" min="-15" max="40" value={temperature} onChange={(event) => setParam("temperature", Number(event.target.value))} aria-label="Temperature" />
            <span className="range-ends"><span>-15°</span><span>40°</span></span>
          </label>
          <label className="control-item">
            <span className="control-label"><span><Droplets size={15} /> Rainfall</span><strong>{Math.round(precipitation)}%</strong></span>
            <input type="range" min="0" max="100" value={precipitation} onChange={(event) => setParam("precipitation", Number(event.target.value))} aria-label="Rainfall" />
            <span className="range-ends"><span>Clear</span><span>Heavy</span></span>
          </label>
          <label className="control-item">
            <span className="control-label"><span><Cloud size={15} /> Cloud cover</span><strong>{Math.round(cloudCover)}%</strong></span>
            <input type="range" min="0" max="100" value={cloudCover} onChange={(event) => setParam("cloudCover", Number(event.target.value))} aria-label="Cloud cover" />
            <span className="range-ends"><span>Clear</span><span>Overcast</span></span>
          </label>
          <label className="control-item">
            <span className="control-label"><span><Wind size={15} /> Wind speed</span><strong>{Math.round(windSpeed)} km/h</strong></span>
            <input type="range" min="0" max="100" value={windSpeed} onChange={(event) => setParam("windSpeed", Number(event.target.value))} aria-label="Wind speed" />
            <span className="range-ends"><span>Calm</span><span>Strong</span></span>
          </label>
          <label className="control-item">
            <span className="control-label"><span><Mountain size={15} /> Terrain height</span><strong>{elevation.toFixed(1)}×</strong></span>
            <input type="range" min="1.2" max="4.5" step="0.1" value={elevation} onChange={(event) => setParam("elevation", Number(event.target.value))} aria-label="Terrain height" />
            <span className="range-ends"><span>Low</span><span>Alpine</span></span>
          </label>
        </div>

        <div className="control-divider" />
        <div className="lighting-row">
          <div className="lighting-copy"><span className="lighting-icon">{isDay ? <Sun size={15} /> : <Moon size={15} />}</span><span><strong>Lighting</strong><small>Set the time of day</small></span></div>
          <div className="day-toggle" role="group" aria-label="Lighting">
            <button type="button" className={isDay ? "active" : ""} onClick={() => setParam("isDay", true)} aria-pressed={isDay}><Sun size={14} /> Day</button>
            <button type="button" className={!isDay ? "active" : ""} onClick={() => setParam("isDay", false)} aria-pressed={!isDay}><Moon size={14} /> Night</button>
          </div>
        </div>

        <button type="button" className="new-island-button" onClick={randomizeSeed}>
          <Sparkles size={16} /> Generate new island <span>↗</span>
        </button>
      </aside>

      <div className="scene-hint"><span className="hint-orbit">⤢</span> DRAG TO ORBIT <i /> SCROLL TO ZOOM</div>
      <div className="scene-credit"><span /> PROCEDURAL TERRAIN <i /> {isDay ? "DAYLIGHT" : "NIGHT MODE"}</div>
    </main>
  );
}
