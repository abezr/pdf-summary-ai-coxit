# PDF Summary AI - Knowledge Graph Architecture

**Document-aware PDF summarization system with multi-provider LLM support (OpenAI GPT-4o & GCP Vertex AI)**

![Architecture](https://img.shields.io/badge/Architecture-C4%20Model-blue) ![LLM](https://img.shields.io/badge/LLM-OpenAI%20%7C%20GCP-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)

## 🎯 Project Overview

This system treats PDFs not as flat text but as **structured knowledge graphs** where:
- **Nodes** = Document elements (sections, tables, images, paragraphs)
- **Edges** = Relationships (hierarchy, references, citations)
- **Retrieval** = Graph traversal (like humans flipping pages)

This architecture eliminates hallucinations through precision grounding and supports continuous quality evaluation.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- OpenAI API key OR GCP Vertex AI credentials

### Run with Docker

```bash
# Clone repository
git clone https://github.com/abezr/pdf-summary-ai-coxit.git
cd pdf-summary-ai-coxit

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access application
# Frontend: http://localhost:3000
# API: http://localhost:4000
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
# Jaeger: http://localhost:16686
```

### Run Locally (Development)

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start services
# Terminal 1: PostgreSQL & Redis
docker-compose up postgres redis

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Worker
cd backend
npm run worker

# Terminal 4: Frontend
cd frontend
npm start
```

## 📋 Features

### Core Features
- ✅ PDF upload (up to 50MB, 100 pages)
- ✅ Advanced parsing (text, tables, images)
- ✅ Knowledge graph construction
- ✅ Graph-grounded AI summarization
- ✅ Real-time progress via WebSockets
- ✅ Last 5 documents history
- ✅ Interactive graph visualization

### Multi-Provider LLM Support
- **OpenAI GPT-4o** - 128k context, structured outputs
- **GCP Vertex AI** - Gemini Pro, Claude 3.5 Sonnet
- Automatic provider selection based on configuration
- Cost tracking per provider

### Quality Assurance
- Continuous evaluation (grounding, hallucination detection)
- Citation accuracy scoring
- Automated regression testing
- Golden dataset benchmarking

### Observability
- Prometheus metrics collection
- Grafana dashboards (system health, AI quality, costs)
- OpenTelemetry distributed tracing
- Real-time alerts

## 🏗️ Architecture

### System Context (C1)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Users     │────▶│  PDF Summary │────▶│ OpenAI/GCP  │
│ (Web App)   │     │      AI      │     │  LLM APIs   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Storage    │
                    │  (S3/GCS)   │
                    └─────────────┘
```

### Container Diagram (C2)

**Frontend Tier**
- React 18 SPA with TypeScript
- Real-time WebSocket updates
- D3.js graph visualization

**Backend Tier**
- Node.js Express API Gateway
- Bull queue processing workers (3 replicas)
- Document Processing Engine:
  - PDF Parser (pdf-parse, pdfplumber)
  - Graph Builder (NetworkX-inspired)
  - AI Summarizer (RAG pipeline)
  - Evaluation Engine

**Data Tier**
- PostgreSQL (metadata, users, history)
- Redis (job queue, cache)
- S3/GCS (PDFs, graphs, summaries)

**Observability Tier**
- Prometheus (metrics)
- Grafana (dashboards)
- Jaeger (distributed tracing)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete C4 model documentation.

## 🔧 Configuration

### Environment Variables

```bash
# LLM Provider Selection
LLM_PROVIDER=openai  # or 'gcp'

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-large

# GCP Vertex AI Configuration
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
GCP_MODEL=gemini-1.5-pro  # or claude-3-5-sonnet@20240620
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pdfdb
REDIS_URL=redis://localhost:6379

# Storage
STORAGE_PROVIDER=s3  # or 'gcs'
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=pdf-summaries
GCS_BUCKET=pdf-summaries-gcp

# Application
NODE_ENV=production
PORT=4000
MAX_FILE_SIZE=52428800  # 50MB
MAX_PAGES=100
WORKER_CONCURRENCY=3

# Observability
PROMETHEUS_PORT=9090
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

## 📊 API Documentation

### Upload PDF

```http
POST /api/v1/documents/upload
Content-Type: multipart/form-data

{
  "file": <PDF file>,
  "user_id": "string"
}

Response:
{
  "job_id": "uuid",
  "status": "processing",
  "websocket_url": "ws://localhost:4000/api/v1/documents/{job_id}/status"
}
```

### Get Summary

```http
GET /api/v1/documents/:id

Response:
{
  "id": "uuid",
  "filename": "document.pdf",
  "summary": "...",
  "quality_metrics": {
    "grounding_score": 0.92,
    "hallucination_rate": 0.03,
    "coherence": 0.88,
    "citation_accuracy": 0.95
  },
  "graph_url": "https://s3.../graph.json",
  "created_at": "2024-11-26T00:00:00Z"
}
```

### List Documents

```http
GET /api/v1/documents?limit=5

Response:
{
  "documents": [
    {
      "id": "uuid",
      "filename": "report.pdf",
      "status": "completed",
      "created_at": "2024-11-26T00:00:00Z"
    }
  ],
  "total": 5
}
```

### WebSocket Progress

```javascript
const ws = new WebSocket('ws://localhost:4000/api/v1/documents/{jobId}/status');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
  // { stage: 'parsing', progress: 50, message: 'Extracting tables...' }
};
```

## 🧪 Testing

### Unit Tests

```bash
cd backend
npm test

