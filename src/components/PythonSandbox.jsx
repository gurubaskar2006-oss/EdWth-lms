import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLMS } from '../context/LMSContext';
import { PROGRAMMING_LANGUAGES } from '../data/mockData';
import {
  Play,
  RotateCcw,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  Maximize2,
  Minimize2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Code2,
  FileCode,
  Settings2,
  WrapText,
  Sliders,
  Cpu,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import Editor from '@monaco-editor/react';

export const PythonSandbox = () => {
  const { addToast } = useLMS();

  // Language state
  const [selectedLangId, setSelectedLangId] = useState('python');
  const currentLanguage =
    PROGRAMMING_LANGUAGES.find((lang) => lang.id === selectedLangId) || PROGRAMMING_LANGUAGES[0];

  // Default starter templates
  const getDefaultCode = (langName) => {
    switch (langName.toLowerCase()) {
      case 'python':
      case 'python 3.11':
        return `def fibonacci(n):\n    """Compute the nth Fibonacci number iteratively."""\n    if n <= 1:\n        return n\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b\n\ndef main():\n    print("--- Fibonacci Sequence (0 to 10) ---")\n    for i in range(11):\n        print(f"F({i}) = {fibonacci(i)}")\n\nif __name__ == "__main__":\n    main()\n`;
      case 'javascript':
        return `function fibonacci(n) {\n    if (n <= 1) return n;\n    let a = 0, b = 1;\n    for (let i = 2; i <= n; i++) {\n        let temp = a + b;\n        a = b;\n        b = temp;\n    }\n    return b;\n}\n\nconsole.log("--- JavaScript ES2023 Sandbox ---");\nfor (let i = 0; i <= 10; i++) {\n    console.log(\`F(\${i}) = \${fibonacci(i)}\`);\n}\n`;
      case 'c++':
      case 'cpp':
        return `#include <iostream>\n\nlong long fibonacci(int n) {\n    if (n <= 1) return n;\n    long long a = 0, b = 1;\n    for (int i = 2; i <= n; i++) {\n        long long temp = a + b;\n        a = b;\n        b = temp;\n    }\n    return b;\n}\n\nint main() {\n    std::cout << "--- C++ Modern Runner ---" << std::endl;\n    for (int i = 0; i <= 10; i++) {\n        std::cout << "F(" << i << ") = " << fibonacci(i) << std::endl;\n    }\n    return 0;\n}\n`;
      case 'java':
        return `public class Main {\n    public static long fibonacci(int n) {\n        if (n <= 1) return n;\n        long a = 0, b = 1;\n        for (int i = 2; i <= n; i++) {\n            long temp = a + b;\n            a = b;\n            b = temp;\n        }\n        return b;\n    }\n\n    public static void main(String[] args) {\n        System.out.println("--- Java Enterprise Runtime ---");\n        for (int i = 0; i <= 10; i++) {\n            System.out.println("F(" + i + ") = " + fibonacci(i));\n        }\n    }\n}\n`;
      default:
        return `# Code Lab Isolated Workspace\nprint("Hello, Academic Code Lab!")\n`;
    }
  };

  // Editor State
  const [code, setCode] = useState(() => getDefaultCode(currentLanguage.name));
  const [fontSize, setFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState('off');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Execution & Output State
  const [outputTab, setOutputTab] = useState('output'); // 'output' | 'errors' | 'details'
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [rawOutput, setRawOutput] = useState('');
  const [executionState, setExecutionState] = useState('READY'); // READY | RUNNING | COMPLETED | FAILED | TIMEOUT | QUEUED | SANDBOX UNAVAILABLE
  const [executionMetrics, setExecutionMetrics] = useState(null); // { status, code, durationMs, language, version, byteCount }
  const [isRunning, setIsRunning] = useState(false);

  // Vertical Split Sizing: editorHeightPct between 45% and 85%
  const [editorHeightPct, setEditorHeightPct] = useState(72);
  const isDraggingRef = useRef(false);
  const workspaceContainerRef = useRef(null);

  // Switch Language
  const handleLanguageChange = (langId) => {
    setSelectedLangId(langId);
    const newLang = PROGRAMMING_LANGUAGES.find((lang) => lang.id === langId) || PROGRAMMING_LANGUAGES[0];
    setCode(getDefaultCode(newLang.name));
    setStdout('');
    setStderr('');
    setRawOutput('');
    setExecutionState('READY');
    setExecutionMetrics(null);
    addToast('Language Switched', `Runtime environment set to ${newLang.name}`, 'emerald');
  };

  // Reset Code
  const handleReset = () => {
    setCode(getDefaultCode(currentLanguage.name));
    setStdout('');
    setStderr('');
    setRawOutput('');
    setExecutionState('READY');
    setExecutionMetrics(null);
    addToast('Code Reset', 'Restored starter template', 'subtle');
  };

  // Copy Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Code Copied', 'Clipboard updated', 'emerald');
  };

  // Run Code via backend execution queue & Piston runner
  const handleRunCode = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecutionState('RUNNING');
    setOutputTab('output');
    setStdout('');
    setStderr('');
    setRawOutput(`[Compiling & Executing in ${currentLanguage.name} container...]\n`);

    const startTime = performance.now();

    try {
      const { apiService } = await import('../services/apiService');
      const response = await apiService.executeCode(selectedLangId, code);
      const durationMs = Math.round(performance.now() - startTime);

      if (!response.success) {
        const isUnavailable = response.error === 'ISOLATED_RUNNER_UNAVAILABLE' || response.status === 503;
        const isTimeout = response.code === 'TIMEOUT' || response.status === 408 || response.message?.includes('timed out');
        const state = isUnavailable ? 'SANDBOX UNAVAILABLE' : isTimeout ? 'TIMEOUT' : 'FAILED';

        setExecutionState(state);
        setStderr(response.message || 'Execution failed.');
        setRawOutput(`[${state}]\n${response.message || 'Error occurred.'}`);
        setExecutionMetrics({
          status: state,
          code: response.status || 1,
          durationMs,
          language: currentLanguage.name,
          version: currentLanguage.version || 'Container',
          byteCount: 0
        });
        setOutputTab('errors');
        return;
      }

      const run = response.data?.run || {};
      const outText = run.output || run.stdout || '';
      const errText = run.stderr || '';
      const exitCode = run.code ?? 0;
      const state = exitCode === 0 ? 'COMPLETED' : 'FAILED';

      setExecutionState(state);
      setStdout(outText);
      setStderr(errText);
      setRawOutput(outText || errText || `(Program completed with exit code ${exitCode} with zero output)`);

      setExecutionMetrics({
        status: state,
        code: exitCode,
        durationMs,
        language: response.data?.language || currentLanguage.name,
        version: response.data?.version || currentLanguage.version || 'Isolated Runner',
        signal: run.signal || null,
        byteCount: (outText + errText).length
      });

      // If execution produced errors only, switch to Errors tab for developer ergonomics
      if (exitCode !== 0 && errText && !outText) {
        setOutputTab('errors');
      } else {
        setOutputTab('output');
      }
    } catch (e) {
      console.error(e);
      const durationMs = Math.round(performance.now() - startTime);
      setExecutionState('FAILED');
      setStderr(e.message || 'Network connection failed.');
      setRawOutput(`[Connection Error]\nCould not connect to Lumina execution service.`);
      setExecutionMetrics({
        status: 'FAILED',
        code: -1,
        durationMs,
        language: currentLanguage.name,
        version: 'Offline',
        byteCount: 0
      });
      setOutputTab('errors');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, currentLanguage, selectedLangId, code]);

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to run
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunCode]);

  // Draggable Split Divider Handlers
  const handleMouseDownOnDivider = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current || !workspaceContainerRef.current) return;
      const rect = workspaceContainerRef.current.getBoundingClientRect();
      const relativeY = moveEvent.clientY - rect.top;
      const percentage = (relativeY / rect.height) * 100;
      // Clamp between 45% and 85%
      const clamped = Math.max(45, Math.min(85, Math.round(percentage)));
      setEditorHeightPct(clamped);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // State Badge Indicator Color
  const getStateBadge = (state) => {
    switch (state) {
      case 'RUNNING':
        return { color: 'var(--accent-blue)', bg: 'rgba(37, 99, 235, 0.1)', icon: Clock, label: 'Running...' };
      case 'COMPLETED':
        return { color: 'var(--accent-primary)', bg: 'rgba(5, 150, 105, 0.1)', icon: CheckCircle2, label: 'Completed (Exit 0)' };
      case 'FAILED':
        return { color: 'var(--priority-urgent-text)', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle, label: 'Failed' };
      case 'TIMEOUT':
        return { color: 'var(--priority-high-text)', bg: 'rgba(217, 119, 6, 0.1)', icon: AlertCircle, label: 'Timeout Exceeded' };
      case 'SANDBOX UNAVAILABLE':
        return { color: 'var(--priority-urgent-text)', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle, label: 'Sandbox Unavailable' };
      default:
        return { color: 'var(--text-muted)', bg: 'var(--bg-surface)', icon: Code2, label: 'Ready' };
    }
  };

  const stateBadge = getStateBadge(executionState);
  const StateIcon = stateBadge.icon;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        ...(isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'var(--bg-main)',
              padding: '1rem',
              height: '100vh',
              overflow: 'hidden'
            }
          : {})
      }}
    >
      {/* ─── 1. TOP COMPACT TOOLBAR ─── */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.65rem 1rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Left: Code Lab Title & Active Environment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-blue-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)'
            }}
          >
            <Code2 size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Code Lab
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                • Enterprise IDE
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
              Practice, build and experiment in isolated sandbox environments.
            </p>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Split View Quick Presets */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '2px'
            }}
            title="Adjust vertical IDE split ratio"
          >
            {[
              { label: '75/25', pct: 75, title: 'Default (Editor 75%, Output 25%)' },
              { label: '85/15', pct: 85, title: 'Editor Focus (Editor 85%, Output 15%)' },
              { label: '55/45', pct: 55, title: 'Debug Focus (Editor 55%, Output 45%)' }
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setEditorHeightPct(preset.pct)}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: editorHeightPct === preset.pct ? 700 : 500,
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: editorHeightPct === preset.pct ? 'var(--bg-card)' : 'transparent',
                  color: editorHeightPct === preset.pct ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: editorHeightPct === preset.pct ? 'var(--shadow-sm)' : 'none'
                }}
                title={preset.title}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Language Selector */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedLangId}
              onChange={(e) => handleLanguageChange(e.target.value)}
              style={{
                padding: '0.4rem 2rem 0.4rem 0.8rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--accent-blue)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                appearance: 'none'
              }}
            >
              {PROGRAMMING_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}
            />
          </div>

          {/* Reset Starter Code */}
          <button
            onClick={handleReset}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.76rem', gap: '4px' }}
            title="Reset code to starter template"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Run Code Button (with Ctrl+Enter indicator) */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="btn-primary"
            style={{
              padding: '0.42rem 1.15rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              gap: '6px',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
            }}
            title="Execute Code (Ctrl + Enter)"
          >
            <Play size={13} fill="currentColor" />
            <span>{isRunning ? 'Running...' : 'Run Code'}</span>
            <kbd
              style={{
                fontSize: '0.62rem',
                fontWeight: 600,
                backgroundColor: 'rgba(255, 255, 255, 0.22)',
                color: '#FFFFFF',
                padding: '0.1rem 0.35rem',
                borderRadius: '3px',
                marginLeft: '4px'
              }}
            >
              Ctrl+↵
            </kbd>
          </button>
        </div>
      </div>

      {/* ─── 2. IDE WORKSPACE: TOP DOMINANT EDITOR + BOTTOM DOCKED OUTPUT ─── */}
      <div
        ref={workspaceContainerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isFullscreen ? 'calc(100vh - 85px)' : 'calc(100vh - 170px)',
          minHeight: '620px',
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-elevation)',
          position: 'relative'
        }}
      >
        {/* ─── TOP: MONACO CODE EDITOR (DOMINANT ~70–85%) ─── */}
        <div
          style={{
            height: `${editorHeightPct}%`,
            minHeight: '220px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: '#0F172A'
          }}
        >
          {/* File Tab Header Strip */}
          <div
            style={{
              padding: '0.35rem 0.85rem',
              backgroundColor: '#1E293B',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexShrink: 0
            }}
          >
            {/* Active File Tab */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#0F172A',
                  padding: '0.28rem 0.75rem',
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                  borderTop: '2px solid var(--accent-blue)',
                  color: '#F8FAFC',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <FileCode size={13} color="#38BDF8" />
                <span>{currentLanguage.fileName || 'main.py'}</span>
              </div>

              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                {currentLanguage.version || 'v3.11'}
              </span>
            </div>

            {/* Editor Utilities: Font size, wrap, copy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Word Wrap Toggle */}
              <button
                onClick={() => setWordWrap((w) => (w === 'on' ? 'off' : 'on'))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: wordWrap === 'on' ? '#38BDF8' : '#94A3B8',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title="Toggle Word Wrap"
              >
                <WrapText size={13} />
                <span>Wrap</span>
              </button>

              {/* Font Size Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Font:</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#F8FAFC',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '0.15rem 0.35rem',
                    fontSize: '0.68rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value={12}>12px</option>
                  <option value={13}>13px</option>
                  <option value={14}>14px</option>
                  <option value={16}>16px</option>
                  <option value={18}>18px</option>
                </select>
              </div>

              {/* Copy Code */}
              <button
                onClick={handleCopyCode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copied ? '#34D399' : '#94A3B8',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title="Copy entire code buffer"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <Editor
              height="100%"
              language={
                selectedLangId === 'c' || selectedLangId === 'cpp'
                  ? 'cpp'
                  : selectedLangId === 'sqlite3' || selectedLangId === 'sql'
                  ? 'sql'
                  : selectedLangId
              }
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: fontSize,
                fontFamily: 'var(--font-mono)',
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                wordWrap: wordWrap,
                tabSize: 4,
                automaticLayout: true
              }}
            />
          </div>
        </div>

        {/* ─── DRAGGABLE DIVIDER / RESIZER BAR ─── */}
        <div
          onMouseDown={handleMouseDownOnDivider}
          style={{
            height: '8px',
            backgroundColor: '#1E293B',
            borderTop: '1px solid #334155',
            borderBottom: '1px solid #334155',
            cursor: 'row-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background-color var(--transition-fast)'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-blue)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1E293B')}
          title="Drag vertically to adjust split ratio"
        >
          <div
            style={{
              width: '36px',
              height: '3px',
              borderRadius: '2px',
              backgroundColor: '#64748B'
            }}
          />
        </div>

        {/* ─── BOTTOM: DOCKED OUTPUT CONSOLE (15–30%) ─── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#090D16',
            overflow: 'hidden'
          }}
        >
          {/* Output Header with Tabs & Authentic Status Badge */}
          <div
            style={{
              padding: '0.35rem 0.85rem',
              backgroundColor: '#111827',
              borderBottom: '1px solid #1F2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexShrink: 0
            }}
          >
            {/* Output Tabs: OUTPUT | ERRORS | EXECUTION DETAILS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                onClick={() => setOutputTab('output')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '0.28rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: outputTab === 'output' ? 700 : 500,
                  backgroundColor: outputTab === 'output' ? '#1F2937' : 'transparent',
                  color: outputTab === 'output' ? '#38BDF8' : '#9CA3AF',
                  cursor: 'pointer'
                }}
              >
                <Terminal size={12} />
                <span>OUTPUT</span>
              </button>

              <button
                onClick={() => setOutputTab('errors')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '0.28rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: outputTab === 'errors' ? 700 : 500,
                  backgroundColor: outputTab === 'errors' ? '#1F2937' : 'transparent',
                  color: outputTab === 'errors' ? '#F87171' : '#9CA3AF',
                  cursor: 'pointer'
                }}
              >
                <AlertCircle size={12} />
                <span>ERRORS {stderr ? `(1)` : ''}</span>
              </button>

              <button
                onClick={() => setOutputTab('details')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '0.28rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: outputTab === 'details' ? 700 : 500,
                  backgroundColor: outputTab === 'details' ? '#1F2937' : 'transparent',
                  color: outputTab === 'details' ? '#FBBF24' : '#9CA3AF',
                  cursor: 'pointer'
                }}
              >
                <Info size={12} />
                <span>EXECUTION DETAILS</span>
              </button>
            </div>

            {/* Authentic Status Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: stateBadge.bg,
                color: stateBadge.color,
                fontSize: '0.68rem',
                fontWeight: 700
              }}
            >
              <StateIcon size={12} />
              <span>{stateBadge.label}</span>
            </div>
          </div>

          {/* Tab Content Display */}
          <div
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              lineHeight: 1.55
            }}
          >
            {/* TAB: OUTPUT */}
            {outputTab === 'output' && (
              <div style={{ color: '#E2E8F0', whiteSpace: 'pre-wrap' }}>
                {rawOutput ? (
                  rawOutput
                ) : (
                  <span style={{ color: '#64748B' }}>
                    $ Ready. Click 'Run Code' or press Ctrl+Enter to compile and run your program.
                  </span>
                )}
              </div>
            )}

            {/* TAB: ERRORS */}
            {outputTab === 'errors' && (
              <div style={{ color: '#F87171', whiteSpace: 'pre-wrap' }}>
                {stderr ? (
                  stderr
                ) : (
                  <span style={{ color: '#64748B' }}>
                    ✓ No compilation or runtime errors recorded.
                  </span>
                )}
              </div>
            )}

            {/* TAB: EXECUTION DETAILS (Real Backend Metrics Only - Zero Fake Data) */}
            {outputTab === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', paddingBottom: '0.35rem', borderBottom: '1px solid #1F2937' }}>
                  Authentic Piston / Sandbox Runner Telemetry
                </div>

                {executionMetrics ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ backgroundColor: '#111827', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #1F2937' }}>
                      <span style={{ fontSize: '0.66rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>Status</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: stateBadge.color }}>{executionMetrics.status}</span>
                    </div>

                    <div style={{ backgroundColor: '#111827', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #1F2937' }}>
                      <span style={{ fontSize: '0.66rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>Exit Code</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: executionMetrics.code === 0 ? '#34D399' : '#F87171' }}>
                        {executionMetrics.code}
                      </span>
                    </div>

                    <div style={{ backgroundColor: '#111827', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #1F2937' }}>
                      <span style={{ fontSize: '0.66rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>Client Round-Trip</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#38BDF8' }}>{executionMetrics.durationMs} ms</span>
                    </div>

                    <div style={{ backgroundColor: '#111827', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #1F2937' }}>
                      <span style={{ fontSize: '0.66rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>Runtime</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F8FAFC' }}>
                        {executionMetrics.language} ({executionMetrics.version})
                      </span>
                    </div>

                    {executionMetrics.signal && (
                      <div style={{ backgroundColor: '#111827', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #1F2937' }}>
                        <span style={{ fontSize: '0.66rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>Process Signal</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FBBF24' }}>{executionMetrics.signal}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#64748B', fontSize: '0.76rem' }}>
                    Run a program to view genuine execution telemetry from the runner container.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
