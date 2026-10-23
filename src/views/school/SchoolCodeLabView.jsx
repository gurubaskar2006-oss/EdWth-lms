import React, { useState, useCallback, useEffect } from 'react';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useLMS } from '../../context/LMSContext';
import { apiService } from '../../services/apiService';
import Editor from '@monaco-editor/react';
import {
  Code2,
  Play,
  RotateCcw,
  Trash2,
  Terminal,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  BookOpen,
  Lightbulb,
  Eye,
  Check,
  HelpCircle
} from 'lucide-react';

export const LANGUAGE_OPTIONS = [
  { id: 'python', label: 'Python 3.10', ext: 'main.py', monaco: 'python', iconColor: '#00E676' },
  { id: 'cpp', label: 'C++ 20 (GCC)', ext: 'main.cpp', monaco: 'cpp', iconColor: '#38BDF8' },
  { id: 'sql', label: 'SQL (SQLite)', ext: 'queries.sql', monaco: 'sql', iconColor: '#F58212' }
];

export const FREEFORM_STARTERS = {
  python: `# main.py
# Freeform Python 3.10 sandbox. Type arbitrary code here to experiment.

print("Hello, EdWth Code Lab!")
`,
  cpp: `// main.cpp
// Freeform C++20 sandbox with GCC compiler
#include <iostream>

int main() {
    std::cout << "Hello, EdWth Code Lab C++!" << std::endl;
    return 0;
}
`,
  sql: `-- queries.sql
-- Freeform in-memory SQLite sandbox
CREATE TABLE students (
    id INTEGER PRIMARY KEY,
    name TEXT,
    subject TEXT
);

INSERT INTO students VALUES (1, 'Alex Vance', 'Computer Science'), (2, 'Maya Lin', 'AI Systems');
SELECT * FROM students;
`
};

