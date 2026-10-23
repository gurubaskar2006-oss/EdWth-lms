import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  UploadCloud,
  FileCheck2,
  FileText,
  CheckCircle2,
  X,
  AlertCircle,
  Clock,
  Award,
  FileCode,
  GitBranch,
  ExternalLink,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Info,
  Terminal,
  Check,
  Layers,
  Calendar,
  Sparkles,
  Cpu,
  ChevronRight
} from 'lucide-react';

export const AssignmentSubmitModal = ({ assignment, onClose }) => {
  const { submitAssignment, user } = useLMS();

  // Active Tab: 'submit' | 'rubric' | 'history'
  const isAlreadySubmitted = assignment?.status === 'submitted' || assignment?.status === 'graded';
  const [activeTab, setActiveTab] = useState(isAlreadySubmitted ? 'history' : 'submit');

  // Submission Method: 'file' | 'git' | 'code'
  const [submissionMethod, setSubmissionMethod] = useState('file');

  // File Upload State
  const [file, setFile] = useState(
    assignment?.submissionFile
      ? { name: assignment.submissionFile, size: 245760, type: 'application/x-python' }
      : null
  );
  const [isDragging, setIsDragging] = useState(false);

  // Git Repository State
  const [gitRepoUrl, setGitRepoUrl] = useState('https://github.com/alex-vance/deep-learning-gpt2');
  const [gitBranch, setGitBranch] = useState('main');

  // Direct Code State
  const [directCode, setDirectCode] = useState(
    `# Solution for ${assignment?.title || 'Assignment'}\nimport torch\nimport torch.nn as nn\n\nclass CausalSelfAttention(nn.Module):\n    def __init__(self, d_model, n_heads):\n        super().__init__()\n        self.d_model = d_model\n        self.n_heads = n_heads\n        # Implementation here...\n`
  );

  // Configuration State
  const [runtimeEnv, setRuntimeEnv] = useState('py311_pytorch');
  const [studentComment, setStudentComment] = useState('');
  const [honorPledge, setHonorPledge] = useState(true);

  // Submitting Animation Flow
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0); // 0: idle, 1: hashing/packaging, 2: linting/autotests, 3: completed
  const [submissionReceipt, setSubmissionReceipt] = useState(null);

  if (!assignment) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setFile(null);
  };

  const handleLoadSampleFile = (e) => {
    e.stopPropagation();
    const sample = new File(
      ["# Deep Learning Assignment Solution\nimport torch\n# Causal attention logic"],
      `${assignment.courseCode.toLowerCase().replace(/\s+/g, '_')}_solution_v1.py`,
      { type: 'text/x-python' }
    );
    // Custom mock size
    Object.defineProperty(sample, 'size', { value: 348200 });
    setFile(sample);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!honorPledge) return;

    setIsSubmitting(true);
    setSubmitStep(1);

    setTimeout(() => {
      setSubmitStep(2);
    }, 600);

    setTimeout(() => {
      setSubmitStep(3);
      const receiptId = `SUB-${assignment.courseCode.replace(/\s+/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const fileName =
        submissionMethod === 'file'
          ? (file ? file.name : `${assignment.courseCode.toLowerCase()}_solution.py`)
          : submissionMethod === 'git'
          ? `git@github.com:${gitBranch}`
          : 'inline_editor_snippet.py';

      submitAssignment(assignment.id, {
        fileName,
        comment: studentComment,
        method: submissionMethod,
        receiptId
      });

      setSubmissionReceipt({
        id: receiptId,
        fileName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });

      setIsSubmitting(false);
    }, 1400);
  };

  const getFileExtensionBadge = (filename) => {
    if (!filename) return { label: 'FILE', color: '#94a89e', bg: 'rgba(255, 255, 255, 0.1)' };
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'py') return { label: 'PYTHON', color: 'var(--accent-primary)', bg: '#ECFDF5' };
    if (ext === 'ipynb') return { label: 'JUPYTER', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    if (ext === 'zip' || ext === 'tar' || ext === 'gz') return { label: 'ZIP ARCHIVE', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    if (ext === 'pdf') return { label: 'PDF DOC', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' };
    return { label: ext.toUpperCase(), color: '#94a89e', bg: 'rgba(255, 255, 255, 0.1)' };
  };

  const isGraded = assignment.status === 'graded';
  const isSubmitted = assignment.status === 'submitted';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '680px',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          maxHeight: '92vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <span className="badge badge-emerald">{assignment.courseCode}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {assignment.courseTitle || 'Advanced Coursework'}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                  }}
                >
                  {assignment.weight}
                </span>
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 800, lineHeight: '1.3' }}>
                {assignment.title}
              </h3>
            </div>

            <button
              onClick={onClose}
              className="btn-icon"
              style={{ width: '32px', height: '32px', flexShrink: 0 }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Metadata Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              fontSize: '0.78rem'
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Points Possible</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                {assignment.points} Points
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Due Date</span>
              <span
                style={{
                  fontWeight: 700,
                  color: assignment.priority === 'urgent' && !isGraded ? 'var(--accent-urgent)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Clock size={13} /> {assignment.dueRelative}
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Current Status</span>
              <span
                style={{
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: isGraded ? 'var(--accent-primary)' : isSubmitted ? '#059669' : '#d97706'
                }}
              >
                {isGraded ? (
                  <>
                    <CheckCircle2 size={13} /> Graded ({assignment.score}%)
                  </>
                ) : isSubmitted ? (
                  <>
                    <CheckCircle2 size={13} /> Submitted
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} /> Ready to Submit
                  </>
                )}
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Autograder</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={13} color="var(--accent-primary)" /> Automated v2.4
              </span>
            </div>
          </div>
        </div>

        {/* RECEIPT SUCCESS VIEW (IF JUST SUBMITTED) */}
        {submissionReceipt ? (
          <div
            style={{
              padding: '1.75rem',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#D1FAE5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)'
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h4 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Assignment Submitted Successfully!
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Your solution has been queued for automated grading and instructor evaluation.
              </p>
            </div>

            {/* Receipt Details Card */}
            <div
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.82rem',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Official Receipt ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {submissionReceipt.id}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Uploaded Archive:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{submissionReceipt.fileName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {submissionReceipt.date} at {submissionReceipt.time}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student ID:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{user?.email || 'alex.vance@mit.edu'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => {
                  setSubmissionReceipt(null);
                  setActiveTab('history');
                }}
                className="btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                View in History
              </button>
              <button onClick={onClose} className="btn-primary" style={{ fontSize: '0.85rem' }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* NAVIGATION TABS */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '3px',
                border: '1px solid var(--border-default)'
              }}
            >
              <button
                onClick={() => setActiveTab('submit')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.84rem',
                  fontWeight: activeTab === 'submit' ? 700 : 500,
                  backgroundColor: activeTab === 'submit' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'submit' ? 'var(--text-on-primary)' : 'var(--text-secondary)'
                }}
              >
                <UploadCloud size={15} />
                <span>{isAlreadySubmitted ? 'Resubmit Solution' : 'Submit Solution'}</span>
              </button>

              <button
                onClick={() => setActiveTab('rubric')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.84rem',
                  fontWeight: activeTab === 'rubric' ? 700 : 500,
                  backgroundColor: activeTab === 'rubric' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'rubric' ? 'var(--text-on-primary)' : 'var(--text-secondary)'
                }}
              >
                <Layers size={15} />
                <span>Rubric & Criteria</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.84rem',
                  fontWeight: activeTab === 'history' ? 700 : 500,
                  backgroundColor: activeTab === 'history' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'history' ? 'var(--text-on-primary)' : 'var(--text-secondary)'
                }}
              >
                <FileCheck2 size={15} />
                <span>Status & Feedback {isGraded && `(${assignment.score}%)`}</span>
              </button>
            </div>

            {/* TAB 1: SUBMIT SOLUTION */}
            {activeTab === 'submit' && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Method selector pills */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                    1. Choose Submission Method
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setSubmissionMethod('file')}
                      style={{
                        flex: 1,
                        minWidth: '130px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        backgroundColor: submissionMethod === 'file' ? '#ECFDF5' : 'var(--bg-surface)',
                        color: submissionMethod === 'file' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        border: `1px solid ${submissionMethod === 'file' ? 'var(--accent-primary)' : 'var(--border-default)'}`
                      }}
                    >
                      <UploadCloud size={15} /> File Upload (.py, .zip, .pdf)
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubmissionMethod('git')}
                      style={{
                        flex: 1,
                        minWidth: '130px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        backgroundColor: submissionMethod === 'git' ? '#EFF6FF' : 'var(--bg-surface)',
                        color: submissionMethod === 'git' ? 'var(--accent-learning)' : 'var(--text-secondary)',
                        border: `1px solid ${submissionMethod === 'git' ? 'var(--accent-learning)' : 'var(--border-default)'}`
                      }}
                    >
                      <GitBranch size={15} /> Git Repository (GitHub/GitLab)
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubmissionMethod('code')}
                      style={{
                        flex: 1,
                        minWidth: '130px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        backgroundColor: submissionMethod === 'code' ? '#F5F3FF' : 'var(--bg-surface)',
                        color: submissionMethod === 'code' ? 'var(--accent-academic)' : 'var(--text-secondary)',
                        border: `1px solid ${submissionMethod === 'code' ? 'var(--accent-academic)' : 'var(--border-default)'}`
                      }}
                    >
                      <FileCode size={15} /> Direct Code Editor
                    </button>
                  </div>
                </div>

                {/* SUBMISSION METHOD: FILE UPLOAD */}
                {submissionMethod === 'file' && (
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                      <span>2. Upload Solution Archive or Script</span>
                      {!file && (
                        <button
                          type="button"
                          onClick={handleLoadSampleFile}
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--accent-primary)',
                            background: 'none',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                          }}
                        >
                          ⚡ Load starter solution for demo
                        </button>
                      )}
                    </label>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{
                        border: isDragging ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        padding: file ? '1.25rem' : '1.75rem 1rem',
                        textAlign: 'center',
                        backgroundColor: isDragging ? '#EFF6FF' : 'var(--bg-surface-subtle)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => document.getElementById('assignment-file-input').click()}
                    >
                      <input
                        id="assignment-file-input"
                        type="file"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        accept=".py,.ipynb,.zip,.tar,.gz,.pdf,.txt"
                      />

                      {file ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            textAlign: 'left'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-md)',
                              padding: '0.85rem 1rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                              <div
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: 'var(--radius-md)',
                                  backgroundColor: getFileExtensionBadge(file.name).bg,
                                  color: getFileExtensionBadge(file.name).color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                <FileText size={20} />
                              </div>

                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {file.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                                  <span>•</span>
                                  <span style={{ color: getFileExtensionBadge(file.name).color, fontWeight: 600 }}>
                                    {getFileExtensionBadge(file.name).label}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  document.getElementById('assignment-file-input').click();
                                }}
                                className="btn-secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveFile}
                                className="btn-icon"
                                style={{ width: '32px', height: '32px', color: 'var(--accent-urgent)' }}
                                title="Remove File"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Pre-submission Automated Diagnostics */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              padding: '0.5rem 0.75rem',
                              backgroundColor: '#ECFDF5',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid #A7F3D0',
                              fontSize: '0.74rem',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              <Check size={13} /> Size & Extension Validated
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              <Check size={13} /> Ready for PyTorch Autograder
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>SHA-256 Hash Generated</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '50%',
                              backgroundColor: '#ECFDF5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 0.75rem',
                              color: 'var(--accent-primary)'
                            }}
                          >
                            <UploadCloud size={24} />
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                            Drag & drop solution file here, or <span style={{ color: 'var(--accent-primary)' }}>browse</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Accepted: .py, .ipynb, .zip, .tar.gz, .pdf (Max limit: 50MB)
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* SUBMISSION METHOD: GIT REPO */}
                {submissionMethod === 'git' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      2. Enter Git Repository URL & Commit Branch
                    </label>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 2, minWidth: '220px' }}>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          Clone URL (HTTPS / SSH)
                        </span>
                        <input
                          type="url"
                          value={gitRepoUrl}
                          onChange={(e) => setGitRepoUrl(e.target.value)}
                          placeholder="https://github.com/username/repo-name"
                          style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
                          required
                        />
                      </div>

                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          Branch / Commit Hash
                        </span>
                        <input
                          type="text"
                          value={gitBranch}
                          onChange={(e) => setGitBranch(e.target.value)}
                          placeholder="main"
                          style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Info size={13} /> The autograder container will clone the exact HEAD commit of this branch.
                    </div>
                  </div>
                )}

                {/* SUBMISSION METHOD: DIRECT CODE */}
                {submissionMethod === 'code' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        2. Inline Code / Solution Buffer
                      </label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                        Python 3.11 Syntax
                      </span>
                    </div>

                    <textarea
                      value={directCode}
                      onChange={(e) => setDirectCode(e.target.value)}
                      rows={7}
                      style={{
                        width: '100%',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.82rem',
                        lineHeight: '1.5',
                        backgroundColor: '#0F172A',
                        color: '#F8FAFC',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                )}

                {/* 3. RUNTIME ENVIRONMENT & NOTES */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Execution Environment
                    </label>
                    <select
                      value={runtimeEnv}
                      onChange={(e) => setRuntimeEnv(e.target.value)}
                      style={{ width: '100%', fontSize: '0.82rem' }}
                    >
                      <option value="py311_pytorch">Python 3.11 (PyTorch 2.3 + CUDA 12.1)</option>
                      <option value="py310_standard">Python 3.10 (Standard SciPy / NumPy)</option>
                      <option value="nodejs20">Node.js 20 LTS (V8 Engine)</option>
                      <option value="cpp20">C++20 (GCC 13.2 / Clang 17)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Random Seeds / CLI Args (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="--seed 42 --batch_size 32"
                      style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                {/* 4. STUDENT NOTE TO INSTRUCTOR */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Note to Instructor / Teaching Assistant (Optional)
                  </label>
                  <textarea
                    value={studentComment}
                    onChange={(e) => setStudentComment(e.target.value)}
                    placeholder="Provide hyperparameter notes, bonus criteria attempted, or environment reproduction hints..."
                    rows={2}
                    style={{ width: '100%', resize: 'none', fontSize: '0.82rem' }}
                  />
                </div>

                {/* 5. ACADEMIC INTEGRITY PLEDGE */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem'
                  }}
                >
                  <input
                    type="checkbox"
                    id="honor-pledge-check"
                    checked={honorPledge}
                    onChange={(e) => setHonorPledge(e.target.checked)}
                    style={{ marginTop: '3px', cursor: 'pointer' }}
                  />
                  <label htmlFor="honor-pledge-check" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.4' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Academic Integrity Pledge:</strong> I certify that this submission is my own original work, developed in compliance with the university academic integrity code.
                  </label>
                </div>

                {/* SUBMISSION PROCESS PROGRESS BAR (DURING SUBMIT) */}
                {isSubmitting && (
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                        {submitStep === 1 && '1/3 Packaging archive & verifying SHA-256 hash...'}
                        {submitStep === 2 && '2/3 Dispatching to automated evaluation sandbox...'}
                        {submitStep === 3 && '3/3 Finalizing submission receipt...'}
                      </span>
                      <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                        {submitStep === 1 ? '35%' : submitStep === 2 ? '78%' : '100%'}
                      </span>
                    </div>

                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: submitStep === 1 ? '35%' : submitStep === 2 ? '78%' : '100%'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* FOOTER ACTIONS */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.5rem',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '1rem'
                  }}
                >
                  <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting || !honorPledge}
                    style={{ opacity: !honorPledge ? 0.6 : 1 }}
                  >
                    <FileCheck2 size={16} />
                    <span>{isSubmitting ? 'Uploading to Autograder...' : 'Confirm & Submit Assignment'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: RUBRIC & CRITERIA */}
            {activeTab === 'rubric' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {assignment.description}
                </div>

                {/* Requirements Checklist */}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={16} color="var(--accent-primary)" />
                    Specific Assignment Requirements:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {assignment.requirements?.map((req, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.6rem',
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-surface)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-default)',
                          fontSize: '0.82rem',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <span
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#ECFDF5',
                            color: 'var(--accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: '1px'
                          }}
                        >
                          {i + 1}
                        </span>
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grading Rubric Weight Breakdown */}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Grading Rubric Matrix ({assignment.points} pts total):
                  </div>

                  <div
                    style={{
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      fontSize: '0.8rem'
                    }}
                  >
                    {[
                      { item: 'Functional Correctness & Unit Test Cases', weight: '40%', pts: `${Math.round(assignment.points * 0.4)} pts`, desc: 'Passes all causal masking and matrix dimension test suites' },
                      { item: 'Computational Efficiency & Memory Tiling', weight: '30%', pts: `${Math.round(assignment.points * 0.3)} pts`, desc: 'Throughput matches or exceeds baseline PyTorch benchmark' },
                      { item: 'Code Quality, Modularity & Type Hinting', weight: '15%', pts: `${Math.round(assignment.points * 0.15)} pts`, desc: 'Clean docstrings, PEP 8 compliance, proper OOP hierarchy' },
                      { item: 'Written Benchmark Report & Convergence Analysis', weight: '15%', pts: `${Math.round(assignment.points * 0.15)} pts`, desc: 'Loss curve reproduction graphs and hyperparameter seeds' }
                    ].map((rubric, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          backgroundColor: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
                          borderBottom: idx < 3 ? '1px solid var(--border-subtle)' : 'none',
                          gap: '1rem'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {rubric.item}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {rubric.desc}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                            {rubric.pts}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                            ({rubric.weight})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button onClick={() => setActiveTab('submit')} className="btn-primary" style={{ fontSize: '0.85rem' }}>
                    <span>Proceed to Submission</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: STATUS & FEEDBACK */}
            {activeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {isGraded ? (
                  <>
                    {/* Graded Summary Card */}
                    <div
                      style={{
                        padding: '1.25rem',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: '#D1FAE5',
                            color: 'var(--accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Award size={24} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Final Grade Awarded</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {assignment.score} / {assignment.points}{' '}
                            <span style={{ fontSize: '0.9rem', color: 'var(--accent-primary)' }}>({assignment.score}%)</span>
                          </div>
                        </div>
                      </div>

                      <span className="badge badge-emerald" style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>
                        Grade Published
                      </span>
                    </div>

                    {/* Instructor Feedback */}
                    {assignment.feedback && (
                      <div
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem'
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={14} color="var(--accent-primary)" />
                          Instructor Feedback & Notes:
                        </div>
                        <p style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: '1.5' }}>
                          "{assignment.feedback}"
                        </p>
                      </div>
                    )}

                    {/* Autograder Terminal Output Log */}
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Terminal size={14} /> Automated Test Suite Execution Log:
                      </div>

                      <div
                        style={{
                          backgroundColor: '#0F172A',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem 1rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          color: '#34d399',
                          lineHeight: '1.6'
                        }}
                      >
                        <div>[2026-08-10 21:30:14] Initializing Python 3.11 PyTorch Test Sandbox...</div>
                        <div>[PASS] test_causal_mask_triangular_invariants (0.04s)</div>
                        <div>[PASS] test_multi_head_projection_dimensions (0.08s)</div>
                        <div>[PASS] test_rope_frequency_embeddings (0.03s)</div>
                        <div>[PASS] test_backward_gradient_clipping (0.12s)</div>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 700, marginTop: '4px' }}>
                          ================== 4/4 Test Suites Passed (Score: 100/100) ==================
                        </div>
                      </div>
                    </div>

                    {/* Submitted File Info */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileCheck2 size={16} color="var(--accent-primary)" />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {assignment.submissionFile || 'submission_solution.py'}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>(Version 1 • 245.8 KB)</span>
                      </div>

                      <button
                        onClick={() => setActiveTab('submit')}
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        Resubmit Solution
                      </button>
                    </div>
                  </>
                ) : isSubmitted ? (
                  <>
                    <div
                      style={{
                        padding: '1.5rem',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        borderRadius: 'var(--radius-lg)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}
                    >
                      <CheckCircle2 size={32} color="#059669" />
                      <div>
                        <h4 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                          Submission Received & In Queue
                        </h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Your file has been recorded. The automated test runner has processed your code and final instructor grading is pending.
                        </p>
                      </div>

                      <div
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          padding: '0.65rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}
                      >
                        <FileText size={15} color="var(--accent-primary)" />
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          {assignment.submissionFile || 'assignment_solution.py'}
                        </span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>• Autograder: 4/4 Passed</span>
                      </div>

                      <button
                        onClick={() => setActiveTab('submit')}
                        className="btn-primary"
                        style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}
                      >
                        Upload New Version
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <AlertCircle size={28} color="#d97706" style={{ margin: '0 auto 0.5rem' }} />
                    <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>No Submissions Yet</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: '1rem' }}>
                      This assignment is still open for submission until {assignment.dueRelative}.
                    </p>
                    <button onClick={() => setActiveTab('submit')} className="btn-primary" style={{ fontSize: '0.85rem' }}>
                      Upload Solution Now
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
