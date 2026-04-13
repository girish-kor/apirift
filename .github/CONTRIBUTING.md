# Contributing to apirift

Thank you for your interest in contributing to apirift! We welcome issues, feature requests, and pull requests.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/girish-kor/apirift.git
   cd apirift
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development

- **Run tests**: `npm test`
- **Run linter**: `npm run lint`
- **Format code**: `npm run format` (if available)
- **Clean logs/reports**: `npm run clean`

## Making Changes

1. Make your changes in a descriptive branch
2. Write or update tests for your changes
3. Ensure all tests pass: `npm test`
4. Follow the existing code style and patterns
5. Keep commits atomic and descriptive

## Submitting Pull Requests

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** against the `main` branch with:
   - Clear title describing the change
   - Description of what and why you changed
   - Reference to related issues (e.g., "Fixes #123")
   - Tests for new functionality
   - Updated documentation if needed

3. **Address feedback** from code review

## Reporting Bugs

- Use the GitHub Issues tab
- Include steps to reproduce
- Share relevant logs or error messages
- Specify your Node.js version and OS

## Feature Requests

- Use the GitHub Issues tab
- Clearly describe the feature and use case
- Explain the expected behavior
- Provide examples if possible

## Code Style

- Follow ESLint configuration if present
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and testable

## Testing Requirements

- All new features must include tests
- All bug fixes should include regression tests
- Aim for >80% code coverage
- Tests must pass on Node 14.x and newer

## Security

- Never commit credentials, API keys, or sensitive data
- Use environment variables for configuration
- Report security vulnerabilities privately to the maintainers
- Do not open public issues for security vulnerabilities

## Questions?

Feel free to open an issue to ask questions or discuss ideas. We're here to help!

Thank you for contributing! 🎉
