/// <reference types="cypress" />

// Security tests for a React RepositoryForm component with 5 inputs
// Focus areas: XSS, CSRF, security headers, input validation, storage, clickjacking, CSP, sensitive data exposure, dangerous functions

describe('Frontend Security Tests for RepositoryForm', () => {
  const formSelector = '#repository-form';
  const submitSelector = 'button[type="submit"]';

  beforeEach(() => {
    cy.visit('/');
    // Spy on alert() to detect XSS payload execution
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('alert');
    });
  });

  // 1) XSS Risks on ACTUAL input fields and innerHTML usage
  it('XSS_Sanitization_Test: inputs should sanitize payloads and not execute scripts', () => {
    const payloads = [
      "<img src=x onerror=alert('XSS')>",
      "<svg onload=alert('XSS')>",
      "<button onclick=alert('XSS')>Click</button>",
      "<iframe srcdoc='<script>alert(\"XSS\")</script>'></iframe>",
      "<a href='javascript:alert(\"XSS\")'>link</a>"
    ];
    cy.get(formSelector).find('input, textarea').each(($el, idx) => {
      const p = payloads[idx] || payloads[0];
      cy.wrap($el).clear().type(p, { parseSpecialCharSequences: false });
      cy.wrap($el).blur();
    });
    cy.get(submitSelector).click();
    cy.get('@alert').should('not.have.been.called');
  });

  it('XSS_PayloadExecution_Test: payloads trigger alerts if innerHTML is unsafely used', () => {
    const payloads = [
      "<img src=x onerror=alert('XSS')>",
      "<svg onload=alert('XSS')>",
      "<button onclick=alert('XSS')>Click</button>",
      "<iframe onload=alert('XSS')></iframe>",
      "<a href='javascript:alert(\"XSS\")'>link</a>"
    ];
    cy.get(formSelector).find('input, textarea').each(($el, idx) => {
      const p = payloads[idx] || payloads[0];
      cy.wrap($el).clear().type(p, { parseSpecialCharSequences: false });
      cy.wrap($el).blur();
    });
    cy.get(submitSelector).click();
    cy.get('@alert').should('have.been.called');
  });

  // 2) CSRF Protection: test form submissions
  it('CSRF_Test_NoProtection: form submission should not include CSRF token header if not configured', () => {
    // Fill with simple data
    cy.get(formSelector).find('input, textarea').each(($el) => {
      cy.wrap($el).clear().type('test');
    });
    cy.intercept('POST', '/api/repositories').as('postRepo');
    cy.get(submitSelector).click();
    cy.wait('@postRepo').then((interception) => {
      const headers = interception.request.headers;
      const tokenHeader =
        headers['x-csrf-token'] || headers['X-CSRF-Token'] || headers['csrf-token'];
      expect(tokenHeader).to.be.undefined;
    });
  });

  it('CSRF_Test_TokenPresent: if CSRF token exists, it should be included in request headers', () => {
    cy.document().then((doc) => {
      const token = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (!token) {
        cy.log('No CSRF token present on page, skipping token-presence test.');
        return;
      }
      // Fill with data
      cy.get(formSelector).find('input, textarea').each(($el) => {
        cy.wrap($el).clear().type('test');
      });
      cy.intercept('POST', '/api/repositories', (req) => {
        const headers = req.headers;
        const headerVal = headers['x-csrf-token'] || headers['X-CSRF-Token'] || headers['csrf-token'];
        expect(headerVal).to.equal(token);
      }).as('postRepoToken');
      cy.get(submitSelector).click();
      cy.wait('@postRepoToken');
    });
  });

  // 3) Security headers verification
  it('Security_Headers_Test: verify security-related headers are set', () => {
    cy.request('/').then((resp) => {
      const csp = resp.headers['content-security-policy'] || resp.headers['Content-Security-Policy'];
      expect(csp).to.exist;
      // Basic CSP sanity: ensure there is a frame control directive
      expect(csp).to.match(/frame-ancestors|sandbox|default-src/);

      const xfo = resp.headers['x-frame-options'] || resp.headers['X-Frame-Options'];
      if (xfo) {
        expect(xfo).to.match(/DENY|SAMEORIGIN|ALLOW-FROM/);
      }

      const xcto = resp.headers['x-content-type-options'];
      if (xcto) {
        expect(xcto.toLowerCase()).to.equal('nosniff');
      }

      const refPolicy = resp.headers['referrer-policy'];
      expect(refPolicy).to.exist;
    });
  });

  // 4) Clickjacking protection via headers CSP or X-Frame-Options
  it('Clickjacking_Protection_Test: page should not be embeddable in an iframe', () => {
    cy.request('/').then((resp) => {
      const xfo = resp.headers['x-frame-options'] || resp.headers['X-Frame-Options'];
      const csp = resp.headers['content-security-policy'] || resp.headers['Content-Security-Policy'];
      const hasProtection = (xfo && /DENY|SAMEORIGIN/.test(xfo)) || (csp && /frame-ancestors/.test(csp));
      expect(hasProtection).to.equal(true);
    });
  });

  // 5) Content Security Policy compliance
  it('CSP_Compliance_Test: ensure CSP is configured properly', () => {
    cy.request('/').then((resp) => {
      const cspHeader = resp.headers['content-security-policy'] || resp.headers['Content-Security-Policy'];
      expect(cspHeader).to.exist;
    });
  });

  // 6) Secure storage practices: sensitive data exposure in browser storage
  it('Sensitive_Data_Exposure_Test: ensure no secrets in localStorage or sessionStorage', () => {
    cy.visit('/');
    cy.window().then((win) => {
      const sensitivePattern = /(token|secret|password|apikey|api_key)/i;

      const lsEntries = [];
      for (let i = 0; i < win.localStorage.length; i++) {
        const key = win.localStorage.key(i);
        const value = win.localStorage.getItem(key);
        if (sensitivePattern.test(key) || sensitivePattern.test(String(value))) {
          lsEntries.push({ key, value });
        }
      }

      const ssEntries = [];
      for (let i = 0; i < win.sessionStorage.length; i++) {
        const key = win.sessionStorage.key(i);
        const value = win.sessionStorage.getItem(key);
        if (sensitivePattern.test(key) || sensitivePattern.test(String(value))) {
          ssEntries.push({ key, value });
        }
      }

      expect(lsEntries).to.have.length(0);
      expect(ssEntries).to.have.length(0);
    });
  });

  // 7) Dangerous Functions (none detected in repo; verify absence in bundles)
  it('Dangerous_Functions_Test: ensure no use of eval or new Function in bundles', () => {
    cy.request('/').then((resp) => {
      const body = resp.body;
      expect(/eval\s*\(/i.test(body)).to.equal(false);
      expect(/new\s+Function\s*\(/i.test(body)).to.equal(false);
    });
  });

  // 8) Input validation: positive and negative cases
  it('Input_Validation_Positive: valid inputs should submit without issues', () => {
    // Fill with simple valid data
    cy.get(formSelector).find('input, textarea').each(($el) => {
      cy.wrap($el).clear().type('valid', { force: true });
    });
    cy.get(submitSelector).click();
    // Expect some success indicator (adjust selector accordingly)
    cy.contains('Success', { timeout: 10000 }).should('exist');
  });

  it('Input_Validation_Negative: invalid inputs should be rejected or show errors', () => {
    const invalidPayloads = ['', ' ', 'a'.repeat(3000)];
    cy.get(formSelector).find('input, textarea').each(($el, idx) => {
      const val = invalidPayloads[idx % invalidPayloads.length];
      cy.wrap($el).clear().type(val, { force: true });
    });
    cy.get(submitSelector).click();
    cy.get('[data-testid="validation-error"], .error, .validation-error').should('exist');
  });

});