export const GUIDED_EXERCISES = [
  {
    id: 'ex-1',
    title: 'Temperature Converter (Celsius to Fahrenheit)',
    topic: 'Variables & Arithmetic',
    difficulty: 'Beginner',
    objective: 'Practice variable declaration, standard mathematical operations, and formatted console output.',
    instructions: 'Convert the Celsius temperature variable `celsius = 25` to Fahrenheit using the standard conversion formula: F = (C * 9/5) + 32. Store the result in `fahrenheit` and print it.',
    starterCode: `# Exercise: Temperature Converter
# Learning Objective: Calculate Fahrenheit from Celsius

celsius = 25

# TODO: Calculate fahrenheit using the formula: (celsius * 9 / 5) + 32
fahrenheit = 0  # Replace 0 with your formula expression

# TODO: Print the converted temperature
print("Temperature in Fahrenheit:", fahrenheit)
`,
    hints: [
      'In Python, multiplication (*) and division (/) have higher precedence than addition (+).',
      'The formula is: (celsius * 9 / 5) + 32.',
      'For 25°C, the expected Fahrenheit output is 77.0.'
    ],
    solution: `# Reference Solution: Temperature Converter
celsius = 25
fahrenheit = (celsius * 9 / 5) + 32
print("Temperature in Fahrenheit:", fahrenheit)
`
  },
  {
    id: 'ex-2',
    title: 'Even or Odd Number Classifier',
    topic: 'Conditionals & Modulo',
    difficulty: 'Beginner',
    objective: 'Master conditional branching (if/else) and the modulo (%) arithmetic operator.',
    instructions: 'Given an integer `num = 14`, check whether it is even or odd. Print "Even" if the number is divisible by 2 with no remainder, otherwise print "Odd".',
    starterCode: `# Exercise: Even or Odd Classifier
# Learning Objective: Use modulo operator and conditional branching

num = 14

# TODO: Write an if/else conditional check using the modulo (%) operator
# If num is divisible by 2 with no remainder (num % 2 == 0), print "Even"
# Otherwise, print "Odd"

if False: # Replace False with your condition
    print(f"{num} is Even")
else:
    print(f"{num} is Odd")
`,
    hints: [
      'The % (modulo) operator returns the remainder of integer division. E.g., 14 % 2 is 0.',
      'Check if num % 2 == 0 to determine if it is an even number.'
    ],
    solution: `# Reference Solution: Even or Odd Classifier
num = 14
if num % 2 == 0:
    print(f"{num} is Even")
else:
    print(f"{num} is Odd")
`
  },
  {
    id: 'ex-3',
    title: 'Sum of First N Natural Numbers',
    topic: 'Loops & Iteration',
    difficulty: 'Intermediate',
    objective: 'Implement iterative accumulation using a for-loop and the range() function.',
    instructions: 'Compute the total sum of all positive integers from 1 up to `n = 10` (inclusive). Accumulate the running total in `total_sum` and print the final value.',
    starterCode: `# Exercise: Sum of First N Numbers
# Learning Objective: Accumulate values using a for loop

n = 10
total_sum = 0

# TODO: Iterate through numbers from 1 to n (inclusive) and accumulate in total_sum
# Note: range(start, stop) in Python stops before stop, so use range(1, n + 1)
for i in range(1, 1): # TODO: Adjust range arguments
    pass # TODO: Add i to total_sum

print("Sum of numbers 1 to", n, "is:", total_sum)
`,
    hints: [
      'Use range(1, n + 1) so that the loop includes the number 10.',
      'Inside the loop body, add the current number using: total_sum += i or total_sum = total_sum + i.',
      'For n = 10, the expected sum is 55.'
    ],
    solution: `# Reference Solution: Sum of First N Numbers
n = 10
total_sum = 0
for i in range(1, n + 1):
    total_sum += i
print("Sum of numbers 1 to", n, "is:", total_sum)
`
  },
  {
    id: 'ex-4',
    title: 'Palindrome String Checker',
    topic: 'Functions & String Slicing',
    difficulty: 'Intermediate',
    objective: 'Define reusable functions and reverse strings using Python slice syntax.',
    instructions: 'Define a function `is_palindrome(text)` that returns True if the string reads the same forwards and backwards (case-insensitive), or False otherwise. Test with "radar" and "python".',
    starterCode: `# Exercise: Palindrome Checker
# Learning Objective: Define functions and slice strings

def is_palindrome(text):
    # Normalize to lowercase
    clean = text.lower()
    # TODO: Compare clean text with its reversed version using slice syntax [::-1]
    return False # Replace with your comparison

# Test cases
test_1 = "radar"
test_2 = "python"

print(f"'{test_1}' is palindrome:", is_palindrome(test_1))
print(f"'{test_2}' is palindrome:", is_palindrome(test_2))
`,
    hints: [
      'In Python, text[::-1] reverses a string.',
      'Return True if clean == clean[::-1] else False.'
    ],
    solution: `# Reference Solution: Palindrome Checker
def is_palindrome(text):
    clean = text.lower()
    return clean == clean[::-1]

test_1 = "radar"
test_2 = "python"

print(f"'{test_1}' is palindrome:", is_palindrome(test_1))
print(f"'{test_2}' is palindrome:", is_palindrome(test_2))
`
  }
];

