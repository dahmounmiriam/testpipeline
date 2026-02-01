import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';

describe('Frontend integration tests for App.jsx, RepositoryForm.jsx, and PipelineVisualizer.jsx', () => {
  let requests = [];

  // Mock global fetch to capture API calls and provide canned responses
  beforeEach(() => {
    requests = [];
    global.fetch = jest.fn((input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init && init.method) || 'GET';
      const body = init && init.body ? JSON.parse(init.body) : null;
      requests.push({ url, method, body });

      if (typeof url === 'string' && url.endsWith('/api/analyze-repository')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ analysis: 'success', details: [] }),
        });
      }

      if (typeof url === 'string' && url.endsWith('/api/generate-pipeline')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ pipelineId: 'pipeline-1', status: 'generated' }),
        });
      }

      // Default mock response
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to type into repository URL input flexibly
  const typeRepositoryUrl = async (url) => {
    // Try common label patterns
    let input =
      screen.queryByLabelText(/repository\s*url/i) ||
      screen.queryByLabelText(/repository\s*address/i) ||
      screen.queryByLabelText(/url/i) ||
      screen.queryByTestId('repository-url-input');

    if (!input) {
      throw new Error('Repository URL input not found in the UI.');
    }

    fireEvent.change(input, { target: { value: url } });
    // Trigger potential validations/updations
    fireEvent.blur(input);
  };

  test('Navigation between Repository Form and Pipeline Visualizer', async () => {
    render(<App />);

    // Expect a navigation control to exist (generic)
    const repoNavBtn = screen.getByRole('button', { name: /repository/i });
    expect(repoNavBtn).toBeInTheDocument();

    // Navigate to Repository Form
    fireEvent.click(repoNavBtn);
    // Repository form container should appear
    expect(screen.queryByTestId('repository-form')).toBeInTheDocument();

    // Navigate to Pipeline Visualizer
    const vizNavBtn = screen.getByRole('button', { name: /pipeline/i });
    expect(vizNavBtn).toBeInTheDocument();
    fireEvent.click(vizNavBtn);

    // Pipeline Visualizer view should appear
    await waitFor(() =>
      expect(screen.queryByTestId('pipeline-visualizer-view')).toBeInTheDocument()
    );
  });

  test('Repository form submission triggers analyze and generate API calls and data flows to visualizer', async () => {
    render(<App />);

    // Open Repository Form
    const repoNavBtn = screen.getByRole('button', { name: /repository/i });
    fireEvent.click(repoNavBtn);

    // Type a valid repository URL
    await typeRepositoryUrl('https://github.com/example/repo');

    // Trigger analyze
    const analyzeBtn = screen.getByRole('button', { name: /analyze/i });
    expect(analyzeBtn).toBeInTheDocument();
    fireEvent.click(analyzeBtn);

    // Expect analyze API call
    await waitFor(() => expect(requests.find((r) => r.url?.endsWith('/api/analyze-repository'))).toBeDefined());
    const analyzeReq = requests.find((r) => r.url?.endsWith('/api/analyze-repository'));
    expect(analyzeReq).toBeDefined();
    expect(analyzeReq.method).toBe('POST');
    expect(analyzeReq.body).toBeDefined();
    // Body should contain repositoryUrl or similar field
    const repoUrlField = analyzeReq.body.repositoryUrl || analyzeReq.body.repoUrl || analyzeReq.body.url;
    expect(repoUrlField).toBe('https://github.com/example/repo');

    // Trigger generate pipeline
    const generateBtn = screen.getByRole('button', { name: /generate\s*pipeline|generate/i });
    expect(generateBtn).toBeInTheDocument();
    fireEvent.click(generateBtn);

    // Expect generate-pipeline API call
    await waitFor(() => expect(requests.find((r) => r.url?.endsWith('/api/generate-pipeline'))).toBeDefined());
    const genReq = requests.find((r) => r.url?.endsWith('/api/generate-pipeline'));
    expect(genReq).toBeDefined();
    expect(genReq.method).toBe('POST');
    expect(genReq.body).toBeDefined();
    const genRepoField = genReq.body.repositoryUrl || genReq.body.repoUrl || genReq.body.url;
    expect(genRepoField).toBe('https://github.com/example/repo');

    // Navigate to Pipeline Visualizer and check it renders
    const vizBtn = screen.getByRole('button', { name: /pipeline/i });
    fireEvent.click(vizBtn);

    await waitFor(() =>
      expect(screen.queryByTestId('pipeline-visualizer-view')).toBeInTheDocument()
    );

    // Optional: verify that pipeline data is displayed if UI exposes it
    // For example, a pipeline-id element
    expect(screen.queryByTestId('pipeline-id')).toBeInTheDocument();
  });

  test('Form validation prevents submission with empty repository URL', async () => {
    render(<App />);

    // Open Repository Form
    const repoNavBtn = screen.getByRole('button', { name: /repository/i });
    fireEvent.click(repoNavBtn);

    // Attempt to submit without URL
    const analyzeBtn = screen.queryByRole('button', { name: /analyze/i });
    expect(analyzeBtn).toBeInTheDocument();
    fireEvent.click(analyzeBtn);

    // Expect validation message (text may vary by implementation)
    // Try common messages
    const validationMessage = await screen.findByText(/please\s*(enter|provide).*repository\s*(url|address)/i, {
      exact: false,
    });
    expect(validationMessage).toBeInTheDocument();

    // Ensure no API calls were made
    expect(requests.length).toBe(0);
  });
});