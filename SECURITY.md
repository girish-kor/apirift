# Security Policy

## Reporting a Vulnerability

**Please do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report security vulnerabilities by emailing the maintainers directly or using GitHub's private vulnerability reporting feature:

1. Go to the repository
2. Click **Security** → **Report a vulnerability**
3. Fill out the form with details of the vulnerability

We will:
- Acknowledge receipt within 48 hours
- Work on a fix immediately
- Release a security patch and advisory
- Credit the security researcher (if desired)

## Supported Versions

| Version | Status          | Security Updates |
|---------|-----------------|------------------|
| 1.0.x   | Current         | Yes              |
| < 1.0   | End of Life     | No               |

## Security Best Practices

When using apirift:

### Logs Contain Sensitive Data
- Logs include full request/response bodies
- Never commit `logs/` directory to version control
- Use `--mask-fields` for sensitive request body redaction
- Default redaction: `Authorization`, `Cookie`, `x-api-key`
- Redact additional fields with: `--mask-fields "password,token,ssn"`

### Environment Variables
- Store API keys in `.env` files
- Never commit `.env` files
- Use `.env.example` for documentation
- Load from environment in CI/CD pipelines

### Docker Security
- Don't run container as root in production
- Use read-only filesystems where possible
- Scan images for vulnerabilities: `docker scan apirift`

### Proxy Security
- Only use proxy on trusted networks
- Verify TLS certificates in production
- Use `--filter-path` to exclude sensitive endpoints
- Monitor logs for unauthorized access

## Dependencies Security

We regularly audit dependencies:
- Run `npm audit` before each release
- Address HIGH and CRITICAL vulnerabilities immediately
- Address MODERATE vulnerabilities in next minor release
- Keep Node.js and npm up to date

## Disclosure Timeline

- **Day 0**: Vulnerability reported
- **Day 1-2**: Assessment and initial contact
- **Day 7**: Security patch released (or timeline negotiated)
- **Day 8**: Public advisory disclosed

We believe in responsible disclosure and coordinating with reporters.

## Questions?

For security-related questions (not vulnerabilities), contact the maintainers directly.
