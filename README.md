# Test Pipeline Generator

An AI-powered web application that analyzes code repositories and automatically generates comprehensive CI/CD test pipelines using OpenAI's GPT-5 model.

## Features

- **AI-Powered Analysis**: Uses OpenAI GPT-5 to intelligently analyze your codebase
- **Comprehensive Test Coverage**: Generates pipelines covering all test types:
  - Unit Tests (Backend & Frontend)
  - Integration Tests (Backend & Frontend)
  - Code Quality Analysis (SonarQube-like)
  - Performance Testing
  - Security Testing
- **Visual Pipeline Display**: Beautiful, interactive visualization of your test pipeline
- **Auto-Detection**: Automatically detects programming languages and frameworks
- **Flexible Input**: Support for repository URLs or direct code input

## Technology Stack

### Backend
- **FastAPI**: Modern, fast Python web framework
- **OpenAI API**: GPT-5 for intelligent pipeline generation
- **Python 3.8+**: Core backend language

### Frontend
- **React 18**: Modern UI library
- **Vite**: Fast build tool and development server
- **Axios**: HTTP client for API communication

## Project Structure

```
testpipeline/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py          # FastAPI application
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── RepositoryForm.jsx
│   │   │   └── PipelineVisualizer.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json          # Node dependencies
├── .env.example              # Environment variables template
├── .gitignore
└── README.md
```

## Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn
- OpenAI API key with access to GPT-5

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd testpipeline
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=your_actual_api_key_here
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Start the Backend Server

From the `backend` directory:

```bash
# Make sure virtual environment is activated
source venv/bin/activate  # Linux/Mac
# or venv\Scripts\activate on Windows

# Run the server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`

### Start the Frontend Development Server

From the `frontend` directory (in a new terminal):

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

1. **Open the Application**: Navigate to `http://localhost:3000` in your web browser

2. **Enter Repository Information**:
   - Provide a repository URL (GitHub, GitLab, Bitbucket)
   - OR paste code content directly
   - Optionally specify the programming language and framework

3. **Auto-Detect (Optional)**: Click "Auto-Detect Language" to have AI identify your tech stack

4. **Generate Pipeline**: Click "Generate Pipeline" to create your comprehensive test pipeline

5. **Review Results**: The application will display:
   - All test stages with detailed commands
   - Tools and frameworks recommended for each stage
   - Estimated duration for each stage
   - Overall pipeline summary
   - Recommendations for improvement

## API Endpoints

### `POST /api/generate-pipeline`

Generate a comprehensive test pipeline.

**Request Body:**
```json
{
  "repository_url": "https://github.com/user/repo",
  "repository_content": "optional code content",
  "language": "Python",
  "framework": "FastAPI"
}
```

**Response:**
```json
{
  "stages": [
    {
      "name": "Backend Unit Tests",
      "type": "unit_test_backend",
      "description": "Test individual backend components",
      "commands": ["pytest tests/unit"],
      "tools": ["pytest", "coverage"],
      "estimatedDuration": "5 minutes"
    }
  ],
  "summary": "Comprehensive pipeline summary",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
```

### `POST /api/analyze-repository`

Analyze repository to detect language and framework.

**Request Body:**
```json
{
  "repository_url": "https://github.com/user/repo",
  "repository_content": "optional code content"
}
```

**Response:**
```json
{
  "language": "Python",
  "framework": "FastAPI",
  "projectType": "REST API",
  "recommendedTools": ["pytest", "black", "flake8"]
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

## Test Pipeline Stages

The generated pipeline covers the following test types:

### 1. Unit Tests (Backend)
- Test individual functions and classes
- Mock external dependencies
- Tools: pytest, Jest, JUnit, etc.

### 2. Unit Tests (Frontend)
- Test individual components
- Test utility functions
- Tools: Jest, React Testing Library, Vitest

### 3. Integration Tests (Backend)
- API endpoint testing
- Database integration tests
- Service-to-service communication
- Tools: pytest, Postman, RestAssured

### 4. Integration Tests (Frontend)
- Component integration testing
- API integration tests
- End-to-end user flows
- Tools: Cypress, Playwright, Testing Library

### 5. Code Quality Analysis
- Static code analysis
- Code coverage measurement
- Linting and formatting
- Security vulnerability scanning
- Tools: SonarQube, ESLint, Pylint, Bandit

### 6. Performance Tests
- Load testing
- Stress testing
- Performance benchmarking
- Tools: JMeter, Locust, k6, Lighthouse

### 7. Security Tests
- Dependency vulnerability scanning
- SAST (Static Application Security Testing)
- DAST (Dynamic Application Security Testing)
- Tools: OWASP ZAP, Snyk, Trivy

## Customization

### Modify Pipeline Generation Logic

Edit `backend/app/main.py` to customize the prompt or add additional pipeline stages.

### Customize UI

Edit components in `frontend/src/components/` to modify the user interface.

### Add New Test Types

1. Update the backend prompt in `main.py` to include new test types
2. Add corresponding styling in `frontend/src/index.css`
3. Update the `stageIcons` in `PipelineVisualizer.jsx` if needed

## Troubleshooting

### OpenAI API Errors

- **Invalid API Key**: Ensure your `.env` file contains a valid OpenAI API key
- **Rate Limits**: If you hit rate limits, wait and try again or upgrade your OpenAI plan
- **Model Not Available**: If GPT-5 is not available, change the model to "gpt-4" or "gpt-4-turbo" in `backend/app/main.py`

### CORS Issues

If you experience CORS errors, ensure:
- Backend is running on port 8000
- Frontend is running on port 3000
- CORS middleware is properly configured in `main.py`

### Port Already in Use

If ports 3000 or 8000 are in use:
- Backend: Add `--port 8001` to the uvicorn command
- Frontend: Modify the port in `vite.config.js`

## Development

### Backend Development

```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd frontend
npm run dev
```

## Building for Production

### Build Frontend

```bash
cd frontend
npm run build
```

The production build will be in `frontend/dist/`

### Deploy Backend

For production deployment:
1. Set appropriate environment variables
2. Use a production WSGI server (gunicorn)
3. Configure proper CORS origins
4. Set up SSL/TLS certificates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or contributions, please open an issue in the repository.

## Acknowledgments

- OpenAI for providing the GPT-5 API
- FastAPI for the excellent Python web framework
- React team for the powerful UI library
