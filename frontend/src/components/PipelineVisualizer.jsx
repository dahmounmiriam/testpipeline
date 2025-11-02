import React from 'react'

const stageIcons = {
  unit_test_backend: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  unit_test_frontend: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  integration_test_backend: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  integration_test_frontend: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  code_quality: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 1 1.946-.806 3.42 3.42 0 0 1 2.223.644 3.42 3.42 0 0 1 3.365 3.174 3.42 3.42 0 0 1 .111 2.5 3.42 3.42 0 0 1-1.945 1.913 3.42 3.42 0 0 1-2.223.644 3.42 3.42 0 0 1-2.854-1.519 3.42 3.42 0 0 1-.407-2.634 3.42 3.42 0 0 1 1.784-2.916z" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  performance_test: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  security_test: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function PipelineVisualizer({ pipeline }) {
  if (!pipeline || !pipeline.stages) {
    return null
  }

  return (
    <div className="pipeline-container">
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>
          Generated Test Pipeline
        </h2>

        {pipeline.stages.map((stage, index) => (
          <div key={index} className="pipeline-stage">
            <div className="stage-header">
              <div className="stage-title">
                {stageIcons[stage.type] || stageIcons.code_quality}
                {stage.name}
              </div>
              <div>
                <span className={`stage-type-badge stage-type-${stage.type}`}>
                  {stage.type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div className="stage-description">
              {stage.description}
            </div>

            <div className="stage-details">
              <div className="detail-section">
                <h4>Commands to Run:</h4>
                <ul>
                  {stage.commands.map((cmd, cmdIndex) => (
                    <li key={cmdIndex}>{cmd}</li>
                  ))}
                </ul>
              </div>

              <div className="detail-section">
                <h4>Tools & Frameworks:</h4>
                <ul>
                  {stage.tools.map((tool, toolIndex) => (
                    <li key={toolIndex}>{tool}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="stage-duration">
                Estimated Duration: {stage.estimatedDuration}
              </span>
            </div>
          </div>
        ))}
      </div>

      {pipeline.summary && (
        <div className="summary-section">
          <h3>Pipeline Summary</h3>
          <p>{pipeline.summary}</p>

          {pipeline.recommendations && pipeline.recommendations.length > 0 && (
            <div className="recommendations">
              <h4>Recommendations</h4>
              <ul>
                {pipeline.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PipelineVisualizer
