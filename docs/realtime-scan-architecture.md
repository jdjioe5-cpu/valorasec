# Real-Time Security Scan Architecture Evaluation

## 1. Executive Summary

This document evaluates architectures for delivering real-time scan progress in ValoraSec, comparing HTTP Polling (current implementation), Server-Sent Events (SSE), and WebSockets. It establishes the rationale for the current React Query polling model and presents a detailed blueprint for transitioning to WebSockets as workload scale and scan durations expand.

---

## 2. Protocol Comparison

| Dimension                      | HTTP Polling (Current)                     | Server-Sent Events (SSE)             | WebSockets (Full Duplex)                        |
| :----------------------------- | :----------------------------------------- | :----------------------------------- | :---------------------------------------------- |
| **Communication Mode**         | Half-duplex (client pull)                  | Simplex (server-to-client push)      | Full-duplex (bidirectional)                     |
| **Connection Overhead**        | Minimal per request; stateless             | Single long-lived HTTP connection    | Single persistent TCP/TLS socket                |
| **Protocol Overhead**          | HTTP headers sent on each poll (2s)        | Minimal framing after handshake      | Minimal 2-byte frame overhead                   |
| **Statefulness on Server**     | Stateless (ideal for serverless / K8s)     | Sticky connection or Redis pub/sub   | State/Connection pool management required       |
| **Firewall / Proxy Traversal** | 100% transparent across all CDNs           | HTTP/1.1 chunked / HTTP/2 native     | Requires proxy support for `Upgrade: websocket` |
| **Reconnection & Resilience**  | Built-in via React Query `refetchInterval` | Native browser EventSource reconnect | Manual heartbeat ping/pong & reconnection logic |
| **Client Complexity**          | Low (`useQuery` with `refetchInterval`)    | Medium (EventSource handler)         | High (Socket.io or custom WS client state)      |
| **Soroban Scan Fit (< 5s)**    | **Optimal** (2-3 polls total per scan)     | Acceptable                           | Overhead of connection handshake > scan time    |

---

## 3. Current Implementation: React Query Interval Polling

### 3.1 Architectural Flow

1. Client triggers scan: `POST /api/projects/:projectId/contracts/:contractId/scan`.
2. Server dispatches analysis job and returns scan metadata with `id` and initial status (`running` / `completed`).
3. Client registers scan in persistent `useScanStore` (Zustand with localStorage fallback) for seamless multi-page resumption.
4. Hook `useScanProgress` activates React Query `useQuery`:
   - Polling interval: `2000ms` (2 seconds) via `refetchInterval: (query) => terminal ? false : 2000`.
   - `refetchIntervalInBackground: true` ensures background tracking across browser tabs.
5. UI displays:
   - Progress bar with asymptotic interpolation ($0\% \rightarrow 92\%$ while in-flight, $100\%$ on completion).
   - Step indicator: `Analyzing` $\rightarrow$ `Processing` $\rightarrow$ `Complete`.
   - Dynamic estimated remaining time calculation based on `expectedDurationMs` and elapsed time.
6. Upon terminal status (`completed` or `failed`), polling ceases automatically, active store is pruned, and summary findings appear without manual reload.

### 3.2 Scalability Profile

- Average Soroban contract scan duration: **1.2s to 4.5s**.
- Total requests per scan: **1 to 3 requests**.
- Total bandwidth consumption per scan: **< 4 KB**.
- Zero state held in API memory; horizonal autoscaling of API pods requires no shared session state or socket sync.

---

## 4. WebSocket Architecture Blueprint (Future Expansion)

When ValoraSec introduces multi-contract batch audits, formal verification proofs, or LLM-driven deep reasoning that run for tens of seconds or minutes, WebSockets become advantageous.

### 4.1 Topology Diagram

```
[ Next.js Web App ] <── WSS (ws://api/ws/scans) ──> [ NestJS WebSocket Gateway ]
                                                              │
                                                      Redis Pub/Sub (scans:progress)
                                                              │
                                                  [ Distributed Analyzer Workers ]
```

### 4.2 Proposed Event Schema

#### 1. Subscribe to Scan Progress

```json
// Client -> Gateway
{
  "event": "scan:subscribe",
  "data": {
    "scanId": "scan-soroban-781",
    "token": "eyJhbGciOiJIUzI1..."
  }
}
```

#### 2. Progress Tick (Analyzing)

```json
// Gateway -> Client
{
  "event": "scan:progress",
  "data": {
    "scanId": "scan-soroban-781",
    "step": "analyzing",
    "percent": 35,
    "currentRule": "VAL-004-REENTRANCY",
    "rulesCompleted": 6,
    "totalRules": 18,
    "estimatedRemainingMs": 2600
  }
}
```

#### 3. Scan Finished

```json
// Gateway -> Client
{
  "event": "scan:completed",
  "data": {
    "scanId": "scan-soroban-781",
    "status": "completed",
    "summary": {
      "totalFindings": 3,
      "score": 85,
      "bySeverity": { "critical": 0, "high": 1, "medium": 1, "low": 1, "info": 0 }
    },
    "duration": 3410
  }
}
```

### 4.3 Fallback & Resilience Strategy

1. **Transport Negotiation**: Socket.io or SockJS with automatic fallback to HTTP Long-Polling if WebSocket handshake is blocked by corporate proxies or CDN WAFs.
2. **Heartbeat Protocol**: Client sends `ping` every 25s; server responds with `pong`. Reconnection triggers exponential backoff (1s, 2s, 4s, 8s, max 15s).
3. **Hybrid Re-hydration**: If socket drops during scan, client executes a single `GET /api/scans/:id` to reconcile state before re-establishing socket subscription.

---

## 5. Conclusion & Decision Record

- **Current State**: React Query polling every 2 seconds fulfills 100% of functional requirements with zero operational complexity, instant horizontal elasticity, and automatic retry resilience.
- **Trigger for WS Transition**: Transition will be scheduled when scan duration p95 exceeds 15 seconds or when real-time line-by-line streaming AST findings are requested.
