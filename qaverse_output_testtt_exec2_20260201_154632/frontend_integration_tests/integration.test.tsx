import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';

describe('Frontend integration tests for React app', () => {
  // Mock API responses for the detected endpoints
  const mockAnalzyResponse = {
    repoName: 'demo-repo',
    analyzed: true,
    details: { stars: 42 },
  };

  const mockPipelineResponse = {
    pipelineId: 'pipeline-001',
    name: 'Demo Pipeline',
  };

  beforeEach(() => {
    jest.resetAllMocks();

    global.fetch = jest.fn((url, options) => {
      if (url.endsWith('/api/analyze-repository')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockAnalzyResponse,
        });
      }
      if (url.endsWith('/api/generate-pipeline')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPipelineResponse,
        });
      }
      // Default generic response
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('navigation between ACTUAL components via generic navigation elements', async () => {
    render(<App />);

    // Attempt navigation to Repository Form
    const repoNav =
      screen.queryByRole('link', { name: /repository form/i }) ||
      screen.queryByText(/repository form/i);
    if (repoNav) {
      await userEvent.click(repoNav);
    }

    // Expect Repository Form to be visible (by a form label or heading)
    await screen.findByLabelText(/repository url/i, {}, { timeout: 2000 }).catch(() => {
      // Fallback if label isn't exposed; look for a generic form heading
      return screen.findByText(/repository form/i, {}, { timeout: 2000 });
    });

    // Navigate to Pipeline Visualizer
    const visNav =
      screen.queryByRole('link', { name: /pipeline visualizer/i }) ||
      screen.queryByText(/pipeline visualizer/i);
    if (visNav) {
      await userEvent.click(visNav);
    }

    // Expect Pipeline Visualizer to be visible
    await screen.findByText(/pipeline visualizer/i, {}, { timeout: 2000 }).catch(() => {
      // If specific text isn't present, fail gracefully
      throw new Error('Pipeline Visualizer view did not render after navigation.');
    });
  });

  test('form interactions: submit repository form triggers analyze and pipeline API calls and data flows to visualizer', async () => {
    render(<App />);

    // Navigate to Repository Form
    const repoNav =
      screen.queryByRole('link', { name: /repository form/i }) ||
      screen.queryByText(/repository form/i);
    if (repoNav) await userEvent.click(repoNav);

    // Fill in required fields
    const urlInput = await screen.findByLabelText(/repository url/i);
    await userEvent.type(urlInput, 'https://github.com/user/demo-repo');

    // Submit the form (looking for a sensible button name)
    const submitBtn =
      screen.queryByRole('button', { name: /analyze/i }) ||
      screen.queryByRole('button', { name: /submit/i });
    await userEvent.click(submitBtn!);

    // Validate first API call to analyze repository
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analyze-repository'),
        expect.objectContaining({ method: 'POST' })
      )
    );

    // Validate second API call to generate pipeline
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate-pipeline'),
        expect.objectContaining({ method: 'POST' })
      )
    );

    // Validate data flow to Pipeline Visualizer (data rendered from API response)
    await screen.findByText(/pipeline|Demo Pipeline|pipeline-001/i, {}, { timeout: 2000 }).catch(() => {
      // If not rendered as text, fail with a helpful message
      throw new Error('Pipeline data did not render in visualizer after API calls.');
    });
  });

  test('form validations: submitting without required fields shows validation messages', async () => {
    render(<App />);

    // Navigate to Repository Form
    const repoNav =
      screen.queryByRole('link', { name: /repository form/i }) ||
      screen.queryByText(/repository form/i);
    if (repoNav) await userEvent.click(repoNav);

    // Do not fill repository URL and submit
    const submitBtn =
      screen.queryByRole('button', { name: /analyze/i }) ||
      screen.queryByRole('button', { name: /submit/i });
    await userEvent.click(submitBtn!);

    // Expect a validation error about repository URL
    await screen.findByText(/repository url.*required|please enter a repository url/i, {}, { timeout: 2000 });
  });

  test('API error handling: analyze repository failure shows user-friendly message', async () => {
    // Override fetch behavior for this test to simulate an API error on analyze
    (global.fetch as jest.Mock).mockImplementationOnce((url, options) => {
      if (url.endsWith('/api/analyze-repository')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Invalid repository URL' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });

    render(<App />);

    // Navigate to Repository Form
    const repoNav =
      screen.queryByRole('link', { name: /repository form/i }) ||
      screen.queryByText(/repository form/i);
    if (repoNav) await userEvent.click(repoNav);

    // Enter an invalid URL and submit
    const urlInput = await screen.findByLabelText(/repository url/i);
    await userEvent.type(urlInput, 'invalid-url');
    const submitBtn =
      screen.queryByRole('button', { name: /analyze/i }) ||
      screen.queryByRole('button', { name: /submit/i });
    await userEvent.click(submitBtn!);

    // Expect an error message in UI
    await screen.findByText(/invalid repository url|failed to analyze/i, {}, { timeout: 2000 });
  });
});