import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import PipelineVisualizer from '../PipelineVisualizer.jsx'

describe('PipelineVisualizer', () => {
  test('renders pipeline stages with details', () => {
    const pipeline = {
      stages: [
        {
          name: 'Unit Tests Backend',
          type: 'unit_test_backend',
          description: 'Run backend unit tests',
          commands: ['npm run test:backend', 'npm run lint'],
          tools: ['Jest', 'eslint'],
          estimatedDuration: '5m'
        },
        {
          name: 'Integration Tests Frontend',
          type: 'integration_test_frontend',
          description: 'Run frontend integration tests',
          commands: ['npm run test:frontend:integration'],
          tools: ['Cypress'],
          estimatedDuration: '8m'
        }
      ],
      summary: 'This pipeline runs unit and integration tests.',
      recommendations: ['Add caching', 'Parallelize stages']
    }

    render(<PipelineVisualizer pipeline={pipeline} />)

    // Title
    expect(screen.getByText('Generated Test Pipeline')).toBeInTheDocument()

    // Stage 1: Unit Tests Backend
    expect(screen.getByText('Unit Tests Backend')).toBeInTheDocument()
    expect(screen.getByText('unit test backend')).toBeInTheDocument()
    expect(screen.getByText('Run backend unit tests')).toBeInTheDocument()
    expect(screen.getByText('npm run test:backend')).toBeInTheDocument()
    expect(screen.getByText('Jest')).toBeInTheDocument()
    expect(screen.getByText('eslint')).toBeInTheDocument()
    expect(screen.getByText('Estimated Duration: 5m')).toBeInTheDocument()

    // Stage 2: Integration Tests Frontend
    expect(screen.getByText('Integration Tests Frontend')).toBeInTheDocument()
    expect(screen.getByText('integration test frontend')).toBeInTheDocument()
    expect(screen.getByText('Run frontend integration tests')).toBeInTheDocument()
    expect(screen.getByText('npm run test:frontend:integration')).toBeInTheDocument()
    expect(screen.getByText('Cypress')).toBeInTheDocument()
    expect(screen.getByText('Estimated Duration: 8m')).toBeInTheDocument()

    // Summary
    expect(screen.getByText('Pipeline Summary')).toBeInTheDocument()
    expect(screen.getByText(pipeline.summary)).toBeInTheDocument()

    // Recommendations
    expect(screen.getByText('Recommendations')).toBeInTheDocument()
    expect(screen.getByText('Add caching')).toBeInTheDocument()
    expect(screen.getByText('Parallelize stages')).toBeInTheDocument()
  })

  test('renders null when pipeline is null', () => {
    render(<PipelineVisualizer pipeline={null} />)
    expect(screen.queryByText('Generated Test Pipeline')).not.toBeInTheDocument()
  })

  test('uses fallback icon and renders unknown stage type as label', () => {
    const pipeline = {
      stages: [
        {
          name: 'Custom Stage',
          type: 'custom_type',
          description: 'A custom stage type',
          commands: ['echo hello'],
          tools: ['CustomTool'],
          estimatedDuration: '2m'
        }
      ]
    }

    render(<PipelineVisualizer pipeline={pipeline} />)

    // Name and type label formatting
    expect(screen.getByText('Custom Stage')).toBeInTheDocument()
    expect(screen.getByText('custom type')).toBeInTheDocument()

    // Command and tools visible
    expect(screen.getByText('echo hello')).toBeInTheDocument()
    expect(screen.getByText('CustomTool')).toBeInTheDocument()
  })

  test('updates content when pipeline prop changes', () => {
    const initial = {
      stages: [
        {
          name: 'Stage A',
          type: 'unit_test_backend',
          description: 'Initial stage',
          commands: ['cmd1'],
          tools: ['tool1'],
          estimatedDuration: '3m'
        }
      ],
      summary: null
    }

    const updated = {
      stages: [
        {
          name: 'Stage A',
          type: 'unit_test_backend',
          description: 'Initial stage',
          commands: ['cmd1'],
          tools: ['tool1'],
          estimatedDuration: '3m'
        },
        {
          name: 'Stage B',
          type: 'integration_test_backend',
          description: 'Additional stage',
          commands: ['cmd2'],
          tools: ['tool2'],
          estimatedDuration: '4m'
        }
      ],
      summary: 'Updated summary'
    }

    const { rerender } = render(<PipelineVisualizer pipeline={initial} />)

    expect(screen.getByText('Stage A')).toBeInTheDocument()
    expect(screen.queryByText('Stage B')).not.toBeInTheDocument()

    rerender(<PipelineVisualizer pipeline={updated} />)

    expect(screen.getByText('Stage B')).toBeInTheDocument()
    expect(screen.getByText('Updated summary')).toBeInTheDocument()
    expect(screen.getByText('cmd2')).toBeInTheDocument()
  })
})