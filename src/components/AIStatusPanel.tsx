import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Icosahedron, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useChromadonStore } from '../store/chromadonStore'

export default function AIStatusPanel() {
  const { aiState, confidence, circuitState, cognitiveMode, memoryStats } = useChromadonStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="cyber-panel p-4 flex-shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-ui font-semibold text-chroma-muted uppercase tracking-wider text-sm">
          AI Status
        </h2>
        <span className={`text-xs font-mono ${
          aiState === 'idle' ? 'text-chroma-teal' :
          aiState === 'thinking' ? 'text-chroma-purple' :
          aiState === 'executing' ? 'text-chroma-cyan' :
          'text-chroma-error'
        }`}>
          {aiState.toUpperCase()}
        </span>
      </div>

      {/* 3D Brain Visualization */}
      <div className="h-40 w-full rounded bg-chroma-black/50 mb-4 overflow-hidden">
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <ambientLight intensity={0.2} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          <NeuralBrain aiState={aiState} />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate={aiState !== 'error'}
            autoRotateSpeed={aiState === 'thinking' ? 8 : 2}
          />
        </Canvas>
      </div>

      {/* Cognitive Mode */}
      {cognitiveMode && (
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="font-ui text-chroma-muted">Cognitive Mode</span>
          <span className={`font-mono uppercase ${
            cognitiveMode === 'system1' ? 'text-chroma-teal' :
            cognitiveMode === 'system2' ? 'text-chroma-purple' :
            'text-chroma-cyan'
          }`}>
            {cognitiveMode}
          </span>
        </div>
      )}

      {/* Confidence Meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-ui text-sm text-chroma-muted">Confidence</span>
          <span className="font-mono text-sm text-chroma-teal">{Math.round(confidence * 100)}%</span>
        </div>
        <div className="confidence-bar">
          <div
            className="confidence-fill"
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Circuit Breaker */}
      <div className="flex items-center justify-between mb-4 p-2 rounded bg-chroma-black/30">
        <div className="flex items-center gap-2">
          <CircuitIcon />
          <span className="font-ui text-sm text-chroma-muted">Circuit Breaker</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono uppercase ${
            circuitState === 'closed' ? 'text-chroma-success' :
            circuitState === 'half-open' ? 'text-chroma-warning' :
            'text-chroma-error'
          }`}>
            {circuitState}
          </span>
          <div className={`led ${
            circuitState === 'closed' ? 'led-green' :
            circuitState === 'half-open' ? 'led-yellow' :
            'led-red'
          }`} />
        </div>
      </div>

      {/* Memory Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MemoryStat label="L0 Working" value={memoryStats.working} max={7} />
        <MemoryStat label="L1 Episodic" value={memoryStats.episodic} max={100} />
        <MemoryStat label="L2 Semantic" value={memoryStats.semantic} max={50} />
        <MemoryStat label="L3 Procedural" value={memoryStats.procedural} max={30} />
      </div>
    </motion.div>
  )
}

function NeuralBrain({ aiState }: { aiState: string }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const nodesRef = useRef<THREE.Group>(null)

  const color = aiState === 'error' ? '#EF4444' :
                aiState === 'thinking' ? '#8B5CF6' :
                '#00CED1'

  useFrame((state) => {
    if (nodesRef.current) {
      nodesRef.current.rotation.y = state.clock.elapsedTime * 0.5
      nodesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
    }
  })

  return (
    <group ref={nodesRef}>
      {/* Core brain */}
      <Icosahedron ref={meshRef} args={[1, 2]}>
        <MeshDistortMaterial
          color={color}
          wireframe
          distort={aiState === 'thinking' ? 0.4 : 0.2}
          speed={aiState === 'thinking' ? 5 : 2}
        />
      </Icosahedron>

      {/* Neural nodes */}
      {Array.from({ length: 12 }).map((_, i) => {
        const phi = Math.acos(-1 + (2 * i) / 12)
        const theta = Math.sqrt(12 * Math.PI) * phi
        const x = 1.5 * Math.cos(theta) * Math.sin(phi)
        const y = 1.5 * Math.sin(theta) * Math.sin(phi)
        const z = 1.5 * Math.cos(phi)

        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={color} />
          </mesh>
        )
      })}

      {/* Connection lines */}
      <lineSegments>
        <edgesGeometry args={[new THREE.IcosahedronGeometry(1.5, 1)]} />
        <lineBasicMaterial color={color} opacity={0.3} transparent />
      </lineSegments>
    </group>
  )
}

function MemoryStat({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = Math.min((value / max) * 100, 100)
  return (
    <div className="p-2 rounded bg-chroma-black/30">
      <div className="flex justify-between mb-1">
        <span className="text-chroma-muted">{label}</span>
        <span className="font-mono text-chroma-teal">{value}</span>
      </div>
      <div className="h-1 bg-chroma-black rounded-full overflow-hidden">
        <div
          className="h-full bg-chroma-teal/50 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function CircuitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-chroma-teal">
      <rect x="2" y="6" width="4" height="4" rx="0.5" />
      <rect x="10" y="6" width="4" height="4" rx="0.5" />
      <line x1="6" y1="8" x2="10" y2="8" />
      <line x1="8" y1="6" x2="8" y2="2" />
      <line x1="8" y1="10" x2="8" y2="14" />
    </svg>
  )
}
