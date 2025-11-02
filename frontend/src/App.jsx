import { useState } from 'react'
import RepositoryForm from './components/RepositoryForm'
import PipelineVisualizer from './components/PipelineVisualizer'

function App() {
  const [pipeline, setPipeline] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handlePipelineGenerated = (pipelineData) => {
    setPipeline(pipelineData)
    setError(null)
  }

  const handleError = (errorMessage) => {
    setError(errorMessage)
    setPipeline(null)
  }

  const handleLoadingChange = (isLoading) => {
    setLoading(isLoading)
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Test Pipeline Generator</h1>
        <p>AI-Powered Comprehensive Testing Pipeline for Your Code Repository</p>
      </div>

      <RepositoryForm
        onPipelineGenerated={handlePipelineGenerated}
        onError={handleError}
        onLoadingChange={handleLoadingChange}
      />

      {loading && (
        <div className="card">
          <div className="loading">
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem', color: '#666' }}>
              Analyzing your repository and generating pipeline...
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error: </strong>
          {error}
        </div>
      )}

      {pipeline && !loading && (
        <PipelineVisualizer pipeline={pipeline} />
      )}
    </div>
  )
}

export default App
