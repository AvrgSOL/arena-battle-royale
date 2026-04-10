/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck  — R3F JSX elements require global type augmentation; suppressed for prototype
import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameState, SnakeState, Vec2 } from '../../types';

// ── World constants ───────────────────────────────────────────────────────────
const GW   = 40;
const GH   = 30;
const wx   = (x: number) => x + 0.5;   // game x  → world x
const wz   = (y: number) => y + 0.5;   // game y  → world z

// ── Camera ────────────────────────────────────────────────────────────────────
function CameraRig({ target }: { target: Vec2 | null }) {
  const { camera } = useThree();
  const curr = useRef(new THREE.Vector3(GW / 2, 0, GH / 2));

  useFrame((_, dt) => {
    if (target) curr.current.set(wx(target.x), 0, wz(target.y));
    const ideal = new THREE.Vector3(curr.current.x, 18, curr.current.z + 11);
    camera.position.lerp(ideal, Math.min(1, dt * 4));
    camera.lookAt(curr.current.x, 0, curr.current.z);
  });

  return null;
}

// ── Floor ─────────────────────────────────────────────────────────────────────
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[GW / 2, -0.02, GH / 2]}>
      <planeGeometry args={[GW, GH]} />
      <meshStandardMaterial color="#040710" />
    </mesh>
  );
}

// ── Grid lines ────────────────────────────────────────────────────────────────
function GridLines() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let x = 0; x <= GW; x++) { pts.push(x, 0.01, 0, x, 0.01, GH); }
    for (let z = 0; z <= GH; z++) { pts.push(0, 0.01, z, GW, 0.01, z); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#1a2840" transparent opacity={0.7} />
    </lineSegments>
  );
}

// ── Zone walls ────────────────────────────────────────────────────────────────
function ZoneWalls({ zone }: { zone: GameState['zone'] }) {
  if (!zone) return null;
  const { x1, y1, x2, y2 } = zone;
  const h  = 4;
  const cy = h / 2;
  const w  = x2 - x1 + 1;
  const d  = y2 - y1 + 1;
  const mx = x1 + w / 2;
  const mz = y1 + d / 2;
  const mat = <meshStandardMaterial color="#ff3300" emissive="#ff2200" emissiveIntensity={0.6} transparent opacity={0.35} side={THREE.DoubleSide} />;

  return (
    <group>
      <mesh position={[x1,      cy, mz]}><boxGeometry args={[0.08, h, d]} />{mat}</mesh>
      <mesh position={[x2 + 1,  cy, mz]}><boxGeometry args={[0.08, h, d]} />{mat}</mesh>
      <mesh position={[mx, cy, y1]}     ><boxGeometry args={[w, h, 0.08]} />{mat}</mesh>
      <mesh position={[mx, cy, y2 + 1]} ><boxGeometry args={[w, h, 0.08]} />{mat}</mesh>
    </group>
  );
}

// ── Food ──────────────────────────────────────────────────────────────────────
function FoodItem({ pos }: { pos: Vec2 }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.y = s.clock.elapsedTime * 1.5;
    ref.current.position.y = 0.35 + Math.sin(s.clock.elapsedTime * 2 + pos.x) * 0.08;
  });

  return (
    <mesh ref={ref} position={[wx(pos.x), 0.35, wz(pos.y)]}>
      <sphereGeometry args={[0.22, 10, 10]} />
      <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={1.2} />
      <pointLight color="#00e5ff" intensity={0.6} distance={2.5} />
    </mesh>
  );
}

// ── Power-up ──────────────────────────────────────────────────────────────────
const PU_COLORS: Record<string, string> = {
  speed: '#ffd54f', trim: '#f472b6', shield: '#00e5ff',
  ghost: '#ffffff', bomb: '#ff4d6a', freeze: '#7dd3fc', magnet: '#fb923c',
};
const PU_EMOJIS: Record<string, string> = {
  speed: '⚡', trim: '✂', shield: '🛡', ghost: '👻', bomb: '💣', freeze: '❄', magnet: '🧲',
};

