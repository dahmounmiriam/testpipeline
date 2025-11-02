from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
from openai import OpenAI
import json

app = FastAPI(title="Test Pipeline Generator")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class RepositoryInput(BaseModel):
    repository_url: Optional[str] = None
    repository_content: Optional[str] = None
    language: Optional[str] = None
    framework: Optional[str] = None

class PipelineStage(BaseModel):
    name: str
    type: str
    description: str
    commands: List[str]
    tools: List[str]
    estimatedDuration: str

class PipelineResponse(BaseModel):
    stages: List[PipelineStage]
    summary: str
    recommendations: List[str]

@app.get("/")
async def root():
    return {"message": "Test Pipeline Generator API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/generate-pipeline", response_model=PipelineResponse)
async def generate_pipeline(repo_input: RepositoryInput):
    """
    Generate a comprehensive test pipeline for a code repository
    """
    try:
        # Construct the prompt for GPT-5
        prompt = f"""
You are an expert DevOps and Testing engineer. Analyze the following repository information and generate a comprehensive CI/CD test pipeline that covers all testing aspects.

Repository Information:
- URL: {repo_input.repository_url or 'Not provided'}
- Language: {repo_input.language or 'Auto-detect'}
- Framework: {repo_input.framework or 'Auto-detect'}
- Content Sample: {repo_input.repository_content[:500] if repo_input.repository_content else 'Not provided'}

Generate a detailed pipeline with the following test stages:
1. **Unit Tests (Backend)**: Tests for individual backend components, functions, and classes
2. **Unit Tests (Frontend)**: Tests for individual frontend components and functions
3. **Integration Tests (Backend)**: Tests for API endpoints, database interactions, and service integrations
4. **Integration Tests (Frontend)**: Tests for component interactions, API calls, and user flows
5. **Code Quality Analysis**: Static code analysis, linting, code coverage, and security scanning (SonarQube-like)
6. **Performance Tests**: Load testing, stress testing, and performance benchmarks
7. **Security Tests**: Vulnerability scanning, dependency checks, and security best practices

For each stage, provide:
- Stage name
- Type (unit_test_backend, unit_test_frontend, integration_test_backend, integration_test_frontend, code_quality, performance_test, security_test)
- Description
- Specific commands to run
- Tools/frameworks to use
- Estimated duration

Also provide:
- A summary of the pipeline
- Recommendations for improving test coverage

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{{
    "stages": [
        {{
            "name": "Stage Name",
            "type": "stage_type",
            "description": "Description",
            "commands": ["command1", "command2"],
            "tools": ["tool1", "tool2"],
            "estimatedDuration": "duration"
        }}
    ],
    "summary": "Pipeline summary",
    "recommendations": ["recommendation1", "recommendation2"]
}}
"""

        # Call OpenAI API with GPT-5
        response = client.chat.completions.create(
            model="gpt-5",  # Using GPT-5 as requested
            messages=[
                {"role": "system", "content": "You are an expert DevOps engineer specializing in CI/CD pipeline design and comprehensive testing strategies. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=3000
        )

        # Extract and parse the response
        content = response.choices[0].message.content.strip()

        # Remove markdown code blocks if present
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        # Parse JSON response
        pipeline_data = json.loads(content)

        return PipelineResponse(**pipeline_data)

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating pipeline: {str(e)}")

@app.post("/api/analyze-repository")
async def analyze_repository(repo_input: RepositoryInput):
    """
    Analyze a repository and detect language, framework, and structure
    """
    try:
        prompt = f"""
Analyze this code repository and provide:
1. Primary programming language
2. Framework/technology stack
3. Project type (web app, API, library, etc.)
4. Recommended testing tools

Repository URL: {repo_input.repository_url or 'Not provided'}
Code Sample: {repo_input.repository_content[:1000] if repo_input.repository_content else 'Not provided'}

Return ONLY valid JSON:
{{
    "language": "detected language",
    "framework": "detected framework",
    "projectType": "project type",
    "recommendedTools": ["tool1", "tool2"]
}}
"""

        response = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "system", "content": "You are a code analysis expert. Respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )

        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        return json.loads(content)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing repository: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
