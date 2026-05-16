# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main) | ✅ |
| Older releases | ❌ |

## Reporting a Vulnerability

**Please do not file a public GitHub issue for security vulnerabilities.**

### Contact

- **Email**: security@aiscern.com
- **PGP**: *(key available on request)*
- **Encrypted reports**: Preferred for critical vulnerabilities

### Scope

In-scope:
- Authentication and authorization bypasses
- SQL injection / RLS policy bypasses (Supabase)
- Remote code execution
- File upload vulnerabilities (MIME bypass, polyglot files)
- CSRF vulnerabilities
- Exposed secrets or credentials in the repository
- Data leakage between users (cross-account data access)
- Rate limiting bypasses that enable abuse

Out-of-scope:
- Denial of service via resource exhaustion without documented proof of impact
- Social engineering
- Physical attacks
- Vulnerabilities in third-party services (Clerk, Supabase, Cloudflare) — report directly to them

### Response SLA

| Severity | Acknowledgment | Initial Assessment | Fix Target |
|----------|---------------|-------------------|------------|
| Critical | 24 hours | 48 hours | 7 days |
| High | 48 hours | 5 days | 30 days |
| Medium | 5 days | 14 days | 90 days |
| Low | 14 days | 30 days | Next release |

### Safe Harbor

We treat vulnerability research conducted in good faith as follows:
- We will not pursue legal action for research within scope
- We will not restrict your access to the platform for reporting
- We will acknowledge your contribution in our [Hall of Fame](https://aiscern.com/security/hall-of-fame) (with your permission)

### Process

1. Email security@aiscern.com with: severity, affected component, reproduction steps, potential impact
2. We acknowledge receipt within the SLA above
3. We investigate and provide a fix timeline
4. We notify you when the fix is deployed
5. Coordinated disclosure after fix (90-day embargo unless agreed otherwise)

### Hall of Fame

Responsible reporters are recognized at [aiscern.com/security/hall-of-fame](https://aiscern.com/security/hall-of-fame).

---

## Security Practices

- All traffic served over HTTPS/TLS 1.3 with HSTS
- Content-Security-Policy headers on all routes
- Row-level security (RLS) on all Supabase tables
- File uploads: MIME allowlist + magic byte validation, UUID-renamed, stored in private R2
- Rate limiting: Upstash Redis distributed (not in-memory)
- Secrets: never committed, all via environment variables
- Dependencies: audited weekly via `npm audit` in CI
