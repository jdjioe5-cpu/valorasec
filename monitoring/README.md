# ValoraSec Observability & Monitoring Stack

This directory contains the production observability infrastructure for ValoraSec (Issue #59), providing Prometheus metrics scraping, alert rules, and a pre-configured Grafana health dashboard.

## Architecture

- **Prometheus**: Scrapes `/api/metrics` from the API server every 15s.
- **Alert Rules**: Evaluates high error rates (>5%), database connection failures, and scan queue backlog.
- **Grafana**: Pre-provisioned with Prometheus datasource and the ValoraSec Core Dashboard.

## Quick Start

1. Start the API server on port 4000:

   ```bash
   pnpm dev
   ```

2. Start Prometheus and Grafana:

   ```bash
   docker compose -f docker-compose.monitoring.yml up -d
   ```

3. Access the Dashboards:
   - **Prometheus**: [http://localhost:9090](http://localhost:9090)
   - **Grafana**: [http://localhost:3001](http://localhost:3001) (User: `admin`, Password: `admin`)
   - **API Metrics**: [http://localhost:4000/api/metrics](http://localhost:4000/api/metrics)
   - **Health Endpoint**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## Core Metrics

- `http_requests_total{method, route, status_code}`: Request counter.
- `http_request_duration_seconds{method, route, status_code, le}`: Request duration histogram (p50, p95, p99).
- `active_users`: Gauge of registered active users.
- `scan_queue_depth`: Gauge of pending security scans.
- `db_connection_pool_active` / `db_connection_pool_idle`: Connection pool health gauges.
