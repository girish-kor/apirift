# @apirift/cli

[![Tests](https://github.com/girish-kor/apirift/actions/workflows/test.yml/badge.svg)](https://github.com/girish-kor/apirift/actions)
[![npm version](https://badge.fury.io/js/%40apirift%2Fcli.svg)](https://www.npmjs.com/package/@apirift/cli)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

**Deterministic API replay and drift detection engine.**

Captures live HTTP traffic through a transparent proxy, replays it, and detects behavioral drift across status codes, response bodies, and latency—perfect for regression testing and API versioning validation.

## ✨ Key Features

- 🎯 **Deterministic Replay** - Replay captured traffic with exact timing control
- 🔍 **Drift Detection** - Catch behavioral changes across status, body, latency
- 🌐 **Transparent Proxy** - Capture production traffic without code changes
- 📊 **Detailed Analysis** - JSON reports with full request/response payloads
- 🔒 **Security First** - Automatic redaction of auth headers, field masking
- 🐳 **Docker Ready** - Pre-built Docker image for easy deployment
- ⚡ **Cross-Platform** - Works on Windows, macOS, Linux
- 🔄 **CI/CD Friendly** - Exit codes for pipeline integration

## 📋 Requirements

- Node.js 14.x or higher
- npm 6+ (or yarn)

## 🚀 Quick Start

### Installation

```bash
npm install -g @apirift/cli
# or locally
npm install --save-dev @apirift/cli
```

### Basic Workflow

**1. Capture live traffic:**
```bash
apirift capture --port 8080 --target http://localhost:3000
# Your app now proxies through http://localhost:8080
```

**2. Send requests through the proxy**
```bash
curl -x http://localhost:8080 https://api.example.com/users
```

**3. Replay the captured traffic:**
```bash
apirift replay --input logs/logs.jsonl --target http://new-api.example.com
```

**4. Analyze for drift:**
```bash
apirift analyze --baseline logs/logs.jsonl --candidate logs/replay.jsonl
```

## 📖 Commands

### capture
Capture HTTP traffic to a JSONL file.

```bash
apirift capture \
  --port 8080 \
  --target http://localhost:3000 \
  --output logs/logs.jsonl \
  --mask-fields "password,token" \
  --extra-headers "x-internal-key" \
  --filter-path "/api/" \
  --max-body-kb 256
```

**Options:**
- `--port` - Proxy listen port (default: 8080)
- `--target` - Forward requests to this URL
- `--output` - Write logs to this file (default: logs/logs.jsonl)
- `--mask-fields` - Comma-separated request body fields to redact
- `--extra-headers` - Headers to include beyond defaults
- `--filter-path` - Only capture requests matching this path
- `--max-body-kb` - Maximum request/response size (default: 256)

### replay
Replay captured traffic against a target URL.

```bash
apirift replay \
  --input logs/logs.jsonl \
  --target http://localhost:3000 \
  --output logs/replay.jsonl \
  --concurrency 4 \
  --delay 50 \
  --timeout 10000 \
  --dry-run
```

**Options:**
- `--input` - Read from this JSONL file
- `--target` - Replay requests against this URL
- `--output` - Write replay results (default: logs/replay.jsonl)
- `--concurrency` - Parallel requests (default: 1)
- `--delay` - Delay between requests in ms
- `--timeout` - Request timeout in ms (default: 30000)
- `--dry-run` - Don't send requests, only validate

**Exit codes:**
- `0` - All replays successful
- `1` - Replay errors occurred

### analyze
Compare baseline and candidate logs for drift.

```bash
apirift analyze \
  --baseline logs/logs.jsonl \
  --candidate logs/replay.jsonl \
  --latency 500 \
  --latency-ratio 2 \
  --normalize-keys "sessionToken,requestId" \
  --ignore-status "404,401"
```

**Options:**
- `--baseline` - Path to original capture
- `--candidate` - Path to replay results
- `--output` - Write report to file (default: reports/report.json)
- `--latency` - Absolute latency threshold in ms
- `--latency-ratio` - Relative latency multiplier
- `--normalize-keys` - Response fields to ignore (ephemeral data)
- `--ignore-status` - Comma-separated status codes to ignore

**Exit codes:**
- `0` - No drift detected
- `1` - Drift detected (ready for CI failure)

### validate
Validate a capture file format.

```bash
apirift validate --file logs/logs.jsonl
```

### inspect
Inspect and pretty-print a capture file.

```bash
apirift inspect --file logs/logs.jsonl | head -20
```

## 🔍 Drift Types

| Type                   | Description                                      |
|------------------------|--------------------------------------------------|
| `STATUS_MISMATCH`      | HTTP status code differs                         |
| `BODY_DIFF`            | Normalised response body differs                 |
| `LATENCY_EXCEEDED`     | Absolute ms regression past threshold            |
| `LATENCY_RATIO`        | Candidate N× slower than baseline                |
| `MISSING_IN_CANDIDATE` | Endpoint captured but not in replay              |
| `NEW_IN_CANDIDATE`     | Endpoint only in replay                          |
| `REPLAY_ERROR`         | Network failure during replay (status 0)         |

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
- name: Capture baseline
  run: apirift capture --port 8080 --target http://main.example.com

- name: Replay against candidate
  run: apirift replay --input logs/logs.jsonl --target http://pr.example.com

- name: Detect drift
  run: apirift analyze --baseline logs/logs.jsonl --candidate logs/replay.jsonl
  # Fails if drift detected (exit code 1)
```

### Jenkins

```groovy
stage('API Regression Test') {
  steps {
    sh 'apirift capture --target $BASELINE_URL'
    sh 'apirift replay --target $CANDIDATE_URL'
    sh 'apirift analyze'  // Exits 1 on drift
  }
}
```

## 🐳 Docker

Build the image:
```bash
npm run docker:build
```

Run capture in container:
```bash
docker run -p 8080:8080 apirift capture \
  --target http://host.docker.internal:3000
```

Or pull from GitHub Container Registry:
```bash
docker pull ghcr.io/girish-kor/apirift:latest
docker run -p 8080:8080 ghcr.io/girish-kor/apirift:latest
```

## 🔒 Security

### Sensitive Data in Logs

Logs contain **full request/response bodies**. By default, we redact:
- `Authorization` headers
- `Cookie` headers  
- `x-api-key` headers

### Recommended Practices

1. **Never commit `logs/` directory** - Add to `.gitignore`
2. **Mask sensitive request fields:**
   ```bash
   apirift capture --mask-fields "password,ssn,creditCard"
   ```
3. **Exclude endpoints:**
   ```bash
   apirift capture --filter-path "/api/public/"
   ```
4. **Rotate logs** - Daily cleanup recommended
5. **Use `.env.example`** - Document config without secrets

See [SECURITY.md](SECURITY.md) for detailed security guidelines.

## 📊 Examples

### API Version Migration
```bash
# Capture traffic from v1
apirift capture --port 3001 --target http://api.v1.local

# Replay against v2
apirift replay --target http://api.v2.local

# Check compatibility
apirift analyze
```

### Load Testing with Captured Traffic
```bash
apirift replay --concurrency 10 --delay 100
```

### Debugging Production Issues
```bash
# Capture from production proxy
apirift capture --target http://prod-api.local

# Run locally with fix
apirift replay --target http://localhost:3000

# Verify fix
apirift analyze
```

## 📝 Examples Directory

See [examples/](examples/) for more complex scenarios and configurations.

## 🧪 Testing

```bash
npm test          # Run all tests
npm run lint      # Check code style
npm run clean     # Clear logs/reports
npm run reset     # Full clean + recreate dirs
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for:
- How to set up development environment
- Code style guidelines
- Testing requirements
- Pull request process

## 📄 License

ISC License - see [LICENSE](LICENSE) for details.

## 💡 Use Cases

- ✅ Regression testing during API migrations
- ✅ Detecting unintended behavioral changes
- ✅ Validating load balancer switching
- ✅ A/B testing API versions
- ✅ Production monitoring
- ✅ Service mesh migration validation
- ✅ Microservice refactoring verification

## 🆘 Troubleshooting

**Drift detected unexpectedly?**
- Check for timestamp fields (use `--normalize-keys`)
- Verify both endpoints are healthy
- Check for real code differences

**Capture missing requests?**
- Verify proxy port is correct
- Check firewall rules
- Ensure target URL is reachable

**High latency differences?**
- Use `--latency` or `--latency-ratio` to set thresholds
- Check network conditions
- Verify target performance

See [GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md) for deployment instructions.

## 📞 Support

- 📖 Check [README.md](README.md) 
- 🐛 [Report bugs](https://github.com/girish-kor/apirift/issues)
- 💬 [Request features](https://github.com/girish-kor/apirift/issues)
- 💼 For commercial support, contact maintainers

---

Made with ❤️ by the apirift team
