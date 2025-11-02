import { useState } from 'react'
import axios from 'axios'

function RepositoryForm({ onPipelineGenerated, onError, onLoadingChange }) {
  const [formData, setFormData] = useState({
    repository_url: '',
    repository_content: '',
    language: '',
    framework: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.repository_url && !formData.repository_content) {
      onError('Please provide either a repository URL or code content')
      return
    }

    onLoadingChange(true)

    try {
      const response = await axios.post('/api/generate-pipeline', formData)
      onPipelineGenerated(response.data)
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate pipeline'
      onError(errorMessage)
    } finally {
      onLoadingChange(false)
    }
  }

  const handleAnalyze = async () => {
    if (!formData.repository_url && !formData.repository_content) {
      onError('Please provide either a repository URL or code content to analyze')
      return
    }

    onLoadingChange(true)

    try {
      const response = await axios.post('/api/analyze-repository', formData)
      setFormData(prev => ({
        ...prev,
        language: response.data.language || '',
        framework: response.data.framework || ''
      }))
      onError(null)
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to analyze repository'
      onError(errorMessage)
    } finally {
      onLoadingChange(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Repository Information</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="repository_url">Repository URL (Optional)</label>
          <input
            type="text"
            id="repository_url"
            name="repository_url"
            value={formData.repository_url}
            onChange={handleChange}
            placeholder="https://github.com/username/repository"
          />
          <small style={{ color: '#666', fontSize: '0.85rem' }}>
            Enter the URL of your GitHub, GitLab, or Bitbucket repository
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="repository_content">Code Content (Optional)</label>
          <textarea
            id="repository_content"
            name="repository_content"
            value={formData.repository_content}
            onChange={handleChange}
            placeholder="Paste your code here for analysis..."
          />
          <small style={{ color: '#666', fontSize: '0.85rem' }}>
            Or paste a sample of your code for analysis
          </small>
        </div>

        <div className="two-column">
          <div className="form-group">
            <label htmlFor="language">Programming Language (Optional)</label>
            <input
              type="text"
              id="language"
              name="language"
              value={formData.language}
              onChange={handleChange}
              placeholder="e.g., Python, JavaScript, Java"
            />
          </div>

          <div className="form-group">
            <label htmlFor="framework">Framework (Optional)</label>
            <input
              type="text"
              id="framework"
              name="framework"
              value={formData.framework}
              onChange={handleChange}
              placeholder="e.g., React, Django, Spring Boot"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button type="submit" className="btn btn-primary">
            <span>Generate Pipeline</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAnalyze}
            style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}
          >
            <span>Auto-Detect Language</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}

export default RepositoryForm
