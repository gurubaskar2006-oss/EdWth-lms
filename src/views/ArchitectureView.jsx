import React, { useState } from 'react';
import { DB_SCHEMA_PRISMA, API_ENDPOINTS } from '../data/mockData';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  Database,
  Server,
  Code2,
  Copy,
  Check,
  Send,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  List,
  Cloud,
  Cpu,
  HardDrive,
  Activity,
  Radio,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { apiService } from '../services/apiService';

const TOPOLOGY_NODES = [
  {
    id: 'edge',
    title: 'Hetzner Load Balancer',
    layer: 'Edge / Ingress & TLS',
    icon: Globe,
    color: '#06b6d4',
    status: 'Operational',
    metrics: 'TLS 1.3 • Anycast Routing • HTTP/2 & WebSocket',
    description: 'Hardware-level edge load balancer providing SSL termination, DDoS mitigation, and sticky connection bypass. Passes traffic evenly across healthy API instances.',
    productionNote: 'Production utilizes the managed Hetzner Load Balancer. Local Docker Compose testing utilizes an Nginx reverse proxy simulation.',
    details: [
      { label: 'Protocols', val: 'HTTPS (Port 443) -> HTTP (Port 5000), WSS' },
      { label: 'Health Probes', val: 'GET /api/v1/health every 5s (2 successes = healthy)' },
      { label: 'SSL/TLS', val: 'Automated Let’s Encrypt / Wildcard TLS 1.3 with HSTS' },
      { label: 'Session Strategy', val: 'Stateless round-robin (Redis handles cross-node state)' }
    ]
  },
  {
    id: 'api',
    title: 'Lumina API Cluster (Stateless)',
    layer: 'Compute / Application',
    icon: Server,
    color: '#10b981',
    status: 'Operational',
    metrics: 'Node.js 20 Alpine • Non-Root • Horizontal Auto-Scaling',
    description: 'Multi-node stateless Express cluster executing business logic, JWT/2FA verification, tenant data segregation, and Socket.io real-time gateways.',
    productionNote: 'Stateless nodes allow instant zero-downtime rolling deploys and horizontal scaling behind the Hetzner Load Balancer.',
    details: [
      { label: 'Runtime', val: 'Node.js v20-alpine (dumb-init, unprivileged node user)' },
      { label: 'Multi-Tenancy', val: 'Context-scoped req.tenantId with strict college isolation' },
      { label: 'Concurrency', val: 'Multi-instance cluster scaling to 500+ active sessions' },
      { label: 'Security', val: 'Helmet CSP, express-rate-limit, sanitize-html' }
    ]
  },
  {
    id: 'redis',
    title: 'Redis 7 Pub/Sub & Adapter',
    layer: 'Coordination & Cache',
    icon: Radio,
    color: '#ef4444',
    status: 'Operational',
    metrics: 'ioredis • @socket.io/redis-adapter • Token Revocation',
    description: 'Distributed in-memory coordination broker enabling Socket.io cross-instance broadcasting, tenant room distribution, and rate-limiting counters.',
    productionNote: 'Socket.io uses Redis Pub/Sub adapter to sync events across instances without relying on fragile IP-hash sticky sessions.',
    details: [
      { label: 'Adapter', val: '@socket.io/redis-adapter (dual pub/sub client)' },
      { label: 'Rooms', val: 'tenant:{tenantId}, role:{role}, batch:{batchId}' },
      { label: 'Failover', val: 'Auto-reconnection retry strategy with backoff' },
      { label: 'Cache TTL', val: 'Session blacklist (15m), Attendance tallies (real-time)' }
    ]
  },
  {
    id: 'mongo',
    title: 'MongoDB Atlas Replica Set',
    layer: 'Primary Persistence',
    icon: Database,
    color: '#10b981',
    status: 'Operational',
    metrics: 'Mongoose • Multi-Region Replica Set • Compound Indexes',
    description: 'Tenant-partitioned primary document store maintaining student rosters, grade books, audit trails, and course syllabi with strict indexing.',
    productionNote: 'Compound indexes { tenantId: 1, id: 1 } ensure multi-tenant safety and eliminate cross-institution collisions.',
    details: [
      { label: 'Isolation', val: 'Compound compound indexing on { tenantId, ... }' },
      { label: 'Audit Trail', val: 'Immutable tamper-evident system audit log schema' },
      { label: 'Backup', val: 'Continuous automated point-in-time recovery (PITR)' },
      { label: 'Connection Pool', val: 'maxPoolSize: 50 with keepAlive 300s' }
    ]
  },
  {
    id: 'piston',
    title: 'Isolated Piston Worker Pool',
    layer: 'Code Lab Sandbox',
    icon: Cpu,
    color: '#8b5cf6',
    status: 'Operational',
    metrics: 'Bounded Queue (max 5 active, 300 waiting) • 128MB RAM • 10s CPU',
    description: 'Multi-worker isolated container pool for compiling and executing untrusted student code. Zero child_process execution on the host server.',
    productionNote: 'FAIL-CLOSED ENFORCEMENT: In production, execution strictly halts with HTTP 503 if Piston is unreachable. Local host fallback is permanently disabled in production.',
    details: [
      { label: 'Isolation', val: 'Docker-in-Docker isolated cgroups / Piston runner' },
      { label: 'Constraints', val: '128MB RAM, 10s CPU timeout, 100KB stdout ceiling' },
      { label: 'Queue Engine', val: 'In-memory bounded concurrency worker (max 5 concurrent)' },
      { label: 'Fail-Closed', val: 'NODE_ENV=production never falls back to host execution' }
    ]
  },
  {
    id: 'b2',
    title: 'Backblaze B2 Object Storage',
    layer: 'Media & File Storage',
    icon: HardDrive,
    color: '#f59e0b',
    status: 'Operational',
    metrics: 'S3-Compatible • Pre-signed URLs • MIME Magic Byte Validation',
    description: 'Enterprise object storage for student note attachments, exported CSV verification rosters, and course media. Dedicated object store, not a CDN replacement.',
    productionNote: 'Backblaze B2 is strictly used as S3-compatible Object Storage for media assets. Hetzner handles Edge/LB, while application handles compute.',
    details: [
      { label: 'Protocol', val: 'S3 API SDK (@aws-sdk/client-s3)' },
      { label: 'Security', val: 'Short-lived presigned URLs (60m expiry) + magic bytes check' },
      { label: 'MIME Verification', val: 'fileTypeFromBuffer binary signature inspection' },
      { label: 'Max File Size', val: '25 MB per attachment with tenant key path partitioning' }
    ]
  }
];