# With coverage
npm run test:coverage
```

### Integration Tests

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration
```

### Regression Testing

```bash
# Run against golden dataset
npm run test:regression

# View results
open http://localhost:3001/d/regression-dashboard
```

## 📈 Monitoring

### Grafana Dashboards

1. **System Health** (http://localhost:3001/d/system-health)
   - API latency (p50, p95, p99)
   - Error rates
   - Queue depth
   - Worker utilization

2. **AI Quality** (http://localhost:3001/d/ai-quality)
   - Grounding score trends
   - Hallucination rate over time
   - Citation accuracy
   - User feedback scores

3. **Cost Analysis** (http://localhost:3001/d/cost-analysis)
   - Daily/monthly spend by provider
   - Cost per document
   - Token usage distribution
   - Cost efficiency metrics

### Alerts

```yaml
# High error rate
error_rate > 0.05 for 5m → Slack notification

# High latency
p95_latency > 10s for 5m → Slack notification

# Quality degradation
grounding_score < 0.80 for 1h → Email + PagerDuty

# Budget exceeded
daily_spend > $100 → Email finance team
```

## 🚀 Deployment

### Production Deployment (AWS)

```bash
# Build and push Docker images
docker build -t pdf-summary-ai/backend:latest ./backend
docker build -t pdf-summary-ai/frontend:latest ./frontend

# Deploy to ECS/EKS
# See deployment/aws/ for Terraform configuration
```

### Scaling Configuration

```yaml
# Horizontal Pod Autoscaler (Kubernetes)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: processing-worker
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: bull_queue_waiting_jobs
      target:
        type: AverageValue
        averageValue: "5"
```

## 📚 Documentation

- [Architecture Documentation](./ARCHITECTURE.md) - Complete C4 model
- [API Reference](./docs/API.md) - Full API specification
- [Development Guide](./docs/DEVELOPMENT.md) - Setup and contribution guide
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment
- [Performance Tuning](./docs/PERFORMANCE.md) - Optimization strategies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

## 🙏 Acknowledgments

Built for the COXIT Senior Full-Stack Developer (React/Node.js) with AI Experience position.

**Key Technologies:**
- OpenAI GPT-4o & GCP Vertex AI
- Node.js & TypeScript
- React 18
- PostgreSQL & Redis
- Docker & Docker Compose
- Prometheus & Grafana
- OpenTelemetry

## 📞 Contact

Anatolii Bezruchko - [abezr88@gmail.com](mailto:abezr88@gmail.com)

GitHub: [@abezr](https://github.com/abezr)

Project Link: [https://github.com/abezr/pdf-summary-ai-coxit](https://github.com/abezr/pdf-summary-ai-coxit)