function PowerUpItem({ pos, kind }: { pos: Vec2; kind: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const color = PU_COLORS[kind] ?? '#ffffff';

  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.y = s.clock.elapsedTime * 2;
    ref.current.position.y = 0.5 + Math.sin(s.clock.elapsedTime * 3) * 0.12;
  });

  return (
    <mesh ref={ref} position={[wx(pos.x), 0.5, wz(pos.y)]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      <pointLight color={color} intensity={0.8} distance={3} />
    </mesh>
  );
}

// ── Snake ─────────────────────────────────────────────────────────────────────
function SnakeMesh({ snake, isLocalPlayer }: { snake: SnakeState; isLocalPlayer: boolean }) {
  const tick    = useRef(0);
  const alive   = snake.alive;
  const frozen  = (snake.frozenTicks ?? 0) > 0;
  const ghost   = (snake.ghostTicks  ?? 0) > 0;
  const color   = frozen ? '#7dd3fc' : snake.color;
  const opacity = !alive ? 0.2 : ghost ? 0.35 : (isLocalPlayer ? 1.0 : 0.5);
  const emInt   = isLocalPlayer ? 0.55 : 0.08;

  if (!alive && !isLocalPlayer) return null; // don't render dead bots
  if (snake.body.length === 0) return null;

  return (
    <group>
      {snake.body.map((seg, i) => {
        const isHead = i === 0;
        const sz     = isHead ? 0.88 : 0.78;
        const ht     = isHead ? 0.62 : 0.48;

        return (
          <mesh key={i} position={[wx(seg.x), ht / 2, wz(seg.y)]}>
            <boxGeometry args={[sz, ht, sz]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emInt}
              roughness={0.25}
              metalness={0.15}
              transparent={!alive || ghost}
              opacity={opacity}
            />
            {/* Local player head light */}
            {isLocalPlayer && isHead && alive && (
              <pointLight color={color} intensity={2} distance={5} />
            )}
            {/* White outline edges on local player */}
            {isLocalPlayer && alive && (
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(sz + 0.02, ht + 0.02, sz + 0.02)]} />
                <lineBasicMaterial color="#ffffff" transparent opacity={0.7} />
              </lineSegments>
            )}
          </mesh>
        );
      })}

      {/* Arrow above head */}
      {isLocalPlayer && alive && snake.body.length > 0 && (() => {
        const h = snake.body[0];
        return (
          <mesh position={[wx(h.x), 1.8, wz(h.y)]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.18, 0.4, 6]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
          </mesh>
        );
      })()}
    </group>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({
  gameState,
  playerColor,
}: {
  gameState: GameState | null;
  playerColor: string | null;
}) {
  const playerHead = useMemo(() => {
    if (!gameState || !playerColor) return null;
    const me = gameState.snakes.find(s => s.color === playerColor && !s.isBot);
    return me?.body[0] ?? null;
  }, [gameState, playerColor]);

  return (
    <>
      <color attach="background" args={['#050810']} />
      <ambientLight intensity={0.25} color="#3355aa" />
      <directionalLight position={[GW / 2, 30, GH / 2]} intensity={0.4} color="#aaccff" />

      <CameraRig target={playerHead} />
      <Floor />
      <GridLines />

      {gameState && (
        <>
          <ZoneWalls zone={gameState.zone} />

          {gameState.food.map((f, i) => (
            <FoodItem key={i} pos={f} />
          ))}

          {gameState.powerUps?.map((pu, i) => (
            <PowerUpItem key={i} pos={pu.pos} kind={pu.kind} />
          ))}

          {gameState.snakes.map(snake => (
            <SnakeMesh
              key={snake.id}
              snake={snake}
              isLocalPlayer={!!playerColor && snake.color === playerColor && !snake.isBot}
            />
          ))}
        </>
      )}
    </>
  );
}

// ── Export: drop-in replacement canvas ───────────────────────────────────────
export default function GameCanvas3D({
  gameState,
  playerColor,
  width,
  height,
}: {
  gameState: GameState | null;
  playerColor: string | null;
  width: number;
  height: number;
}) {
  return (
    <div style={{ width, height }} className="rounded-lg overflow-hidden border border-[#1a2840]">
      <Canvas
        camera={{ position: [GW / 2, 18, GH / 2 + 11], fov: 55 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene gameState={gameState} playerColor={playerColor} />
      </Canvas>
    </div>
  );
}
