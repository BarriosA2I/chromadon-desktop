import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CHROMADON] React Error Boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0a0a0f',
          color: '#00CED1',
          fontFamily: 'monospace',
          padding: '2rem',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#D4AF37' }}>
            CHROMADON - System Error
          </h1>
          <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: '#888' }}>
            An unexpected error occurred in the renderer.
          </p>
          <pre style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '1rem',
            maxWidth: '600px',
            overflow: 'auto',
            fontSize: '0.85rem',
            color: '#ff6b6b',
            marginBottom: '1.5rem',
          }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: '#00CED1',
              color: '#0a0a0f',
              border: 'none',
              borderRadius: '6px',
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
