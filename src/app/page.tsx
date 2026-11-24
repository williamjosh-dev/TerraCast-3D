"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import TerrainMesh from "../components/scene/TerrainMesh";
import { useWeatherStore } from "../store/useWeatherStore";

export default function Home() {
    const { temperature, isDay, setParam, randomizeSeed } = useWeatherStore();
    return (
        <main className="relative h-screen w-screen overflow-hidden bg-slate-950">
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-4 rounded-2xl border border-white/15 bg-slate-900/75 px-5 py-3 text-white backdrop-blur-md">
                <span className="font-bold tracking-wide text-sky-400">TerraCast 3D</span>
                <label className="flex items-center gap-2 text-sm">
                    <span>Temp :{temperature}°C</span>
                    <input
                        type="range"
                        min={-15}
                        max={40}
                        value={temperature}
                        onChange={(e) => setParam("temperature", Number(e.target.value))}
                        className="accent-sky-400"
                    />
                </label>
                <button
                    onClick={() => setParam("isDay", !isDay)}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
                >
                    {isDay ? "☀️ Day" : "🌙 Night"}
                </button>
                <button
                    onClick={randomizeSeed}
                    className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-sky-400"
                >
                    🎲 New Island
                </button>
            </div>
            <Canvas shadows camera={{ position:[0, 6, 12], fov: 45 }}>
                <color attach="background" args={[isDay ? "#bae6fd" : "#020617"]} />
                {isDay && <Sky sunPosition={[10, 8, 10]} />}

                <ambientLight intensity={isDay ? 0.65 : 0.2} />
                <directionalLight
                    position={[10, 15, 8]}
                    intensity={isDay ? 1.8 : 0.4}
                    castShadow
                />
                <TerrainMesh />
                <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
            </Canvas>
        </main>
    )
}