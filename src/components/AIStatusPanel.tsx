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
        <h2 className="subheading-cyber text-sm">
          AI Status
        </h2>
        <motion.span
          key={aiState}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-xs font-mono font-bold tracking-wider ${
            aiState === 'idle' ? 'text-chroma-teal' :
            aiState === 'thinking' ? 'text-chroma-purple' :
            aiState === 'executing' ? 'text-chroma-cyan' :
            'text-chroma-error'
          }`}
        >
          {aiState.toUpperCase()}
        </motion.span>
      </div>

      {/* 3D Brain Visualization with enhanced container */}
      <div className="relative h-44 w-full mb-4">
        {/* Animated glow ring */}
        <motion.div
          className="absolute inset-2 rounded-xl pointer-events-none"
          animate={{
            boxShadow: [
              'inset 0 0 20px rgba(0, 206, 209, 0.15)',
              'inset 0 0 40px rgba(139, 92, 246, 0.2)',
              'inset 0 0 20px rgba(0, 206, 209, 0.15)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Corner brackets */}
        <div className="absolute top-2 left-2 w-5 h-5 border-l-2 border-t-2 border-chroma-teal/40 rounded-tl" />
        <div className="absolute top-2 right-2 w-5 h-5 border-r-2 border-t-2 border-chroma-teal/40 rounded-tr" />
        <div className="absolute bottom-2 left-2 w-5 h-5 border-l-2 border-b-2 border-chroma-teal/40 rounded-bl" />
        <div className="absolute bottom-2 right-2 w-5 h-5 border-r-2 border-b-2 border-chroma-teal/40 rounded-br" />

        {/* Canvas container */}
        <div className="absolute inset-3 rounded-lg bg-chroma-black/60 overflow-hidden">
          <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
            <ambientLight intensity={0.3} />
            <pointLight position={[10, 10, 10]} intensity={0.7} color="#00CED1" />
            <pointLight position={[-10, -10, -10]} intensity={0.4} color="#8B5CF6" />
            <NeuralBrain aiState={aiState} />
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              autoRotate={aiState !== 'error'}
              autoRotateSpeed={aiState === 'thinking' ? 8 : 2}
            />
          </Canvas>
        </div>

        {/* State label overlay */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
          <motion.div
            key={aiState}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-3 py-1 rounded-full bg-chroma-black/80 border border-chroma-teal/30 backdrop-blur-sm"
          >
            <span className="font-display text-xs tracking-[0.2em] text-chroma-teal">
              {aiState.toUpperCase()}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Cognitive Mode */}
      {cognitiveMode && (
        <div className="flex items-center justify-between mb-3 text-sm p-2 rounded-lg bg-chroma-black/30">
          <span className="font-ui text-chroma-muted">Cognitive Mode</span>
          <span className={`font-mono uppercase font-semibold ${
            cognitiveMode === 'system1' ? 'text-chroma-teal' :
            cognitiveMode === 'system2' ? 'text-chroma-purple' :
            'text-chroma-gold'
          }`}>
            {cognitiveMode}
          </span>
        </div>
      )}

      {/* Enhanced Confidence Meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-ui text-sm text-chroma-muted">Confidence</span>
          <motion.span
            key={confidence}
            initial={{ scale: 1.3, color: '#00FFFF' }}
            animate={{ scale: 1, color: '#00CED1' }}
            transition={{ duration: 0.3 }}
            className="font-mono text-lg font-bold"
          >
            {Math.round(confidence * 100)}%
          </motion.span>
        </div>
        <div className="relative h-3 rounded-full bg-chroma-black overflow-hidden">
          {/* Background gradient hint */}
          <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-chroma-error via-chroma-warning via-50% to-chroma-teal" />

          {/* Animated fill */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${confidence * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              background: 'linear-gradient(90deg, #EF4444 0%, #F97316 25%, #FBBF24 50%, #10B981 75%, #00CED1 100%)',
            }}
          />

          {/* Shine overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </div>

      {/* Enhanced Circuit Breaker */}
      <div className="relative p-3 rounded-xl bg-chroma-black/40 border border-chroma-teal/10 mb-4 overflow-hidden">
        {/* Circuit line decoration */}
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 200 60" preserveAspectRatio="none">
          <path
            d="M 0 30 L 40 30 L 50 20 L 70 40 L 90 20 L 110 40 L 120 30 L 200 30"
            stroke={circuitState === 'closed' ? '#10B981' : circuitState === 'half-open' ? '#F97316' : '#EF4444'}
            strokeWidth="2"
            fill="none"
            strokeDasharray={circuitState === 'open' ? '8 4' : 'none'}
          />
        </svg>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircuitIcon state={circuitState} />
            <span className="font-ui text-sm text-chroma-muted">Circuit Breaker</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono uppercase font-bold ${
              circuitState === 'closed' ? 'text-chroma-success' :
              circuitState === 'half-open' ? 'text-chroma-warning' :
              'text-chroma-error'
            }`}>
              {circuitState.toUpperCase()}
            </span>
            <div className="relative">
              <div className={`led ${
                circuitState === 'closed' ? 'led-green' :
                circuitState === 'half-open' ? 'led-yellow' :
                'led-red'
              }`} />
              {circuitState === 'closed' && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-chroma-success"
                  animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Memory Stats */}
      <div className="space-y-3">
        <MemoryStat label="L0 Working" value={memoryStats.working} max={7} color="#00CED1" />
        <MemoryStat label="L1 Episodic" value={memoryStats.episodic} max={100} color="#8B5CF6" />
        <MemoryStat label="L2 Semantic" value={memoryStats.semantic} max={50} color="#D4AF37" />
        <MemoryStat label="L3 Procedural" value={memoryStats.procedural} max={30} color="#10B981" />
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
            <sphereGeometry args={[0.06, 8, 8]} />
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

function MemoryStat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-chroma-muted font-ui">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-chroma-black overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function CircuitIcon({ state }: { state: string }) {
  const color = state === 'closed' ? '#10B981' : state === 'half-open' ? '#F97316' : '#EF4444'

  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="6" width="4" height="4" rx="0.5" />
      <rect x="10" y="6" width="4" height="4" rx="0.5" />
      <line x1="6" y1="8" x2="10" y2="8" strokeDasharray={state === 'open' ? '2 2' : 'none'} />
      <line x1="8" y1="6" x2="8" y2="2" />
      <line x1="8" y1="10" x2="8" y2="14" />
    </svg>
  )
}
