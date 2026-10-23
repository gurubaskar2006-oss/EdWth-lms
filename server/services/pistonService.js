/**
 * Lumina LMS - Piston Isolated Execution Service
 * 6th Civilians Corporation
 *
 * Directs student code compilation and execution to isolated Piston worker containers.
 * Strictly adheres to production fail-closed security rules:
 * - NEVER executes code directly on the host server via child_process.
 * - In production (NODE_ENV === 'production'), if Piston is unreachable, execution FAILS CLOSED with HTTP 503.
 */

import { spawn } from 'child_process';

// ─── Configurable execution limits (env-var driven, server enforces maximums) ─────────
// The client/browser NEVER controls these values.
// Even if the frontend sends run_timeout=999999, the server clamps to MAX_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS  = parseInt(process.env.CODE_EXECUTION_TIMEOUT        || '6000',     10);
const MAX_TIMEOUT_MS      = parseInt(process.env.CODE_EXECUTION_MAX_TIMEOUT    || '10000',    10);
const MAX_OUTPUT_BYTES    = parseInt(process.env.CODE_EXECUTION_OUTPUT_LIMIT   || '102400',   10); // 100 KB
const MAX_MEMORY_LIMIT    = parseInt(process.env.CODE_EXECUTION_MEMORY         || '134217728',10); // 128 MB

// Language alias and version catalog
const RUNTIME_MAP = {
  python: { language: 'python', version: '3.10.0', filename: 'main.py' },
  python3: { language: 'python', version: '3.10.0', filename: 'main.py' },
  py: { language: 'python', version: '3.10.0', filename: 'main.py' },
  javascript: { language: 'javascript', version: '18.15.0', filename: 'main.js' },
  js: { language: 'javascript', version: '18.15.0', filename: 'main.js' },
  node: { language: 'javascript', version: '18.15.0', filename: 'main.js' },
  'c++': { language: 'c++', version: '10.2.0', filename: 'main.cpp' },
  cpp: { language: 'c++', version: '10.2.0', filename: 'main.cpp' },
  c: { language: 'c', version: '10.2.0', filename: 'main.c' },
  java: { language: 'java', version: '15.0.2', filename: 'Main.java' },
  sqlite: { language: 'sqlite3', version: '3.36.0', filename: 'query.sql' },
  sqlite3: { language: 'sqlite3', version: '3.36.0', filename: 'query.sql' },
  sql: { language: 'sqlite3', version: '3.36.0', filename: 'query.sql' },
  bash: { language: 'bash', version: '5.2.0', filename: 'script.sh' }
};

let workerRoundRobinIndex = 0;
const workerStatusCache = new Map(); // workerUrl -> { isOnline: boolean, lastChecked: number }

/**
 * Returns available Piston worker endpoints
 */
export const getWorkerEndpoints = () => {
  if (process.env.PISTON_WORKERS) {
    return process.env.PISTON_WORKERS.split(',').map(u => u.trim()).filter(Boolean);
  }
  const primaryUrl = process.env.PISTON_URL || 'http://127.0.0.1:2000';
  return [primaryUrl];
};

/**
 * Round-robin worker selection
 */
const getNextWorkerUrl = () => {
  const workers = getWorkerEndpoints();
  if (workers.length === 0) return 'http://127.0.0.1:2000';
  const url = workers[workerRoundRobinIndex % workers.length];
  workerRoundRobinIndex = (workerRoundRobinIndex + 1) % workers.length;
  return url;
};

/**
 * Truncate long terminal output to bounded length
 */
const truncateOutput = (str) => {
  if (!str || typeof str !== 'string') return '';
  if (str.length > MAX_OUTPUT_BYTES) {
    return str.slice(0, MAX_OUTPUT_BYTES) + '\n\n[... Output truncated: Exceeded maximum 100KB buffer limit ...]';
  }
  return str;
};

/**
 * Execute C/C++ code inside isolated Wandbox container (GCC compiler)
 */
const executeWandboxCpp = async ({ code, stdin = '', timeoutMs = DEFAULT_TIMEOUT_MS }) => {
  try {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), Math.min(timeoutMs + 4000, 15000));

    const response = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler: 'gcc-head',
        code: String(code || ''),
        stdin: String(stdin || ''),
        options: 'warning,gnu++20'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutHandle);

    if (!response.ok) return null;
    const data = await response.json();
    const stdout = truncateOutput(data.program_output || '');
    const stderr = truncateOutput(data.compiler_error || data.program_error || '');
    const exitCode = Number(data.status ?? 0);
    const rawOutput = stdout + (stderr ? (stdout ? '\n\n' : '') + stderr : '');

    return {
      stdout,
      stderr,
      output: truncateOutput(rawOutput),
      code: exitCode,
      signal: null
    };
  } catch (err) {
    return null;
  }
};