export const ArchitectureView = () => {
  usePageTitle('Architecture');
  const { portalConfig, addToast } = useLMS();
  const [activeTab, setActiveTab] = useState('topology'); // 'topology' | 'api' | 'audit' | 'prisma'
  const [selectedNode, setSelectedNode] = useState(TOPOLOGY_NODES[0]);
  const [copied, setCopied] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState(API_ENDPOINTS[0]);
  const [testOutput, setTestOutput] = useState(null);
  const [isCallingApi, setIsCallingApi] = useState(false);
  
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');

  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    setAuditError('');
    const res = await apiService.getAuditLogs();
    if (res && res.success) {
      setAuditLogs(res.logs);
    } else {
      setAuditError('Failed to fetch audit logs or unauthorized.');
    }
    setIsLoadingAudit(false);
  };

  React.useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handleCopySchema = () => {
    navigator.clipboard.writeText(DB_SCHEMA_PRISMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast("Copied to Clipboard", "Prisma schema copied successfully.", "emerald");
  };

  const handleTestApi = (ep) => {
    setSelectedEndpoint(ep);
    setIsCallingApi(true);
    setTestOutput(null);

    setTimeout(() => {
      setTestOutput(ep.sampleResponse);
      setIsCallingApi(false);
      addToast("200 OK Response", `${ep.method} ${ep.path} executed successfully.`, "emerald");
    }, 350);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-emerald" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>
              6th Civilians Corporation
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Production Infrastructure Blueprint • Lumina LMS V3
            </span>
          </div>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Enterprise Architecture & Infrastructure
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
            Production topology spanning Hetzner Load Balancer, stateless API cluster, Redis coordination, MongoDB Atlas, and isolated Piston code runners.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '3px'
          }}
        >
          {[
            { id: 'topology', label: 'System Topology' },
            { id: 'api', label: 'REST API Explorer' },
            { id: 'audit', label: 'Audit Logs' },
            { id: 'prisma', label: 'Prisma Schema' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                fontWeight: activeTab === tab.id ? 700 : 500,
                backgroundColor: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SYSTEM TOPOLOGY TAB */}
      {activeTab === 'topology' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Architecture Guardrails Alert */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.85rem'
            }}
          >
            <ShieldCheck size={20} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.84rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Enterprise Production Guardrails:</strong>{' '}
              Edge traffic terminated via <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Hetzner Load Balancer</span>. Socket.io horizontally scaled via <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Redis Pub/Sub</span> (no sticky session dependency). Code Lab execution strictly routed through bounded queue to <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>isolated Piston containers</span> with production fail-closed security. Media assets persisted to <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Backblaze B2 Object Storage</span>.
            </div>
          </div>

          {/* Topology Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {TOPOLOGY_NODES.map((node) => {
              const isSelected = selectedNode.id === node.id;
              const IconComp = node.icon;

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--bg-surface)',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                    boxShadow: isSelected ? '0 4px 14px rgba(5, 150, 105, 0.12)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: `${node.color}15`,
                          color: node.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${node.color}30`
                        }}
                      >
                        <IconComp size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                          {node.layer}
                        </div>
                        <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {node.title}
                        </h4>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }} />
                      {node.status}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                    {node.description}
                  </p>

                  <div style={{
                    marginTop: 'auto',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-default)',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {node.metrics}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deep Node Inspector */}
          {selectedNode && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-sm)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      backgroundColor: `${selectedNode.color}15`,
                      color: selectedNode.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${selectedNode.color}30`
                    }}
                  >
                    {React.createElement(selectedNode.icon, { size: 20 })}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {selectedNode.title} Specifications
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Layer: {selectedNode.layer} • Status: Active Production Blueprint
                    </span>
                  </div>
                </div>

                <span style={{ padding: '0.25rem 0.65rem', borderRadius: '4px', backgroundColor: '#ECFDF5', color: 'var(--accent-primary)', fontSize: '0.76rem', fontWeight: 700 }}>
                  High-Availability Standard
                </span>
              </div>

              {/* Production Note */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderLeft: `3px solid ${selectedNode.color}`,
                  borderTop: '1px solid var(--border-default)',
                  borderRight: '1px solid var(--border-default)',
                  borderBottom: '1px solid var(--border-default)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>Architecture Standard: </strong>
                {selectedNode.productionNote}
              </div>

              {/* Technical Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                {selectedNode.details.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, marginBottom: '0.25rem' }}>
                      {d.label}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {d.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRISMA SCHEMA TAB */}
      {activeTab === 'prisma' && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '0.85rem 1.5rem',
              backgroundColor: 'var(--bg-surface-subtle)',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                prisma/schema.prisma
              </span>
            </div>

            <button onClick={handleCopySchema} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
              {copied ? <Check size={13} color="var(--accent-primary)" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy Schema'}</span>
            </button>
          </div>

          <pre
            style={{
              padding: '1.5rem',
              backgroundColor: '#0F172A',
              color: '#93C5FD',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.86rem',
              lineHeight: '1.6',
              overflowX: 'auto',
              maxHeight: '600px',
              margin: 0
            }}
          >
            {DB_SCHEMA_PRISMA}
          </pre>
        </div>
      )}

      {/* REST API EXPLORER TAB */}
      {activeTab === 'api' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Endpoints List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>RESTful API Endpoints</h4>
            {API_ENDPOINTS.map((ep, idx) => {
              const isSelected = selectedEndpoint.path === ep.path;

              return (
                <div
                  key={idx}
                  onClick={() => handleTestApi(ep)}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: isSelected ? '#EFF6FF' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--accent-learning)' : 'var(--border-default)'}`,
                    boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.1)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: ep.method === 'GET' ? 'rgba(5, 150, 105, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                        color: ep.method === 'GET' ? 'var(--accent-primary)' : 'var(--accent-learning)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {ep.method}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {ep.path}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: '0 0 0.4rem 0' }}>
                    {ep.description}
                  </p>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} color="var(--accent-primary)" />
                    <span>Auth: {ep.auth}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Test Sandbox Output */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '0.85rem 1.25rem',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Server size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Live Endpoint Tester
                </span>
              </div>

              <button
                onClick={() => handleTestApi(selectedEndpoint)}
                className="btn-primary"
                disabled={isCallingApi}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
              >
                <Send size={12} />
                <span>{isCallingApi ? 'Executing...' : 'Test Request'}</span>
              </button>
            </div>

            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-default)', fontSize: '0.78rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>Request:</strong> {selectedEndpoint.method} {selectedEndpoint.path}</div>
              <div style={{ marginTop: '0.2rem' }}><strong style={{ color: 'var(--text-primary)' }}>Status:</strong> <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>200 OK (24ms)</span></div>
            </div>

            <pre
              style={{
                flex: 1,
                padding: '1.25rem',
                backgroundColor: '#0F172A',
                color: '#93C5FD',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                lineHeight: '1.5',
                overflowY: 'auto',
                margin: 0
              }}
            >
              {JSON.stringify(testOutput || selectedEndpoint.sampleResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit' && (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '0.85rem 1.5rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <List size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                System Audit Logs
              </span>
            </div>
            <button onClick={fetchAuditLogs} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
              Refresh
            </button>
          </div>

          <div style={{ padding: '1.5rem', overflowX: 'auto' }}>
            {isLoadingAudit ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading logs...</p>
            ) : auditError ? (
              <p style={{ color: 'var(--accent-urgent)' }}>{auditError}</p>
            ) : auditLogs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No audit logs found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Timestamp</th>
                    <th style={{ padding: '0.75rem' }}>Actor</th>
                    <th style={{ padding: '0.75rem' }}>Action</th>
                    <th style={{ padding: '0.75rem' }}>Resource</th>
                    <th style={{ padding: '0.75rem' }}>Details</th>
                    <th style={{ padding: '0.75rem' }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log._id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{log.actorEmail}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>
                        <span style={{ 
                          padding: '0.15rem 0.45rem', 
                          borderRadius: '4px', 
                          backgroundColor: 'var(--bg-surface-subtle)',
                          border: '1px solid var(--border-default)',
                          fontFamily: 'var(--font-mono)' 
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                        {log.resourceType} {log.resourceId && `(${log.resourceId})`}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.details ? JSON.stringify(log.details) : '-'}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{log.ipAddress || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
