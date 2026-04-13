# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-04-13

### Added
- Initial release
- **capture** command: Transparently proxies HTTP traffic to a log file
- **replay** command: Replays captured traffic against target endpoint
- **analyze** command: Detects API drift between baseline and replayed responses
- Support for masking sensitive fields (passwords, tokens)
- Request filtering by path patterns
- Response body size limits
- Latency analysis with configurable thresholds
- Dry-run mode for replay operations
- Configurable concurrency and delays
- Status code filtering for analysis
- Cross-platform compatibility (Windows, macOS, Linux)
- Docker support with provided Dockerfile
- Comprehensive CLI with Commander.js
- Structured logging with Pino
- JSON Lines (.jsonl) format for traffic logs

### Fixed
- Resource cleanup in file store readline operations
- Signal handler cleanup during graceful shutdown
- Cross-platform script compatibility
- Windows PowerShell environment variable handling

### Features
- Exits with code 1 on drift detection (CI/CD ready)
- Deterministic replay for reliable testing
- Normalized response comparison
- Support for custom headers and authentication headers
