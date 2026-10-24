import { useState } from 'react';
import { useAuth, useProjects, useProject, useReports, useRunScan } from './index';

export function SdkHooksDemo() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-demo-1');
  const [selectedContractId, setSelectedContractId] = useState<string>('contract-demo-1');

  // 1. Auth Hook
  const { user, isAuthenticated, login, logout, isLoading: isAuthLoading } = useAuth();

  // 2. Projects Hook (with pagination)
  const [page, setPage] = useState(1);
  const {
    data: projectsData,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
  } = useProjects({ page, limit: 10 });

  // 3. Single Project Hook
  const { project, isLoading: isProjectLoading } = useProject(selectedProjectId);

  // 4. Reports Hook
  const { data: reportsData, isLoading: isReportsLoading } = useReports({
    projectId: selectedProjectId,
    page: 1,
    limit: 5,
  });

  // 5. Run Scan Hook with progress polling
  const {
    runScan,
    scanResult,
    isLoading: isScanning,
    isPolling,
  } = useRunScan(selectedProjectId, selectedContractId, {
    pollingInterval: 1000,
    onScanComplete: (res) => {
      console.info('Scan finished with score:', res.summary.score);
    },
  });

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>ValoraSec React SDK Hooks Demo</h1>

      {/* Auth Section */}
      <section
        style={{
          border: '1px solid #ccc',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <h2>1. Authentication (useAuth)</h2>
        {isAuthLoading ? (
          <p>Loading auth state...</p>
        ) : isAuthenticated && user ? (
          <div>
            <p>
              Signed in as: <strong>{user.email}</strong> ({user.name})
            </p>
            <button onClick={() => logout()}>Log out</button>
          </div>
        ) : (
          <div>
            <p>Not signed in</p>
            <button
              onClick={() => login({ email: 'auditor@stellar.org', password: 'Password123!' })}
            >
              Log in Demo User
            </button>
          </div>
        )}
      </section>

      {/* Projects Section */}
      <section
        style={{
          border: '1px solid #ccc',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <h2>2. Projects List (useProjects)</h2>
        {isProjectsLoading && <p>Loading projects...</p>}
        {isProjectsError && <p style={{ color: 'red' }}>Error loading projects.</p>}
        {projectsData && (
          <div>
            <p>
              Total projects: {projectsData.meta.total} (Page {projectsData.meta.page} of{' '}
              {projectsData.meta.totalPages})
            </p>
            <ul>
              {projectsData.data.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSelectedProjectId(p.id)}>
                    {p.name} [{p.network}]
                  </button>
                </li>
              ))}
            </ul>
            <div>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button
                disabled={page >= projectsData.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Single Project Section */}
      <section
        style={{
          border: '1px solid #ccc',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <h2>3. Selected Project Details (useProject)</h2>
        {isProjectLoading && <p>Loading project details...</p>}
        {project ? (
          <div>
            <p>
              <strong>Name:</strong> {project.name}
            </p>
            <p>
              <strong>Description:</strong> {project.description ?? 'None'}
            </p>
            <p>
              <strong>Network:</strong> {project.network}
            </p>
            <p>
              <strong>Contracts:</strong> {project.contracts?.length ?? 0}
            </p>
          </div>
        ) : (
          <p>No project selected or not found.</p>
        )}
      </section>

      {/* Reports Section */}
      <section
        style={{
          border: '1px solid #ccc',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <h2>4. Security Reports (useReports)</h2>
        {isReportsLoading && <p>Loading reports...</p>}
        {reportsData && (
          <ul>
            {reportsData.data.map((r) => (
              <li key={r.id}>
                Report {r.id.slice(0, 8)} — Score: {r.summary.score}/100 — Status: {r.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Scan Section */}
      <section
        style={{
          border: '1px solid #ccc',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <h2>5. Trigger Scan & Poll Progress (useRunScan)</h2>
        <div style={{ marginBottom: '8px' }}>
          <label htmlFor="contract-id-input">Contract ID: </label>
          <input
            id="contract-id-input"
            value={selectedContractId}
            onChange={(e) => setSelectedContractId(e.target.value)}
            style={{ marginLeft: '8px', padding: '4px' }}
          />
        </div>
        <button
          disabled={isScanning || isPolling}
          onClick={() => runScan({ projectId: selectedProjectId, contractId: selectedContractId })}
        >
          {isPolling
            ? 'Polling Scan Progress...'
            : isScanning
              ? 'Initiating Scan...'
              : 'Run Security Scan'}
        </button>

        {scanResult && (
          <div
            style={{
              marginTop: '12px',
              background: '#f5f5f5',
              padding: '8px',
              borderRadius: '4px',
            }}
          >
            <p>
              <strong>Scan Status:</strong> {scanResult.status}
            </p>
            <p>
              <strong>Findings:</strong> {scanResult.findings.length}
            </p>
            <p>
              <strong>Security Score:</strong> {scanResult.summary.score}/100
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
