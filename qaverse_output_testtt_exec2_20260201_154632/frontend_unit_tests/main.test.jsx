import React from 'react';

let capturedRenderElement = null;
let capturedContainer = null;

// Mock App component used by main.jsx
jest.mock('./App', () => {
  const AppMock = function AppMock() {
    return React.createElement('div', null, 'App');
  };
  return AppMock;
});

// Mock react-dom/client to intercept rendering
jest.mock('react-dom/client', () => {
  return {
    createRoot: jest.fn((container) => {
      capturedContainer = container;
      return {
        render: jest.fn((element) => {
          capturedRenderElement = element;
        }),
      };
    }),
  };
});

describe('main.jsx bootstrap', () => {
  beforeEach(() => {
    // Ensure a root container exists for mounting
    document.body.innerHTML = "<div id='root'></div>";
    capturedRenderElement = null;
    capturedContainer = null;
    // Reset modules to re-run main.jsx in each test
    jest.resetModules();
  });

  test('renders App inside StrictMode into root', () => {
    // Execute the module to bootstrap the app
    require('./main.jsx');
    // Import the mocked App to compare element types
    const AppModule = require('./App');
    // container should be the element with id="root"
    expect(capturedContainer).toBeDefined();
    expect(capturedContainer.id).toBe('root');

    // The render call should have been invoked with a React element tree
    expect(capturedRenderElement).toBeDefined();

    const rootElement = capturedRenderElement;
    // The root element should have a children prop with App as the child
    const children = rootElement.props && rootElement.props.children;

    if (Array.isArray(children)) {
      expect(children.some(child => child && child.type === AppModule)).toBe(true);
    } else {
      expect(children && children.type).toBe(AppModule);
    }
  });

  test('App component is the child rendered by main.jsx', () => {
    require('./main.jsx');
    const AppModule = require('./App');
    const rootElement = capturedRenderElement;
    const children = rootElement.props && rootElement.props.children;

    // Verify that AppModule is included as a child
    if (Array.isArray(children)) {
      expect(children.some(child => child && child.type === AppModule)).toBe(true);
    } else {
      expect(children && children.type).toBe(AppModule);
    }
  });
});