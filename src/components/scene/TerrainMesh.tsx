"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {createNoise2D} from "simplex-noise";
import { useWeatherStore } from "../../store/useWeatherStore";

export default function TerrainMesh() {
    const { temperature, elevation, seed, selectedMonth } = useWeatherStore();
      
    const terrainGeometry = useMemo(() => {
        const size = 14;
        const segments = 96;
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        geo.rotateX(-Math.PI / 2);
        return geo;
    }, []);
    