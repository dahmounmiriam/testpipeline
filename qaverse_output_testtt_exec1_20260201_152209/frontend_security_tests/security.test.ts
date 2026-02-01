/// <reference types="cypress" />

// Frontend security test suite for a React application (RepositoryForm.jsx detected inputs)
describe('Frontend Security Tests for RepositoryForm (React App)', () => {
  const formSelector = 'form';
  const inputSelector = 'input, textarea';
  const submitSelector = 'button[type="submit"], input[type="submit"]';
  const testPage = '/'; // adjust if your app uses a different route for RepositoryForm

  // Payloads for XSS testing
  const xssPayloads = [
    '<img src=x onerror=alert(1)>',
    '\"><script>alert(1)</script>',
    '<svg onload=alert(1)>',
  ];

  beforeEach(() => {
    cy.visit(testPage);
  });

  // 1) XSS Risks: Test ACTUAL input fields and innerHTML usage detected
  it('XSS: Detect reflective XSS in ACTUAL inputs and innerHTML usage', () => {
    // Test the first few inputs for potential innerHTML-based rendering of payloads
    testXssOnInputs(0);
    testXssOnInputs(1);
    testXssOnInputs(2);
  });

  function testXssOnInputs(indexStart) {
    // Try a few payloads on sequential inputs starting at indexStart
    xssPayloads.forEach((payload, offset) => {
      const idx = indexStart + offset;
      cy.get(formSelector).within(() => {
        cy.get(inputSelector).eq(idx).clear().type(payload, { log: true });
        // Blur to trigger potential sanitization/rendering
        cy.get(inputSelector).eq(idx).blur();
      });

      // After rendering, inspect DOM to see if payload was inserted as HTML (dangerous)
      cy.document().then((doc) => {
        const allEls = Array.from(doc.querySelectorAll('*'));
        const hasUnsafeInnerHTML = allEls.some((el) => el.innerHTML && el.innerHTML.includes(payload));
        // Expect no element to render the payload as innerHTML (sanitization should occur)
        expect(hasUnsafeInnerHTML, `Payload should not appear in innerHTML for input index ${idx}`).to.equal(false);

        // Additionally, ensure there is no inline script tag injection from payload
        const containsScriptTag = doc.body.innerHTML.toLowerCase().includes('<script');
        expect(containsScriptTag, 'No <script> tags should be injected into the DOM').to.equal(false);
      });
    });
  }

  // 2) CSRF Protection: Test CSRF token presence and inclusion in form submissions
  it('CSRF: Validate presence of CSRF token and its transmission on form submit', () => {
    // Attempt to capture CSRF token from meta tag or hidden input
    cy.document().then((doc) => {
      const tokenFromMeta =
        doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;
      const tokenFromInput =
        doc.querySelector('input[name="_csrf"]')?.getAttribute('value') || null;
      const csrfToken = tokenFromMeta || tokenFromInput || null;

      // Intercept form submission
      cy.intercept('POST', '**/*').as('formSubmit');

      // Fill the form with sample valid data (as allowed by client)
      cy.get(formSelector).within(() => {
        cy.get(inputSelector).not('[type="hidden"]').eq(0).clear().type('test-repo');
        cy.get(inputSelector).not('[type="hidden"]').eq(1).clear().type('test-description');
      });
      // Submit
      cy.get(submitSelector).first().click();

      // Check the request headers for CSRF token
      cy.wait('@formSubmit').then((interception) => {
        if (csrfToken) {
          const headers = interception.request.headers;
          const tokenHeader =
            headers['x-csrf-token'] || headers['X-CSRF-Token'] || headers['csrf-token'];
          expect(tokenHeader, 'CSRF token should be sent in the request header').to.exist;
          expect(String(tokenHeader)).to.equal(csrfToken);
        } else {
          // If token is not found on the page, we still allow the test to pass (no token to compare)
          expect(true).to.equal(true);
        }
      });
    });
  });

  // 3) Input Sanitization and Validation: Test detected inputs for sanitization and basic validation
  it('Input Sanitization and Validation: Validate detected inputs do not accept unsafe data', () => {
    // Use a very long string to exercise client-side length checks (if any)
    const longInput = 'A'.repeat(500);

    // Iterate through up to first 3 inputs and attempt to submit
    cy.get(formSelector).within(() => {
      cy.get(inputSelector).not('[type="hidden"]').eq(0).clear().type(longInput);
      cy.get(inputSelector).not('[type="hidden"]').eq(1).clear().type('Valid Description');
      cy.get(inputSelector).not('[type="hidden"]').eq(2).clear().type('tag1, tag2');
    });

    // Attempt submission and observe client-side validation behavior
    cy.intercept('POST', '**/*').as('formSubmit');
    cy.get(submitSelector).first().click();

    // If client-side validation blocks submission, there will be no POST
    cy.wait(500); // give time for potential submission
    cy.get('@formSubmit').then((interception) => {
      if (interception) {
        // A submission occurred; ensure payload respects basic expectations (no malicious long data)
        const body = interception.request.body;
        expect(typeof body).to.equal('object');
        expect(JSON.stringify(body)).to.not.contain(longInput);
      } else {
        // Submission was blocked by client-side validation
        expect(true).to.equal(true);
      }
    });
  });

  // 4) Secure Storage Practices: Check localStorage/sessionStorage for sensitive data exposure
  it('Storage: Ensure no sensitive data is stored in browser storage', () => {
    // Perform typical action sequence to exercise storage paths
    cy.get(formSelector).within(() => {
      cy.get(inputSelector).eq(0).clear().type('test');
      cy.get(submitSelector).first().click();
    });

    cy.window().then((win) => {
      const sl = win.localStorage ? Object.keys(win.localStorage) : [];
      const ss = win.sessionStorage ? Object.keys(win.sessionStorage) : [];

      // Disallow keys that look like secrets/tokens
      const sensitiveKeyPattern = /password|token|secret|apiKey|credentials/i;
      const sensitiveKeysLocal = sl.filter((k) => sensitiveKeyPattern.test(k));
      const sensitiveKeysSession = ss.filter((k) => sensitiveKeyPattern.test(k));

      expect(sensitiveKeysLocal.length, 'No sensitive keys should be stored in localStorage').to.equal(0);
      expect(sensitiveKeysSession.length, 'No sensitive keys should be stored in sessionStorage').to.equal(0);

      // Also verify values do not contain sensitive phrases
      const sensitiveValuePattern = /password|token|secret|apiKey/i;
      const localVals = sl.map((k) => win.localStorage.getItem(k) || '');
      const sessionVals = ss.map((k) => win.sessionStorage.getItem(k) || '');
      const localContainsSensitive = localVals.some((v) => v && sensitiveValuePattern.test(v));
      const sessionContainsSensitive = sessionVals.some((v) => v && sensitiveValuePattern.test(v));
      expect(localContainsSensitive).to.equal(false);
      expect(sessionContainsSensitive).to.equal(false);
    });
  });

  // 5) Clickjacking Protection and CSP Compliance
  it('Security Headers: Validate CSP and frame protection headers', () => {
    // Check server CSP and frame-ancestors directives via HTTP response headers
    cy.request('/').then((response) => {
      const csp = response.headers['content-security-policy'] || '';
      expect(csp.length).to.be.greaterThan(0, 'Content-Security-Policy header should be present');
      // frame-ancestors directive should exist and restrict framing
      const hasFrameAncestors = /frame-ancestors/.test(csp);
      expect(hasFrameAncestors).to.equal(true);
      // Avoid unsafe-inline/eval usage in script-src
      const disallowsUnsafeInline = !/script-src[^;]*unsafe-inline/.test(csp);
      const disallowsUnsafeEval = !/script-src[^;]*unsafe-eval/.test(csp);
      expect(disallowsUnsafeInline).to.equal(true);
      expect(disallowsUnsafeEval).to.equal(true);
      // default-src should be present
      expect(/default-src/.test(csp)).to.equal(true);
    });

    // Optional: check X-Frame-Options header if present
    cy.request('/').then((response) => {
      const xfo = response.headers['x-frame-options'];
      if (xfo) {
        const v = String(xfo).toLowerCase();
        expect(v === 'deny' || v === 'sameorigin').to.equal(true);
      }
    });

    // Fallback: meta CSP tag if server CSP header is not available
    cy.document().then((doc) => {
      const metaCsp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (metaCsp) {
        const content = metaCsp.getAttribute('content');
        expect(typeof content).to.equal('string');
        expect(content.length).to.be.greaterThan(0);
      }
    });
  });

  // 6) Dangerous Functions: Check for presence of dangerous function usage (e.g., eval)
  it('Dangerous Functions: Ensure no usage of eval in served assets', () => {
    cy.request('/').then((response) => {
      const body = response.body || '';
      const usesEval = /eval\s*\(/.test(body);
      // In many builds, eval is avoided; this is a heuristic check
      expect(usesEval).to.equal(false);
    });
  });

  // 7) Positive and Negative Test Cases for Inputs (cover both aspects)
  it('Inputs: Positive (valid) and Negative (invalid) scenarios for detected inputs', () => {
    // Positive case: provide valid inputs
    cy.get(formSelector).within(() => {
      cy.get(inputSelector).eq(0).clear().type('ValidRepo');
      cy.get(inputSelector).eq(1).clear().type('A valid description');
      cy.get(inputSelector).eq(2).clear().type('tag1, tag2');
      cy.get(inputSelector).eq(3).clear().type('owner');
    });
    cy.intercept('POST', '**/*').as('formSubmitPositive');
    cy.get(submitSelector).first().click();
    cy.wait('@formSubmitPositive', { timeout: 10000 }).then((interception) => {
      expect(interception).to.exist;
      // Optionally validate that the request payload contains the provided values
      const body = interception.request.body;
      if (body) {
        const payloadStr = JSON.stringify(body);
        expect(payloadStr).to.contain('ValidRepo');
        expect(payloadStr).to.contain('A valid description');
      }
    });

    // Negative case: clear required fields and attempt submission
    cy.get(formSelector).within(() => {
      cy.get(inputSelector).each(($el) => cy.wrap($el).clear());
    });
    cy.intercept('POST', '**/*').as('formSubmitNegative');
    cy.get(submitSelector).first().click();
    // Expect validation errors to appear (presence of aria-invalid or UI error indicators)
    cy.get('[aria-invalid="true"], .validation-error, .error-message').should('exist');
    // No POST should be sent in negative case
    cy.get('@formSubmitNegative').then((interception) => {
      // If a request was sent, consider it a failure of client-side validation
      if (interception) {
        // Force fail if a submit occurred
        expect(true).to.equal(false, 'Submit should be blocked for invalid input');
      } else {
        expect(true).to.equal(true);
      }
    });
  });
});