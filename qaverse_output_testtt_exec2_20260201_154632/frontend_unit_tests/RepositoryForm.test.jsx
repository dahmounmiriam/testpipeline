import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import RepositoryForm from './RepositoryForm'

jest.mock('axios')

describe('RepositoryForm', () => {
  const defaultProps = {
    onPipelineGenerated: jest.fn(),
    onError: jest.fn(),
    onLoadingChange: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders form fields and action buttons', () => {
    render(<RepositoryForm {...defaultProps} />)

    expect(screen.getByLabelText(/Repository URL/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Code Content/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Programming Language/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Framework/i)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Generate Pipeline/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Auto-Detect Language/i })).toBeInTheDocument()
  })

  test('typing updates input values', async () => {
    render(<RepositoryForm {...defaultProps} />)

    const urlInput = screen.getByLabelText(/Repository URL/i)
    await userEvent.type(urlInput, 'https://github.com/user/repo')
    expect(urlInput).toHaveValue('https://github.com/user/repo')

    const codeInput = screen.getByLabelText(/Code Content/i)
    await userEvent.type(codeInput, 'print("hello")')
    expect(codeInput).toHaveValue('print("hello")')
  })

  test('submitting without URL or code triggers error and does not call API', async () => {
    render(<RepositoryForm {...defaultProps} />)

    const generateBtn = screen.getByRole('button', { name: /Generate Pipeline/i })
    await userEvent.click(generateBtn)

    expect(defaultProps.onError).toHaveBeenCalledWith(
      'Please provide either a repository URL or code content'
    )
    expect(axios.post).not.toHaveBeenCalled()
  })

  test('submits generate pipeline successfully', async () => {
    const onPipelineGenerated = jest.fn()
    const onError = jest.fn()
    const onLoadingChange = jest.fn()
    axios.post.mockResolvedValue({ data: { pipelineId: 'abc' } })

    render(
      <RepositoryForm
        onPipelineGenerated={onPipelineGenerated}
        onError={onError}
        onLoadingChange={onLoadingChange}
      />
    )

    const urlInput = screen.getByLabelText(/Repository URL/i)
    await userEvent.type(urlInput, 'https://github.com/user/repo')

    const generateBtn = screen.getByRole('button', { name: /Generate Pipeline/i })

    await userEvent.click(generateBtn)

    expect(onLoadingChange).toHaveBeenCalledWith(true)

    await waitFor(() => {
      expect(onPipelineGenerated).toHaveBeenCalledWith({ pipelineId: 'abc' })
    })

    expect(axios.post).toHaveBeenCalledWith('/api/generate-pipeline', {
      repository_url: 'https://github.com/user/repo',
      repository_content: '',
      language: '',
      framework: ''
    })

    expect(onLoadingChange).toHaveBeenCalledWith(false)
  })

  test('analyze success updates language and framework and clears error', async () => {
    const onError = jest.fn()
    const onLoadingChange = jest.fn()
    axios.post.mockResolvedValue({ data: { language: 'Python', framework: 'Django' } })

    render(
      <RepositoryForm
        onPipelineGenerated={jest.fn()}
        onError={onError}
        onLoadingChange={onLoadingChange}
      />
    )

    const codeInput = screen.getByLabelText(/Code Content/i)
    await userEvent.type(codeInput, 'def hello(): pass')

    const analyzeBtn = screen.getByRole('button', { name: /Auto-Detect Language/i })
    await userEvent.click(analyzeBtn)

    expect(onLoadingChange).toHaveBeenCalledWith(true)

    await waitFor(() => {
      const languageInput = screen.getByLabelText(/Programming Language/i)
      const frameworkInput = screen.getByLabelText(/Framework/i)
      expect(languageInput).toHaveValue('Python')
      expect(frameworkInput).toHaveValue('Django')
      expect(onError).toHaveBeenCalledWith(null)
    })

    expect(onLoadingChange).toHaveBeenCalledWith(false)
  })

  test('analyze handles error from API', async () => {
    const onError = jest.fn()
    const onLoadingChange = jest.fn()
    axios.post.mockRejectedValue({ response: { data: { detail: 'Not Found' } } })

    render(
      <RepositoryForm
        onPipelineGenerated={jest.fn()}
        onError={onError}
        onLoadingChange={onLoadingChange}
      />
    )

    const codeInput = screen.getByLabelText(/Code Content/i)
    await userEvent.type(codeInput, 'print("hi")')

    const analyzeBtn = screen.getByRole('button', { name: /Auto-Detect Language/i })
    await userEvent.click(analyzeBtn)

    expect(onLoadingChange).toHaveBeenCalledWith(true)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Not Found')
    })

    expect(onLoadingChange).toHaveBeenCalledWith(false)
  })

  test('generate submission with empty inputs triggers correct error and does not call API', async () => {
    render(<RepositoryForm {...defaultProps} />)

    const generateBtn = screen.getByRole('button', { name: /Generate Pipeline/i })
    await userEvent.click(generateBtn)

    expect(defaultProps.onError).toHaveBeenCalledWith(
      'Please provide either a repository URL or code content'
    )
    expect(axios.post).not.toHaveBeenCalled()
  })

  test('analyze submission without inputs prompts appropriate error', async () => {
    render(<RepositoryForm {...defaultProps} />)

    const analyzeBtn = screen.getByRole('button', { name: /Auto-Detect Language/i })
    await userEvent.click(analyzeBtn)

    expect(defaultProps.onError).toHaveBeenCalledWith(
      'Please provide either a repository URL or code content to analyze'
    )
    expect(axios.post).not.toHaveBeenCalled()
  })
})