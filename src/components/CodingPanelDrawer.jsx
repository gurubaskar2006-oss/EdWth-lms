import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { Terminal, X, Play, Loader, Code, Database } from 'lucide-react';
import { apiService } from '../services/apiService';
import Editor from '@monaco-editor/react';

export const CodingPanelDrawer = () => {
  const { codingPanelOpen, setCodingPanelOpen, addToast } = useLMS();
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('print("Hello from Lumina Piston!")');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  
  const [activeMode, setActiveMode] = useState('code'); // 'code' or 'sql'
  const [sqlCode, setSqlCode] = useState('CREATE TABLE students (id INT, name TEXT);\nINSERT INTO students VALUES (1, "Alex Vance");\nSELECT * FROM students;');
  const [sqlOutput, setSqlOutput] = useState(null);

  if (!codingPanelOpen) return null;

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('');
    try {
      const result = await apiService.executeCode(language, code);
      if (result.success) {
        const rawOutput = result.data?.run?.output;
        if (rawOutput) {
          setOutput(rawOutput);
        } else if (result.data?.run?.stderr) {
          setOutput(`Errors:\n${result.data.run.stderr}`);
        } else {
          let emptyMsg = `(Program completed with exit code ${result.data?.run?.code ?? 0} with no output)\n\n`;
          const funcMatch = code.match(/(?:def|function)\s+([a-zA-Z0-9_]+)/);
          if (funcMatch) {
            emptyMsg += `💡 Tip: You defined \`${funcMatch[1]}(...)\`, but didn't call or print it.\nAdd print(${funcMatch[1]}(...)) at the bottom to see output.`;
          }
          setOutput(emptyMsg);
        }
        if (result.data?.run?.stderr && rawOutput) {
          setOutput((prev) => prev + '\n\nErrors:\n' + result.data.run.stderr);
        }
      } else {
        setOutput(`Error: ${result.message}`);
        addToast('Execution Failed', result.message, 'urgent');
      }
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSql = async () => {
    setIsRunning(true);
    setSqlOutput(null);
    try {
      // Append .mode json so sqlite3 outputs JSON array for easy parsing
      const query = `.mode json\n${sqlCode}`;
      const result = await apiService.executeCode('sqlite3', query);
      if (result.success) {
        const out = result.data?.run?.output;
        if (out) {
          try {
            // Find the first '[' character and parse from there to ignore non-json text
            const jsonStart = out.indexOf('[');
            if (jsonStart !== -1) {
              const parsed = JSON.parse(out.substring(jsonStart));
              setSqlOutput(parsed);
            } else {
              setSqlOutput({ raw: out });
            }
          } catch (e) {
            setSqlOutput({ raw: out });
          }
        } else {
          setSqlOutput([]);
        }
        if (result.data?.run?.stderr) {
          addToast('SQL Execution Error', result.data.run.stderr, 'urgent');
        }
      } else {
        setSqlOutput({ raw: `Error: ${result.message}` });
        addToast('Execution Failed', result.message, 'urgent');
      }
    } catch (err) {
      setSqlOutput({ raw: `Error: ${err.message}` });
    } finally {
      setIsRunning(false);
    }
  };

  const templates = {
    python: 'print("Hello from Lumina Piston!")',
    c: '#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    return 0;\n}',
    cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    return 0;\n}',
    java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}'
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(templates[newLang]);
    setOutput('');
  };

  return (
    <div
      className="coding-panel"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        backgroundColor: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-default)',
        boxShadow: '-4px 0 32px rgba(0, 0, 0, 0.12)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.3s ease forwards'
      }}
    >
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Terminal size={18} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>Execution Sandbox</h3>
          </div>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              onClick={() => setActiveMode('code')}
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', border: 'none', background: activeMode === 'code' ? 'var(--accent-primary)' : 'transparent', color: activeMode === 'code' ? '#FFFFFF' : 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer', fontWeight: activeMode === 'code' ? 700 : 500 }}
            >
              Polyglot
            </button>
            <button
              onClick={() => setActiveMode('sql')}
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', border: 'none', background: activeMode === 'sql' ? 'var(--accent-primary)' : 'transparent', color: activeMode === 'sql' ? '#FFFFFF' : 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer', fontWeight: activeMode === 'sql' ? 700 : 500 }}
            >
              SQL
            </button>
          </div>
        </div>
        <button onClick={() => setCodingPanelOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        {activeMode === 'code' ? (
          <>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Language:</label>
          <select 
            value={language}
            onChange={handleLanguageChange}
            style={{
              padding: '0.4rem',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <option value="python">Python 3</option>
            <option value="c">C (GCC)</option>
            <option value="cpp">C++ (GCC)</option>
            <option value="java">Java (OpenJDK)</option>
          </select>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}><Code size={12}/> Editor</span>
             <button 
                onClick={handleRun}
                disabled={isRunning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.85rem',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: isRunning ? 'not-allowed' : 'pointer'
                }}
             >
                {isRunning ? <Loader size={14} className="spin" /> : <Play size={14} />}
                Run Code
             </button>
          </div>
          <div style={{ flex: 1, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <Editor
              height="100%"
              language={language === 'c' || language === 'cpp' ? 'cpp' : language}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                scrollBeyondLastLine: false,
                padding: { top: 16 }
              }}
            />
          </div>
        </div>

        <div style={{ height: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Output</span>
          <div
            style={{
              flex: 1,
              backgroundColor: '#0F172A',
              color: '#38BDF8',
              border: '1px solid #1E293B',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap'
            }}
          >
            {output || 'Ready to execute...'}
          </div>
        </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}><Database size={12}/> SQL Query Editor</span>
                 <button 
                    onClick={handleRunSql}
                    disabled={isRunning}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.85rem',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: isRunning ? 'not-allowed' : 'pointer'
                    }}
                 >
                    {isRunning ? <Loader size={14} className="spin" /> : <Play size={14} />}
                    Run Query
                 </button>
              </div>
              <div style={{ flex: 1, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <Editor
                  height="100%"
                  language="sql"
                  theme="vs-dark"
                  value={sqlCode}
                  onChange={(value) => setSqlCode(value || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'var(--font-mono)',
                    scrollBeyondLastLine: false,
                    padding: { top: 16 }
                  }}
                />
              </div>
            </div>

            <div style={{ height: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Results Table</span>
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#0F172A',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'auto',
                  border: '1px solid var(--border-default)'
                }}
              >
                {!sqlOutput && <span style={{ color: 'var(--text-secondary)' }}>Ready to execute...</span>}
                {sqlOutput && sqlOutput.raw && (
                  <pre style={{ color: '#ff7b72', margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{sqlOutput.raw}</pre>
                )}
                {sqlOutput && Array.isArray(sqlOutput) && sqlOutput.length === 0 && (
                  <span style={{ color: 'var(--text-secondary)' }}>Query returned 0 rows.</span>
                )}
                {sqlOutput && Array.isArray(sqlOutput) && sqlOutput.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        {Object.keys(sqlOutput[0]).map((key) => (
                          <th key={key} style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontWeight: 600, fontSize: '0.82rem' }}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sqlOutput.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
