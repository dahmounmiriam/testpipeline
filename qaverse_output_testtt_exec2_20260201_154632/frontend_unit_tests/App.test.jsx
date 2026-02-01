import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import App from '../App'

/* Mock RepositoryForm to expose control buttons that trigger App callbacks */
jest.mock('../components/RepositoryForm', () => {
  return function MockRepositoryForm(props) {
    const { onPipelineGenerated, onError, onLoadingChange } = props
    return (
      <div data-testid="repository-form">
        <button data-testid="generate-pipeline-btn" onClick={() => {
          onLoadingChange(true)
          onPipelineGenerated({ id: 'pipeline-1', stages: ['build', 'test', 'deploy'] })
        }}>
          Generate Pipeline
        </button>
        <button data-testid="trigger-error-btn" onClick={() => onError('Mock error')}>
          Trigger Error
        </button>
        <button data-testid="start-loading-btn" onClick={() => onLoadingChange(true)}>
          Start Loading
        </button>
        <button data-testid="stop-loading-btn" onClick={() => onLoadingChange(false)}>
          Stop Loading
        </button>
      </div>
    )
  }
})

/* Mock PipelineVisualizer to render a simple identifiable block */
jest.mock('../components/PipelineVisualizer', () => {
  return function MockPipelineVisualizer({ pipeline }) {
    return (
      <div data-testid="pipeline-visualizer">
        Pipeline: {JSON.stringify(pipeline)}
      </div>
    )
  }
})

describe('App component', () => {
  test('renders header and repository form on initial render', () => {
    render(<App />)

    // Header and subtitle
    expect(screen.getByText('Test Pipeline Generator')).toBeInTheDocument()
    expect(screen.getByText('AI-Powered Comprehensive Testing Pipeline for Your Code Repository')).toBeInTheDocument()

    // RepositoryForm should render (mock)
    expect(screen.getByTestId('repository-form')).toBeInTheDocument()

    // Initially, loading card and error/pipeline should not be visible
    expect(screen.queryByTestId('pipeline-visualizer')).not.toBeInTheDocument()
    expect(screen.queryByText('Analyzing your repository and generating pipeline...')).not.toBeInTheDocument()
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })

  test('shows loading state when loading starts', () => {
    render(<App />)

    // Start loading via mock button
    fireEvent.click(screen.getByTestId('start-loading-btn'))

    // Loading message should appear
    expect(screen.getByText('Analyzing your repository and generating pipeline...')).toBeInTheDocument()
  })

  test('generates pipeline and respects loading state (pipeline not shown while loading)', () => {
    render(<App />)

    // Trigger generation (calls onLoadingChange(true) and onPipelineGenerated)
    fireEvent.click(screen.getByTestId('generate-pipeline-btn'))

    // Loading state should be true, hence no pipeline visualizer yet
    expect(screen.queryByTestId('pipeline-visualizer')).not.toBeInTheDocument()
    expect(screen.getByText('Analyzing your repository and generating pipeline...')).toBeInTheDocument()
  })

  test('shows pipeline visualization after loading completes', () => {
    render(<App />)

    // Start generation
    fireEvent.click(screen.getByTestId('generate-pipeline-btn'))

    // Stop loading to simulate completion
    fireEvent.click(screen.getByTestId('stop-loading-btn'))

    // PipelineVisualizer should now render with the pipeline data
    expect(screen.getByTestId('pipeline-visualizer')).toBeInTheDocument()
    expect(screen.getByTestId('pipeline-visualizer')).toHaveTextContent('Pipeline: {"id":"pipeline-1","stages":["build","test","deploy"]}')
  })

  test('handles error state correctly and clears pipeline', () => {
    render(<App />)

    // Trigger an error
    fireEvent.click(screen.getByTestId('trigger-error-btn'))

    // Error message should be displayed
    expect(screen.getByText('Error: Mock error')).toBeInTheDocument()

    // Pipeline visualizer should not be shown
    expect(screen.queryByTestId('pipeline-visualizer')).not.toBeInTheDocument()
  })
})