export const MULTI_LANG_EXERCISES = {
  python: GUIDED_EXERCISES,
  cpp: [
    {
      id: 'cpp-1',
      title: 'Vector Elements Summation',
      topic: 'Vectors & Iteration',
      difficulty: 'Beginner',
      objective: 'Iterate over a std::vector of numbers and compute their sum.',
      instructions: 'Iterate through the `numbers` vector, accumulate the sum into `total`, and print the result with std::cout.',
      starterCode: `// C++ Exercise: Vector Elements Summation
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 25, 30, 45, 50};
    int total = 0;

    // TODO: Iterate through numbers and accumulate sum into total
    for (int num : numbers) {
        total += num;
    }

    std::cout << "Total Sum: " << total << std::endl;
    return 0;
}
`,
      hints: [
        'Use range-based for loop: for (int num : numbers) { total += num; }',
        'Print using std::cout << "Total Sum: " << total << std::endl;'
      ],
      solution: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 25, 30, 45, 50};
    int total = 0;
    for (int num : numbers) total += num;
    std::cout << "Total Sum: " << total << std::endl;
    return 0;
}
`
    },
    {
      id: 'cpp-2',
      title: 'Palindrome String Checker',
      topic: 'Strings & Two Pointers',
      difficulty: 'Intermediate',
      objective: 'Check if a string is identical when read forward and backward.',
      instructions: 'Complete the isPalindrome function using two pointers or character comparison.',
      starterCode: `// C++ Exercise: Palindrome String Checker
#include <iostream>
#include <string>

bool isPalindrome(const std::string& str) {
    int left = 0;
    int right = str.length() - 1;
    // TODO: Compare characters from outside inwards
    while (left < right) {
        if (str[left] != str[right]) return false;
        left++;
        right--;
    }
    return true;
}

int main() {
    std::string test = "racecar";
    std::cout << test << " is palindrome: " << (isPalindrome(test) ? "YES" : "NO") << std::endl;
    return 0;
}
`,
      hints: [
        'Compare str[left] with str[right]',
        'Increment left and decrement right while left < right'
      ],
      solution: `#include <iostream>
#include <string>

bool isPalindrome(const std::string& str) {
    int left = 0, right = str.length() - 1;
    while (left < right) {
        if (str[left] != str[right]) return false;
        left++; right--;
    }
    return true;
}

int main() {
    std::string test = "racecar";
    std::cout << test << " is palindrome: " << (isPalindrome(test) ? "YES" : "NO") << std::endl;
    return 0;
}
`
    }
  ],
  sql: [
    {
      id: 'sql-1',
      title: 'High-Scoring Students Filter',
      topic: 'Filtering & Conditions',
      difficulty: 'Beginner',
      objective: 'Create a student marks table and query students with score >= 85.',
      instructions: 'Query all students who scored 85 or above, ordered by score descending.',
      starterCode: `-- SQL Exercise: Filter Top Students
CREATE TABLE students (
    id INTEGER PRIMARY KEY,
    name TEXT,
    subject TEXT,
    score INTEGER
);

INSERT INTO students VALUES (1, 'Alex Vance', 'Algorithms', 92);
INSERT INTO students VALUES (2, 'Maya Lin', 'Databases', 96);
INSERT INTO students VALUES (3, 'Samir Patel', 'Operating Systems', 78);
INSERT INTO students VALUES (4, 'Zoe Chen', 'Algorithms', 88);

-- TODO: Write SELECT query for students with score >= 85 ordered by score DESC
SELECT name, subject, score 
FROM students 
WHERE score >= 85 
ORDER BY score DESC;
`,
      hints: [
        'Use WHERE score >= 85 to filter records',
        'Use ORDER BY score DESC to sort highest first'
      ],
      solution: `CREATE TABLE students (
    id INTEGER PRIMARY KEY,
    name TEXT,
    subject TEXT,
    score INTEGER
);
INSERT INTO students VALUES (1, 'Alex Vance', 'Algorithms', 92);
INSERT INTO students VALUES (2, 'Maya Lin', 'Databases', 96);
INSERT INTO students VALUES (3, 'Samir Patel', 'Operating Systems', 78);
INSERT INTO students VALUES (4, 'Zoe Chen', 'Algorithms', 88);

SELECT name, subject, score FROM students WHERE score >= 85 ORDER BY score DESC;
`
    },
    {
      id: 'sql-2',
      title: 'Subject Enrollment Aggregation',
      topic: 'GROUP BY & Aggregates',
      difficulty: 'Intermediate',
      objective: 'Calculate the total count of enrolled students and average score per subject.',
      instructions: 'Use GROUP BY subject to aggregate COUNT(*) and AVG(score).',
      starterCode: `-- SQL Exercise: Subject Enrollment Aggregation
CREATE TABLE enrollments (
    student_id INTEGER,
    subject TEXT,
    score INTEGER
);

INSERT INTO enrollments VALUES (101, 'Python Programming', 88);
INSERT INTO enrollments VALUES (102, 'Python Programming', 94);
INSERT INTO enrollments VALUES (103, 'C++ Data Structures', 76);
INSERT INTO enrollments VALUES (104, 'C++ Data Structures', 84);
INSERT INTO enrollments VALUES (105, 'SQL Databases', 90);

-- TODO: Query subject, COUNT(*) as student_count, ROUND(AVG(score), 1) as avg_score
SELECT subject, COUNT(*) as student_count, ROUND(AVG(score), 1) as avg_score
FROM enrollments
GROUP BY subject
ORDER BY avg_score DESC;
`,
      hints: [
        'Use GROUP BY subject',
        'Use COUNT(*) to count students and AVG(score) for average marks'
      ],
      solution: `CREATE TABLE enrollments (
    student_id INTEGER,
    subject TEXT,
    score INTEGER
);
INSERT INTO enrollments VALUES (101, 'Python Programming', 88), (102, 'Python Programming', 94), (103, 'C++ Data Structures', 76), (104, 'C++ Data Structures', 84), (105, 'SQL Databases', 90);

SELECT subject, COUNT(*) as student_count, ROUND(AVG(score), 1) as avg_score FROM enrollments GROUP BY subject ORDER BY avg_score DESC;
`
    }
  ]
};

export const SchoolCodeLabView = () => {
  usePageTitle('Practice Code Lab');
  const { addToast } = useLMS();

  // Mode: 'guided' | 'freeform'
  const [activeMode, setActiveMode] = useState('guided');

  // Selected language runtime ('python' | 'cpp' | 'sql')
  const [language, setLanguage] = useState('python');
  const currentLangConfig = LANGUAGE_OPTIONS.find((l) => l.id === language) || LANGUAGE_OPTIONS[0];

  const currentExercises = MULTI_LANG_EXERCISES[language] || MULTI_LANG_EXERCISES.python;

  // Selected guided exercise
  const [selectedExerciseId, setSelectedExerciseId] = useState(currentExercises[0].id);
  const activeExercise = currentExercises.find((e) => e.id === selectedExerciseId) || currentExercises[0];

  // Hints & solution reveals
  const [showHints, setShowHints] = useState(false);
  const [solutionRevealed, setSolutionRevealed] = useState(false);

  // Editor code buffer initialized with starter code with TODO markers
  const [code, setCode] = useState(currentExercises[0].starterCode);

  // Execution state & output panels
  const [isRunning, setIsRunning] = useState(false);
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [executionState, setExecutionState] = useState('READY'); // READY | RUNNING | COMPLETED | FAILED | TIMEOUT
  const [executionMetrics, setExecutionMetrics] = useState(null);
  const [outputTab, setOutputTab] = useState('output'); // 'output' | 'errors' | 'telemetry'

  // When switching guided exercises
  const handleSelectExercise = (exerciseId) => {
    setSelectedExerciseId(exerciseId);
    const ex = currentExercises.find((e) => e.id === exerciseId);
    if (ex) {
      setCode(ex.starterCode);
      setShowHints(false);
      setSolutionRevealed(false);
      setStdout('');
      setStderr('');
      setExecutionState('READY');
      setExecutionMetrics(null);
    }
  };

  // When switching programming languages (Python, C++, SQL)
  const handleSelectLanguage = (langId) => {
    setLanguage(langId);
    const exercisesForLang = MULTI_LANG_EXERCISES[langId] || MULTI_LANG_EXERCISES.python;
    const firstEx = exercisesForLang[0];
    setSelectedExerciseId(firstEx.id);
    setShowHints(false);
    setSolutionRevealed(false);
    setStdout('');
    setStderr('');
    setExecutionState('READY');
    setExecutionMetrics(null);
    if (activeMode === 'freeform') {
      setCode(FREEFORM_STARTERS[langId] || FREEFORM_STARTERS.python);
    } else {
      setCode(firstEx.starterCode);
    }
    const targetConfig = LANGUAGE_OPTIONS.find((l) => l.id === langId);
    addToast('Environment Switched', `Active sandbox changed to ${targetConfig?.label || langId}.`, 'emerald');
  };

  // When switching between guided and freeform mode
  const handleSwitchMode = (mode) => {
    setActiveMode(mode);
    setShowHints(false);
    setSolutionRevealed(false);
    setStdout('');
    setStderr('');
    setExecutionState('READY');
    setExecutionMetrics(null);
    if (mode === 'freeform') {
      setCode(FREEFORM_STARTERS[language] || FREEFORM_STARTERS.python);
    } else {
      setCode(activeExercise.starterCode);
    }
  };

  // Reveal reference solution with confirmation
  const handleRevealSolution = () => {
    if (solutionRevealed) {
      setSolutionRevealed(false);
      return;
    }
    if (window.confirm('Reveal reference solution? Try solving the exercise with starter TODOs first!')) {
      setCode(activeExercise.solution);
      setSolutionRevealed(true);
      addToast('Solution Loaded', 'Reference solution loaded into editor. Inspect and run to observe expected output.', 'amber');
    }
  };

  // Execute Code safely via backend sandbox
  const handleRunCode = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecutionState('RUNNING');
    setOutputTab('output');
    setStdout('');
    setStderr('');

    const startTime = performance.now();

    try {
      const response = await apiService.executeCode(language, code);
      const durationMs = Math.round(performance.now() - startTime);

      if (!response.success) {
        const isUnavailable = response.error === 'ISOLATED_RUNNER_UNAVAILABLE' || response.status === 503;
        const isTimeout = response.code === 'TIMEOUT' || response.status === 408;
        const state = isUnavailable ? 'SERVICE UNAVAILABLE' : isTimeout ? 'TIMEOUT' : 'FAILED';

        setExecutionState(state);
        const errMsg = response.message || 'Execution failed or timed out.';
        setStderr(errMsg);
        setExecutionMetrics({
          status: state,
          exitCode: response.status || 1,
          durationMs,
          language: currentLangConfig.label
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

      setExecutionMetrics({
        status: state,
        exitCode,
        durationMs,
        language: response.data?.language || currentLangConfig.label,
        version: response.data?.version || 'Latest'
      });

      if (exitCode !== 0 && errText && !outText) {
        setOutputTab('errors');
      } else {
        setOutputTab('output');
      }

      if (exitCode === 0) {
        addToast('Execution Completed', 'Code ran cleanly with Exit Code 0.', 'emerald');
      } else {
        addToast('Execution Halted', `Program exited with code ${exitCode}. Check Errors tab.`, 'rose');
      }
    } catch (e) {
      const durationMs = Math.round(performance.now() - startTime);
      setExecutionState('FAILED');
      setStderr(e.message || 'Execution service unreachable.');
      setExecutionMetrics({
        status: 'FAILED',
        exitCode: -1,
        durationMs,
        language: currentLangConfig.label
      });
      setOutputTab('errors');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, language, code, currentLangConfig.label, addToast]);

  // Reset Editor to template
  const handleResetEditor = () => {
    if (activeMode === 'guided') {
      setCode(activeExercise.starterCode);
      setSolutionRevealed(false);
      addToast('Template Restored', `Restored starter template for "${activeExercise.title}".`, 'subtle');
    } else {
      setCode(EMPTY_STARTER_CODE);
      addToast('Editor Reset', 'Code editor restored to clean main.py state.', 'subtle');
    }
    setStdout('');
    setStderr('');
    setExecutionState('READY');
    setExecutionMetrics(null);
  };

  // Clear Output and Error panels
  const handleClearOutput = () => {
    setStdout('');
    setStderr('');
    setExecutionState('READY');
    setExecutionMetrics(null);
    addToast('Console Cleared', 'Output and error logs cleared.', 'subtle');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        width: '100%',
        maxWidth: '1360px',
        margin: '0 auto',
        paddingBottom: '5rem'
      }}
    >
      {/* ─── Top Header Banner ─── */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.6rem',
          borderRadius: '16px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563EB'
            }}
          >
            <Code2 size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Practice Code Lab
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {LANGUAGE_OPTIONS.map((langOpt) => {
                  const isLangActive = language === langOpt.id;
                  return (
                    <button
                      key={langOpt.id}
                      onClick={() => handleSelectLanguage(langOpt.id)}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.65rem',
                        borderRadius: '100px',
                        border: isLangActive ? `1px solid ${langOpt.iconColor}` : '1px solid var(--border-default)',
                        backgroundColor: isLangActive ? `${langOpt.iconColor}18` : 'var(--bg-secondary)',
                        color: isLangActive ? langOpt.iconColor : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {langOpt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Practice coding in a safe sandbox across Python, C++, and SQL. Educational runs are isolated and never modify homework submissions or graded assessments.
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs (Guided Exercises vs Freeform Practice) */}
        <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: 'var(--bg-secondary)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
          <button
            onClick={() => handleSwitchMode('guided')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeMode === 'guided' ? '#2563EB' : 'transparent',
              color: activeMode === 'guided' ? '#FFFFFF' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <BookOpen size={14} />
            <span>Guided Exercises</span>
          </button>
          <button
            onClick={() => handleSwitchMode('freeform')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeMode === 'freeform' ? '#2563EB' : 'transparent',
              color: activeMode === 'freeform' ? '#FFFFFF' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Code2 size={14} />
            <span>Freeform Practice</span>
          </button>
        </div>
      </div>

      {/* ─── Guided Exercises Browser (Active in Guided Mode) ─── */}
      {activeMode === 'guided' && (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          {/* Exercise Selection Carousel / Grid */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflowX: 'auto', paddingBottom: '0.3rem' }}>
            {currentExercises.map((ex) => {
              const isSelected = ex.id === selectedExerciseId;
              return (
                <button
                  key={ex.id}
                  onClick={() => handleSelectExercise(ex.id)}
                  style={{
                    padding: '0.6rem 0.9rem',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? '#2563EB' : 'var(--border-default)'}`,
                    backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface)',
                    color: isSelected ? '#2563EB' : 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.2rem',
                    cursor: 'pointer',
                    minWidth: '220px',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748B' }}>
                      {ex.topic}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor: ex.difficulty === 'Beginner' ? 'rgba(5, 150, 105, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                        color: ex.difficulty === 'Beginner' ? '#059669' : '#D97706'
                      }}
                    >
                      {ex.difficulty}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '210px' }}>
                    {ex.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Exercise Dossier */}
          <div
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '12px',
              border: '1px solid var(--border-default)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {activeExercise.title}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <strong>Objective:</strong> {activeExercise.objective}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="btn-secondary"
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.35rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: '#D97706',
                    borderColor: 'rgba(217, 119, 6, 0.3)'
                  }}
                >
                  <Lightbulb size={13} />
                  <span>{showHints ? 'Hide Hints' : 'View Hints'}</span>
                </button>
                <button
                  onClick={handleRevealSolution}
                  className="btn-secondary"
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.35rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: solutionRevealed ? '#059669' : 'var(--text-secondary)'
                  }}
                >
                  <Eye size={13} />
                  <span>{solutionRevealed ? 'Reset to Starter' : 'Show Solution'}</span>
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <strong>Instructions:</strong> {activeExercise.instructions}
            </div>

            {/* Expandable Hints */}
            {showHints && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(217, 119, 6, 0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#D97706', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <HelpCircle size={14} />
                  <span>Guided Hints:</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {activeExercise.hints.map((hint, idx) => (
                    <li key={idx} style={{ marginBottom: '0.25rem' }}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Code Editor & Execution Panel ─── */}
      <div
        style={{
          borderRadius: '16px',
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Editor Top Bar Controls */}
        <div
          style={{
            padding: '0.6rem 1.15rem',
            backgroundColor: '#1E293B',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}
        >
          {/* Active File Tab */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                color: '#38BDF8',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600
              }}
            >
              <FileCode size={15} />
              <span>{currentLangConfig.ext}</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
              {activeMode === 'guided' ? `Exercise: ${activeExercise.title}` : `Freeform ${currentLangConfig.label} Sandbox`}
            </span>
          </div>

          {/* Action Buttons: Run Code, Reset Editor, Clear Output */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleResetEditor}
              className="btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '0.4rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#334155',
                color: '#F1F5F9',
                borderColor: '#475569'
              }}
              title="Reset editor code"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>

            <button
              onClick={handleClearOutput}
              className="btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '0.4rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#334155',
                color: '#F1F5F9',
                borderColor: '#475569'
              }}
              title="Clear console output and error logs"
            >
              <Trash2 size={13} />
              <span>Clear Output</span>
            </button>

            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className="btn-primary"
              style={{
                padding: '0.42rem 1.25rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: isRunning ? '#047857' : '#059669',
                borderColor: '#059669',
                boxShadow: '0 2px 10px rgba(5, 150, 105, 0.35)',
                cursor: isRunning ? 'wait' : 'pointer'
              }}
            >
              <Play size={14} fill="currentColor" />
              <span>{isRunning ? 'Running Script...' : 'Run Practice Code'}</span>
            </button>
          </div>
        </div>

        {/* Monaco Code Editor */}
        <div style={{ height: '380px', minHeight: '300px', position: 'relative' }}>
          <Editor
            height="100%"
            language={currentLangConfig.monaco}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'var(--font-mono)',
              lineNumbers: 'on',
              tabSize: 4,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 }
            }}
          />
        </div>

        {/* Practice Boundary & Security Notice */}
        <div
          style={{
            padding: '0.5rem 1.15rem',
            backgroundColor: '#111827',
            borderTop: '1px solid #1F2937',
            borderBottom: '1px solid #1F2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#94A3B8'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <ShieldCheck size={15} color="#38BDF8" />
            <span>
              <strong>Safe Practice Sandbox:</strong> Code executes within secure container limits. Runs never create homework submissions, tests, grades, or academic records.
            </span>
          </div>
          {executionMetrics && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem' }}>
              <span
                style={{
                  color: executionMetrics.exitCode === 0 ? '#34D399' : '#F87171',
                  fontWeight: 700
                }}
              >
                Exit {executionMetrics.exitCode} ({executionMetrics.durationMs}ms)
              </span>
            </div>
          )}
        </div>

        {/* ─── Output & Errors Panel ─── */}
        <div style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', backgroundColor: '#090D16' }}>
          {/* Panel Header with Tabs & Status */}
          <div
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: '#0F172A',
              borderBottom: '1px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => setOutputTab('output')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: outputTab === 'output' ? 700 : 500,
                  backgroundColor: outputTab === 'output' ? '#1E293B' : 'transparent',
                  color: outputTab === 'output' ? '#38BDF8' : '#94A3B8',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                OUTPUT
              </button>
              <button
                onClick={() => setOutputTab('errors')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: outputTab === 'errors' ? 700 : 500,
                  backgroundColor: outputTab === 'errors' ? '#1E293B' : 'transparent',
                  color: outputTab === 'errors' ? '#F87171' : '#94A3B8',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <span>ERRORS</span>
                {stderr && (
                  <span
                    style={{
                      fontSize: '0.62rem',
                      padding: '0.05rem 0.35rem',
                      borderRadius: '100px',
                      backgroundColor: 'rgba(239, 68, 68, 0.25)',
                      color: '#F87171'
                    }}
                  >
                    !
                  </span>
                )}
              </button>
              <button
                onClick={() => setOutputTab('telemetry')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: outputTab === 'telemetry' ? 700 : 500,
                  backgroundColor: outputTab === 'telemetry' ? '#1E293B' : 'transparent',
                  color: outputTab === 'telemetry' ? '#FBBF24' : '#94A3B8',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                TELEMETRY
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '100px',
                  backgroundColor:
                    executionState === 'COMPLETED'
                      ? 'rgba(5, 150, 105, 0.15)'
                      : executionState === 'RUNNING'
                      ? 'rgba(37, 99, 235, 0.15)'
                      : executionState === 'FAILED'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(148, 163, 184, 0.15)',
                  color:
                    executionState === 'COMPLETED'
                      ? '#34D399'
                      : executionState === 'RUNNING'
                      ? '#38BDF8'
                      : executionState === 'FAILED'
                      ? '#F87171'
                      : '#94A3B8'
                }}
              >
                {executionState}
              </span>
            </div>
          </div>

          {/* Panel Body */}
          <div
            style={{
              flex: 1,
              padding: '1rem 1.25rem',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              lineHeight: 1.6,
              maxHeight: '260px'
            }}
          >
            {/* Output Tab View */}
            {outputTab === 'output' && (
              <div>
                {isRunning ? (
                  <div style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="animate-spin">⏳</span>
                    <span>Running Python script in sandbox...</span>
                  </div>
                ) : stdout ? (
                  <pre style={{ margin: 0, color: '#E2E8F0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {stdout}
                  </pre>
                ) : (
                  <div style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Terminal size={15} />
                    <span>$ Ready. Click &apos;Run Practice Code&apos; to execute your Python script. Output will be displayed here.</span>
                  </div>
                )}
              </div>
            )}

            {/* Errors Tab View */}
            {outputTab === 'errors' && (
              <div>
                {stderr ? (
                  <pre style={{ margin: 0, color: '#F87171', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {stderr}
                  </pre>
                ) : (
                  <div style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={15} color="#059669" />
                    <span>No runtime errors or exception tracebacks recorded.</span>
                  </div>
                )}
              </div>
            )}

            {/* Telemetry Tab View */}
            {outputTab === 'telemetry' && (
              <div>
                {executionMetrics ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '0.75rem',
                      color: '#94A3B8'
                    }}
                  >
                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#0F172A', borderRadius: '6px', border: '1px solid #1E293B' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Runner Status</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9' }}>{executionMetrics.status}</div>
                    </div>
                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#0F172A', borderRadius: '6px', border: '1px solid #1E293B' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Exit Code</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: executionMetrics.exitCode === 0 ? '#34D399' : '#F87171' }}>
                        {executionMetrics.exitCode}
                      </div>
                    </div>
                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#0F172A', borderRadius: '6px', border: '1px solid #1E293B' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Duration</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9' }}>{executionMetrics.durationMs} ms</div>
                    </div>
                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#0F172A', borderRadius: '6px', border: '1px solid #1E293B' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Runtime</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9' }}>
                        {executionMetrics.language} {executionMetrics.version || '3.10'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={15} />
                    <span>Run code to record runtime performance, memory boundaries, and execution duration.</span>
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
