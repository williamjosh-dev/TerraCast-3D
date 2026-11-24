"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { useWeatherStore } from "../../store/useWeatherStore";

export default function TerrainMesh() {
  const { temperature, elevation, seed, selectedMonth } = useWeatherStore();

  // Generate 3D terrain geometry & vertex colors whenever seed, elevation, temp, or month changes
  const geometry = useMemo(() => {
    const size = 14;
    const segments = 96;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2); // Lay flat horizontally

    // Create deterministic pseudo-random generator from our seed
    const pseudoRandom = () => {
      const x = Math.sin(seed * 9999) * 10000;
      return x - Math.floor(x);
    };
    const noise2D = createNoise2D(pseudoRandom);

    const pos = geo.attributes.position;
    const colors: number[] = [];
    const color = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Distance from center (0 to 1) so edges drop into an island shape
      const dist = Math.sqrt(x * x + z * z) / (size * 0.5);
      const islandMask = Math.max(0, 1 - Math.pow(dist, 2.2));

      // Layer 2 noise frequencies for rolling hills + fine detail
      const baseNoise = noise2D(x * 0.22, z * 0.22);
      const detailNoise = noise2D(x * 0.6, z * 0.6) * 0.25;
      const rawHeight = (baseNoise + detailNoise + 0.4) * islandMask * elevation;

      const y = rawHeight - 0.35; // Offset slightly so edges sit underwater
      pos.setY(i, y);

      // Assign dynamic vertex color based on height, temperature, and season
      if (y < 0.08) {
        // Sandy beach / riverbed
        color.set(temperature <= 0 ? "#cbd5e1" : "#e2c799");
      } else if (temperature <= 2 && y > 0.35) {
        // Winter snow blanket on hills/mountains
        color.set("#f8fafc");
      } else if (y > elevation * 0.62) {
        // High rocky mountain peaks
        color.set(temperature <= 6 ? "#e2e8f0" : "#64748b");
      } else {
        // Seasonal foliage colors (Autumn Oct-Nov vs Spring/Summer)
        const isAutumn = selectedMonth === 9 || selectedMonth === 10;
        if (temperature <= 4) {
          color.set("#94a3b8"); // Frosted tundra grass
        } else if (isAutumn && temperature < 22) {
          color.set("#d97706"); // Autumn orange/amber
        } else {
          color.set("#22c55e"); // Lush green grass
        }
      }

      colors.push(color.r, color.g, color.b);
    }

    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals(); // Essential for realistic sun shadows & lighting
    return geo;
  }, [temperature, elevation, seed, selectedMonth]);

  const isFrozen = temperature <= 0;

  return (
    <group>
      {/* Procedural 3D Terrain */}
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Water / Ice Layer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial
          color={isFrozen ? "#bae6fd" : "#0284c7"}
          transparent
          opacity={isFrozen ? 0.92 : 0.78}
          roughness={isFrozen ? 0.2 : 0.15}
          metalness={0.1}
        />
      </mesh>

      {/* Cutaway Earth/Rock Base Underneath for Diorama Look */}
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[14, 1.1, 14]} />
        <meshStandardMaterial color="#334155" roughness={0.95} />
      </mesh>
    </group>
  );
}