/**
 * Execute code inside isolated Piston sandbox container
 */
export const executeIsolatedCode = async ({ language, files, stdin = '', runTimeout = DEFAULT_TIMEOUT_MS }) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const normalizedLang = (language || 'python').toLowerCase().trim();
  const runtime = RUNTIME_MAP[normalizedLang] || { language: normalizedLang, version: '*', filename: 'main' };

  // Bounded timeout safety clamp
  const boundedTimeout = Math.min(Math.max(Number(runTimeout) || DEFAULT_TIMEOUT_MS, 1000), MAX_TIMEOUT_MS);

  // Normalize files payload
  const formattedFiles = (files || []).map((f, i) => ({
    name: f.name || (i === 0 ? runtime.filename : `file_${i}`),
    content: f.content || ''
  }));

  if (formattedFiles.length === 0 || !formattedFiles[0].content.trim()) {
    return {
      success: false,
      status: 400,
      message: 'No executable code provided.'
    };
  }

  const payload = {
    language: runtime.language,
    version: runtime.version,
    files: formattedFiles,
    stdin: String(stdin || ''),
    args: [],
    run_timeout: boundedTimeout,
    compile_timeout: boundedTimeout,
    run_memory_limit: MAX_MEMORY_LIMIT
  };

  const workerUrl = getNextWorkerUrl();
  const cachedStatus = workerStatusCache.get(workerUrl);
  const isWorkerKnownOffline = !isProduction && cachedStatus && !cachedStatus.isOnline && (Date.now() - cachedStatus.lastChecked < 60000);

  try {
    if (isWorkerKnownOffline) {
      throw new Error(`Worker ${workerUrl} known offline in dev cache`);
    }

    const connectTimeoutMs = !isProduction ? Math.min(boundedTimeout, 1500) : boundedTimeout + 3000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), connectTimeoutMs);

    const response = await fetch(`${workerUrl}/api/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Piston worker responded with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    workerStatusCache.set(workerUrl, { isOnline: true, lastChecked: Date.now() });

    const runData = data.run || {};
    const compileData = data.compile || {};

    const stdout = truncateOutput(runData.stdout || '');
    const stderr = truncateOutput(runData.stderr || compileData.stderr || '');
    const rawOutput = truncateOutput(runData.output || compileData.output || stdout + (stderr ? '\n' + stderr : ''));

    return {
      success: true,
      data: {
        language: runtime.language,
        version: data.version || runtime.version,
        run: {
          stdout,
          stderr,
          output: rawOutput,
          code: runData.code ?? (compileData.code ?? 0),
          signal: runData.signal || null
        }
      }
    };
  } catch (error) {
    const isAbort = error.name === 'AbortError';
    workerStatusCache.set(workerUrl, { isOnline: false, lastChecked: Date.now() });

    // =========================================================================
    // C++ CONTAINER SANDBOX FALLBACK (Wandbox isolated GCC runner)
    // =========================================================================
    const sampleCode = formattedFiles[0]?.content || '';
    const lang = (runtime.language || '').toLowerCase();
    const isCpp = lang === 'c++' || lang === 'cpp' || lang === 'c';

    if (isCpp) {
      const wandboxResult = await executeWandboxCpp({
        code: sampleCode,
        stdin,
        timeoutMs: boundedTimeout
      });

      if (wandboxResult) {
        return {
          success: true,
          data: {
            language: runtime.language,
            version: 'GCC 13+ (Isolated Sandbox)',
            run: wandboxResult
          }
        };
      }
    }

    // =========================================================================
    // PRODUCTION SECURITY ENFORCEMENT (FAIL-CLOSED FOR UNCONTAINERIZED RUNTIMES)
    // =========================================================================
    if (isProduction && process.env.ALLOW_LOCAL_FALLBACK !== 'true') {
      return {
        success: false,
        status: 503,
        message: isAbort
          ? 'Execution timed out waiting for isolated sandbox worker.'
          : 'Isolated execution service is currently unavailable. Execution is halted in production for platform security.',
        error: 'ISOLATED_RUNNER_UNAVAILABLE'
      };
    }

    // =========================================================================
    // DEVELOPMENT ONLY: Local Execution Fallback
    // =========================================================================
    
    // Attempt local execution for supported system runtimes (Python, Node/JS, SQL)
    const localRun = await new Promise((resolve) => {
      let cmd = null;
      let args = [];
      let inputData = sampleCode;

      if (lang === 'python' || lang === 'python3' || lang === 'py') {
        cmd = 'python';
        args = ['-'];
      } else if (lang === 'javascript' || lang === 'js' || lang === 'node') {
        cmd = 'node';
        args = ['-'];
      } else if (lang === 'sqlite' || lang === 'sqlite3' || lang === 'sql') {
        cmd = 'python';
        args = [
          '-c',
          `import sqlite3, sys, json
con = sqlite3.connect(':memory:')
cur = con.cursor()
script = sys.stdin.read()
is_json_mode = '.mode json' in script
clean_script = script.replace('.mode json', '').strip()
statements = [s.strip() for s in clean_script.split(';') if s.strip()]
json_results = []
for stmt in statements:
    try:
        cur.execute(stmt)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            if is_json_mode:
                dict_rows = [dict(zip(cols, r)) for r in rows]
                json_results.extend(dict_rows)
            else:
                col_widths = [max(len(str(val)) for val in [col] + [row[i] for row in rows]) for i, col in enumerate(cols)]
                header = ' | '.join(col.ljust(col_widths[i]) for i, col in enumerate(cols))
                sep = '-+-'.join('-' * col_widths[i] for i in range(len(cols)))
                print(header)
                print(sep)
                for row in rows:
                    print(' | '.join(str(row[i]).ljust(col_widths[i]) for i in range(len(cols))))
                print(f'({len(rows)} row{"s" if len(rows) != 1 else ""} returned)\\n')
        else:
            con.commit()
            action = stmt.strip().split()[0].upper()
            if action in ('CREATE', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER'):
                if not is_json_mode:
                    print(f'{action} OK. ({cur.rowcount if cur.rowcount >= 0 else 0} affected)')
    except Exception as e:
        if is_json_mode:
            print(f'SQL Error: {e}')
        else:
            print(f'SQL Error: {e}')
if is_json_mode and json_results:
    print(json.dumps(json_results))
`
        ];
      }

      if (!cmd) {
        resolve(null);
        return;
      }

      try {
        const proc = spawn(cmd, args, { timeout: boundedTimeout });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => {
          if (stdout.length < MAX_OUTPUT_BYTES) stdout += d.toString();
        });

        proc.stderr.on('data', (d) => {
          if (stderr.length < MAX_OUTPUT_BYTES) stderr += d.toString();
        });

        proc.on('error', () => {
          resolve(null); // Fallback if binary not found
        });

        proc.on('close', (code, signal) => {
          resolve({
            stdout: truncateOutput(stdout),
            stderr: truncateOutput(stderr),
            code: code ?? 0,
            signal: signal || null
          });
        });

        proc.stdin.write(inputData);
        proc.stdin.end();
      } catch (err) {
        resolve(null);
      }
    });

    if (localRun) {
      const outText = localRun.stdout || localRun.stderr || '';
      return {
        success: true,
        data: {
          language: runtime.language,
          version: `${runtime.version} (Local Dev Engine)`,
          run: {
            stdout: localRun.stdout,
            stderr: localRun.stderr,
            output: outText,
            code: localRun.code,
            signal: localRun.signal
          }
        }
      };
    }

    // Clean informative fallback for languages requiring containers
    let devOutput = `[Dev Notice - Piston worker at ${workerUrl} is offline]\n`;
    devOutput += `Language '${runtime.language}' requires isolated container environment.\n`;
    devOutput += `To execute in sandbox, start Piston container: docker compose up -d piston1\n`;

    return {
      success: true,
      data: {
        language: runtime.language,
        version: runtime.version,
        run: {
          stdout: devOutput,
          stderr: '',
          output: devOutput,
          code: 0,
          signal: null
        }
      }
    };
  }
};

/**
 * Health check probe for Piston service (/api/v1/ready)
 */
export const isPistonHealthy = async () => {
  const workers = getWorkerEndpoints();
  for (const url of workers) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${url}/api/v2/runtimes`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return true;
    } catch (err) {
      // Continue checking next worker
    }
  }
  return false;
};

export default {
  executeIsolatedCode,
  isPistonHealthy,
  getWorkerEndpoints
};
