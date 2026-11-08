// src/components/World.tsx

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { UZBEK_VEHICLES } from '../data/vehicles';
import { UZBEK_LIFE_MAP_ZONES, MAIN_ROAD_NETWORK } from '../world/mapConfig';

// O'yinchi avtomobili komponenti
const PlayerVehicle: React.FC = () => {
  const vehicleRef = useRef<THREE.Group>(null);
  const currentVehicleId = useGameStore((state) => state.currentVehicle);
  const updateNeeds = useGameStore((state) => state.updateNeeds);

  const vehicleSpec = UZBEK_VEHICLES.find((v) => v.id === currentVehicleId) || UZBEK_VEHICLES[1];

  // Boshqaruv va fizika holatlari
  const [speed, setSpeed] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState<[number, number, number]>([0, 0.5, 0]);

  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    let currentSpeed = speed;
    let currentRot = rotation;

    const maxSpeed = vehicleSpec.topSpeed / 10;
    const accel = (15 / vehicleSpec.acceleration) * delta * 10;
    const friction = 0.98;

    // Tezlanish va tormozlanish
    if (keysPressed.current['w'] || keysPressed.current['arrowup']) {
      currentSpeed = Math.min(maxSpeed, currentSpeed + accel);
    } else if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
      currentSpeed = Math.max(-maxSpeed / 2, currentSpeed - accel);
    } else {
      currentSpeed *= friction;
    }

    // Burilishlar
    if (Math.abs(currentSpeed) > 0.05) {
      const dir = currentSpeed > 0 ? 1 : -1;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
        currentRot += 1.5 * delta * dir;
      }
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
        currentRot -= 1.5 * delta * dir;
      }
    }

    setSpeed(currentSpeed);
    setRotation(currentRot);

    // Pozitsiyani yangilash
    const newX = position[0] + Math.sin(currentRot) * currentSpeed;
    const newZ = position[2] + Math.cos(currentRot) * currentSpeed;
    setPosition([newX, 0.5, newZ]);

    if (vehicleRef.current) {
      vehicleRef.current.position.set(newX, 0.5, newZ);
      vehicleRef.current.rotation.y = currentRot;
    }

    // Yoqilg'i/energiya sarfi simulyatsiyasi
    if (Math.abs(currentSpeed) > 0.1) {
      updateNeeds(-0.005, -0.002);
    }
  });

  return (
    <group ref={vehicleRef} position={position}>
      {/* Avtomobil korpusi (Vaqtinchalik 3D mesh model) */}
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[2, 1, 4]} />
        <meshStandardMaterial color={currentVehicleId === 'gentra' ? '#111111' : '#e2e8f0'} roughness={0.2} metalness={0.5} />
      </mesh>
      {/* Avtomobil kabinasi */}
      <mesh castShadow position={[0, 1.3, -0.2]}>
        <boxGeometry args={[1.8, 0.7, 2]} />
        <meshStandardMaterial color="#1e293b" opacity={0.8} transparent />
      </mesh>
      {/* G'ildiraklar */}
      {[-1.05, 1.05].map((x, i) =>
        [-1.2, 1.2].map((z, j) => (
          <mesh key={`${i}-${j}`} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        ))
      )}
    </group>
  );
};

// Yo'llar va Bino obyektlari
const CityEnvironment: React.FC = () => {
  return (
    <group>
      {/* Yer/Yer maydoni */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color="#2d3748" />
      </mesh>

      {/* Asosiy Yo'llar */}
      {MAIN_ROAD_NETWORK.map((node) => (
        <mesh key={node.id} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[node.x, 0.01, node.z]}>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color="#1a202c" />
        </mesh>
      ))}

      {/* G'uzor shahar va mahalla zonalari namoyishi */}
      {UZBEK_LIFE_MAP_ZONES.map((zone) => {
        const width = zone.bounds.maxX - zone.bounds.minX;
        const depth = zone.bounds.maxZ - zone.bounds.minZ;
        const centerX = (zone.bounds.minX + zone.bounds.maxX) / 2;
        const centerZ = (zone.bounds.minZ + zone.bounds.maxZ) / 2;

        return (
          <group key={zone.id} position={[centerX, 0, centerZ]}>
            {/* Hudud atrofiga binolar va obyektlar */}
            <mesh position={[0, 5, 0]} castShadow receiveShadow>
              <boxGeometry args={[Math.min(width / 4, 40), 10, Math.min(depth / 4, 40)]} />
              <meshStandardMaterial color={zone.type === 'city_center' ? '#4a5568' : '#718096'} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// 3D Dunyo Sahnasi
export const World: React.FC = () => {
  return (
    <div className="w-full h-screen">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 15, -25]} fov={60} />
        <Sky sunPosition={[100, 50, 100]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[50, 100, 50]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <CityEnvironment />
        <PlayerVehicle />

        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
};