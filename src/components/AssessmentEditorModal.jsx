import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLMS } from '../context/LMSContext';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { PROGRAMMING_LANGUAGES } from '../data/mockData';
import {
  Play,
  RotateCcw,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  X,
  Lightbulb,
  Shield,
  ShieldAlert,
  Maximize2,
  Lock,
  Clock,
  AlertTriangle,
  EyeOff,
  CameraOff
} from 'lucide-react';
import Editor from '@monaco-editor/react';

export const AssessmentEditorModal = ({ challenge, onClose }) => {
  const { triggerConfetti, addToast, user, setUser, setCodingChallenges } = useLMS();

  // Language state
  const [selectedLangId, setSelectedLangId] = useState('python');
  const currentLanguage =
    PROGRAMMING_LANGUAGES.find((lang) => lang.id === selectedLangId) || PROGRAMMING_LANGUAGES[0];

  // Editor Code State
  const starterCode =
    challenge.codeSnippets?.[selectedLangId] ||
    challenge.codeSnippets?.python ||
    `# ${challenge.title}\n`;

  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isPassed, setIsPassed] = useState(challenge?.solved || false);
  const [copied, setCopied] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // ─── Security & Proctoring States ──────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusLost, setIsFocusLost] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationReason, setViolationReason] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);

  // Authoritative Server Timer State
  const defaultDuration = Number(challenge?.durationMinutes || challenge?.duration || 45);
  const [timeLeft, setTimeLeft] = useState(defaultDuration * 60);
  const [serverExpiresAt, setServerExpiresAt] = useState(null);
  const [isTimeExpired, setIsTimeExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef(null);
  const autoSubmittedRef = useRef(false);
  const terminationTriggeredRef = useRef(false);
  const handleFinalSubmitRef = useRef(null);

  // Safe Exit Fullscreen
  const safeExitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Request Fullscreen on Demand
  const enterFullscreen = useCallback(async () => {
    if (isTerminated || terminationTriggeredRef.current) return;
    try {
      if (!document.fullscreenElement && modalRef.current) {
        if (modalRef.current.requestFullscreen) {
          await modalRef.current.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      }
      setIsFullscreen(true);
      setShowViolationModal(false);
    } catch (err) {
      console.warn('Fullscreen request bypassed or blocked:', err.message);
    }
  }, [isTerminated]);

  // ─── Automatically Trigger Fullscreen on Mount ──────────────────────────────
  useEffect(() => {
    enterFullscreen();

    // Prevent body scrolling
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      safeExitFullscreen();
      document.body.style.overflow = origOverflow;
    };
  }, [enterFullscreen, safeExitFullscreen]);

  // ─── Authoritative Assessment Timer Initialization ──────────────────────────
  useEffect(() => {
    let isMounted = true;
    const initAuthoritativeTimer = async () => {
      if (!challenge?.id) return;
      try {
        const res = await apiService.startAssessment(challenge.id, defaultDuration);
        if (isMounted && res?.success && res.data) {
          const { remainingSeconds, expiresAt, isExpired } = res.data;
          setServerExpiresAt(expiresAt);
          setTimeLeft(remainingSeconds);
          if (isExpired || remainingSeconds <= 0) {
            setIsTimeExpired(true);
            addToast('Time Expired', 'Authoritative assessment timer has ended.', 'amber');
          }
        }
      } catch (err) {
        console.warn('Could not sync assessment timer with server:', err);
      }
    };
    initAuthoritativeTimer();
    return () => { isMounted = false; };
  }, [challenge?.id, defaultDuration, addToast]);

  // Authoritative countdown derived from expiresAt timestamp
  useEffect(() => {
    if (!serverExpiresAt) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsTimeExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.round((serverExpiresAt - now) / 1000));
      setTimeLeft(diffSeconds);
      if (diffSeconds <= 0) {
        clearInterval(timer);
        setIsTimeExpired(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [serverExpiresAt]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Real Browser Assessment Event Telemetry Handler ───────────────────────
  // Server is the SOLE authority for violationCount, termination, and auto-submission
  const recordAssessmentEvent = useCallback((eventType, reason, severity = 'low', metadata = {}) => {
    if (terminationTriggeredRef.current) return;

    if (challenge?.id) {
      apiService.recordAssessmentEvent(challenge.id, {
        eventType,
        assessmentTitle: challenge.title,
        severity,
        metadata: { reason, ...metadata }
      }).then((res) => {
        if (!res) return;

        // Synchronize state strictly from server response
        const serverViolations = typeof res.violationCount === 'number' ? res.violationCount : 0;
        setViolationCount(serverViolations);

        if (res.isTerminated || res.status === 'terminated_violations' || serverViolations >= 3) {
          terminationTriggeredRef.current = true;
          setIsTerminated(true);
          setShowViolationModal(true);
          setViolationReason('Maximum allowed warnings exceeded (3/3 strikes). Exam terminated by server authority.');

          addToast(
            'Exam Terminated (3 Strikes)',
            'Maximum allowed warnings exceeded. Assessment was automatically terminated by server.',
            'red'
          );

          // Animate and close modal cleanly after 3.5 seconds
          setTimeout(() => {
            safeExitFullscreen();
            onClose();
          }, 3500);
          return;
        }

        // Distinct strike verified by server deduplication window
        if (res.isStrike) {
          addToast(
            'Assessment Warning',
            `Warning ${serverViolations}/3: ${reason}. At 3 warnings, the test will automatically terminate!`,
            'amber'
          );
          setViolationReason(reason);
          setShowViolationModal(true);
        }
      }).catch((err) => {
        if (err?.response?.status === 403 || err?.response?.data?.isTerminated) {
          terminationTriggeredRef.current = true;
          setIsTerminated(true);
          setShowViolationModal(true);
          setViolationReason('Assessment already terminated by server authority.');
          setTimeout(() => {
            safeExitFullscreen();
            onClose();
          }, 3500);
        }
      });
    }
  }, [challenge?.id, challenge?.title, addToast, safeExitFullscreen, onClose]);

  // ─── Cross-Node Socket.IO Real-Time Termination Notice Listener ─────────────
  useEffect(() => {
    const handleServerTermination = (alertData) => {
      if (alertData && (alertData.isTerminated || alertData.eventType === 'MAX_WARNINGS_EXCEEDED' || alertData.eventType === 'ASSESSMENT_FORCE_TERMINATED')) {
        terminationTriggeredRef.current = true;
        setIsTerminated(true);
        setViolationCount(3);
        setShowViolationModal(true);
        setViolationReason('Assessment terminated by server authority (3 Strikes).');
        addToast(
          'Assessment Terminated',
          'Exam terminated by server proctoring authority.',
          'red'
        );
        setTimeout(() => {
          safeExitFullscreen();
          onClose();
        }, 3500);
      }
    };

    socketService.on('assessment:terminated', handleServerTermination);
    return () => {
      socketService.off('assessment:terminated', handleServerTermination);
    };
  }, [safeExitFullscreen, onClose, addToast]);

  // ─── Browser Environment Event Listeners (Fullscreen, Visibility, Focus) ────
  useEffect(() => {
    // 1. Fullscreen Change Detection
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        recordAssessmentEvent('FULLSCREEN_EXIT', 'Assessment window exited fullscreen view.', 'medium');
      } else {
        recordAssessmentEvent('FULLSCREEN_ENTERED', 'Assessment window entered fullscreen view.', 'info');
      }
    };

    // 2. Tab Switch / App Minimization Detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsFocusLost(true);
        recordAssessmentEvent('TAB_OR_WINDOW_HIDDEN', 'Assessment tab or browser window was minimized/hidden.', 'medium');
      } else {
        setIsFocusLost(false);
        recordAssessmentEvent('TAB_RETURNED', 'Student returned to assessment tab.', 'info');
      }
    };

    // 3. Window Blur Detection
    const handleWindowBlur = () => {
      setIsFocusLost(true);
      recordAssessmentEvent('WINDOW_BLUR', 'Assessment window lost active focus.', 'low');
    };

    const handleWindowFocus = () => {
      setIsFocusLost(false);
      recordAssessmentEvent('WINDOW_FOCUS', 'Assessment window regained active focus.', 'info');
    };

    // 4. Keyboard Shortcuts & Detectable Browser Actions
    const handleKeyDown = (e) => {
      // Print Dialog (Ctrl+P / Cmd+P)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
        recordAssessmentEvent('PRINT_ATTEMPT', 'Print dialog shortcut triggered.', 'medium');
        addToast('Notice', 'Printing is disabled during the assessment.', 'amber');
        return;
      }

      // Save Dialog (Ctrl+S / Cmd+S)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'S' || e.key === 's') && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        recordAssessmentEvent('SAVE_ATTEMPT', 'Save webpage shortcut triggered.', 'low');
        return;
      }

      // DevTools & Inspect (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
      // Best-effort browser interception: only handles events delivered to the DOM.
      // Keystrokes intercepted by OS/OEM/firmware are outside standard web API scope.
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u'))
      ) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (_) {}
        recordAssessmentEvent('DEVTOOLS_SHORTCUT', 'Developer inspection shortcut detected.', 'medium');
        return;
      }

      // Reload attempts (F5, Ctrl+R)
      if (
        e.key === 'F5' ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'R' || e.key === 'r'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        addToast('Notice', 'Assessment is live. Please use the editor controls rather than refreshing.', 'amber');
      }
    };

    // 5. Prevent Unload / Navigation Warning
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Assessment in progress. Leaving will close your test session.';
      return e.returnValue;
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [recordAssessmentEvent, addToast]);

  // Handle Language Change
  const handleLanguageChange = (langId) => {
    setSelectedLangId(langId);
    const newLang = PROGRAMMING_LANGUAGES.find((lang) => lang.id === langId) || PROGRAMMING_LANGUAGES[0];
    const snippet =
      challenge.codeSnippets?.[langId] ||
      `// ${challenge.title}\n// Implementation in ${newLang.name}\n`;
    setCode(snippet);
    setOutput('');
    setIsPassed(false);
    addToast('Language Switched', `Runtime switched to ${newLang.name}`, 'emerald');
  };

  // Reset Code
  const handleReset = () => {
    setCode(starterCode);
    setOutput('');
    setIsPassed(false);
  };

  // Copy Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Code Copied', 'Copied to clipboard', 'emerald');
  };

  // Run Code
  const handleRunCode = async () => {
    if (isTerminated || terminationTriggeredRef.current) {
      setOutput('[Disqualified / Terminated]\nThis assessment session has been terminated by proctoring authority. Code execution is disabled.');
      return;
    }
    setIsRunning(true);
    setOutput(`[Compiling & Executing in ${currentLanguage.name} Runtime Container...]\n`);

    const { apiService } = await import('../services/apiService');
    const functionName = challenge.functionNames?.[selectedLangId] || 
                         challenge.functionNames?.python || 'main';
    const testCases = challenge.testCases || [];
    
    if (testCases.length === 0) {
      setOutput(`[Execution Complete]\nNo automated test cases defined for this challenge.\nCode compiled successfully.`);
      setIsRunning(false);
      return;
    }

    try {
      const response = await apiService.executeCodeTest(selectedLangId, code, functionName, testCases);
      if (!response.success) {
        setOutput(`[Execution Error]\n${response.message || 'Unknown error occurred.'}`);
        setIsRunning(false);
        return;
      }
      
      let outText = `[Proctored Test Suite Runner - ${challenge.title}]\n`;
      outText += `$ running test suite against sandboxed container...\n\n`;
      
      if (response.rawOutput && (!response.results || !response.results.some(r => r.passed))) {
         outText += `--- Raw Output ---\n${response.rawOutput}\n------------------\n\n`;
      }

      let allPassed = true;
      if (response.results && response.results.length > 0) {
          response.results.forEach((res, idx) => {
            const tc = testCases[idx];
            if (!tc) return;
            const argsStr = JSON.stringify(tc.args).slice(1, -1);
            outText += `>> Test Case ${idx + 1}: ${functionName}(${argsStr})\n`;
            outText += `   Expected: ${res.expectedOutput || JSON.stringify(tc.expectedOutput)}`;
            
            if (res.passed) {
              outText += ` | Output: ${res.actualOutput} (PASS ✓)\n`;
            } else {
              outText += ` | Output: ${res.actualOutput || (res.error ? 'ERROR: ' + res.error : 'None')} (FAIL ❌)\n`;
              allPassed = false;
            }
          });
      } else {
          allPassed = false;
          outText += `Failed to parse test results.\n`;
      }
      
      if (allPassed) {
        outText += `\n🎉 ALL TEST CASES PASSED! Solution verified under strict proctoring!`;
      } else {
        outText += `\n⚠️ SOME TEST CASES FAILED. Debug your logic and re-run.`;
      }
      
      setOutput(outText);
      setIsRunning(false);
      
      if (allPassed) {
        setIsPassed(true);
        if (user) {
          setUser((prev) => ({
            ...prev,
            xp: (prev.xp || 3450) + (challenge.xpReward || 100)
          }));
        }
        if (setCodingChallenges) {
          setCodingChallenges((prev) => 
            prev.map(c => 
              (c.id === challenge.id && c.day === challenge.day) ? { ...c, solved: true } : c
            )
          );
        }
        triggerConfetti();
        addToast(
          `${challenge.title} Passed! 🚀`,
          `+${challenge.xpReward || 100} XP • Assessment completed successfully!`,
          'emerald'
        );
      }
    } catch (e) {
      console.error(e);
      setOutput(`[Execution Error]\nFailed to connect to execution server.`);
      setIsRunning(false);
    }
  };

  // Handle auto-submission once when authoritative time expires
  useEffect(() => {
    if (isTimeExpired && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleFinalSubmit(true);
    }
  }, [isTimeExpired]);

  // Submit and Close Exam cleanly with authoritative backend validation
  const handleFinalSubmit = async (isAuto = false, submitReason = 'NORMAL') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const isViolationsTermination = submitReason === 'TERMINATED_MAX_WARNINGS' || isTerminated || violationCount >= 3;
    try {
      if (challenge?.id) {
        await apiService.submitAssessment(challenge.id, {
          code,
          violationCount,
          isTerminated: isViolationsTermination,
          submissionReason: submitReason,
          answers: [{ code, language: selectedLangId }]
        });
      }
      safeExitFullscreen();
      if (isViolationsTermination) {
        addToast(
          'Assessment Terminated',
          'Maximum allowed warnings (3) exceeded. Your test has been submitted and closed.',
          'red'
        );
      } else {
        addToast(
          isAuto ? 'Auto-Submitted (Time Expired)' : 'Exam Submitted',
          isAuto
            ? 'Authoritative server timer ended. Solution was automatically submitted.'
            : 'Your solutions and proctoring log have been submitted.',
          'emerald'
        );
      }
      onClose();
    } catch (err) {
      console.error('Submission error:', err);
      safeExitFullscreen();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };
  handleFinalSubmitRef.current = handleFinalSubmit;

  if (!challenge) return null;

  const studentIdentifier = `${user?.name || 'Student'} • ID: ${user?.studentId || 'SCH-2026-001'}`;

  return (
    <div
      ref={modalRef}
      onContextMenu={(e) => e.preventDefault()}
      className="assessment-environment-modal"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        backgroundColor: '#0A0F1D',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {/* ─── CSS Anti-Print and Security Rules ─────────────────────────── */}
      <style>{`
        @media print {
          body, .assessment-environment-modal, * {
            display: none !important;
            visibility: hidden !important;
          }
        }
        .proctor-watermark-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 50;
          opacity: 0.045;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(4, 1fr);
          overflow: hidden;
          font-family: monospace;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          transform: rotate(-15deg) scale(1.15);
        }
      `}</style>

      {/* ─── Subtle Dynamic Identity Watermark ─────────────────────── */}
      <div className="proctor-watermark-grid" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem' }}>
            <span>ASSESSMENT ENVIRONMENT • {studentIdentifier} • CONFIDENTIAL</span>
          </div>
        ))}
      </div>

      {/* ─── Focus Lost Obscuration Privacy Shield ────────────────────────── */}
      {isFocusLost && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 9999999,
            backdropFilter: 'blur(50px)',
            backgroundColor: 'rgba(2, 6, 23, 0.96)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '2rem'
          }}
        >
          <div
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              backgroundColor: 'rgba(220, 38, 38, 0.15)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.35)'
            }}
          >
            <EyeOff size={36} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#F8FAFC' }}>
            Assessment Focus Lost
          </h2>
          <p style={{ color: '#94A3B8', maxWidth: '520px', lineHeight: 1.6, fontSize: '0.95rem', margin: '0 0 1.5rem' }}>
            The assessment environment requires your active window focus. 
            Navigating to other applications or tabs is logged in your session event report.
          </p>
          <button
            onClick={() => {
              window.focus();
              setIsFocusLost(false);
            }}
            className="btn-primary"
            style={{ padding: '0.75rem 2rem', fontSize: '0.92rem', borderRadius: '10px' }}
          >
            Resume Assessment Window
          </button>
        </div>
      )}

      {/* ─── Fullscreen Exit Notice & 3-Warning Disqualification Overlay ───────── */}
      {(!isFullscreen || showViolationModal || isTerminated || violationCount >= 3) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 9999998,
            backgroundColor: isTerminated || violationCount >= 3 ? 'rgba(15, 23, 42, 0.99)' : 'rgba(10, 15, 30, 0.98)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '2rem'
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: isTerminated || violationCount >= 3 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
              color: isTerminated || violationCount >= 3 ? '#EF4444' : '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              boxShadow: isTerminated || violationCount >= 3 ? '0 0 45px rgba(239, 68, 68, 0.45)' : '0 0 40px rgba(245, 158, 11, 0.3)'
            }}
          >
            <ShieldAlert size={44} />
          </div>

          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0.25rem 0.85rem',
              borderRadius: '20px',
              backgroundColor: isTerminated || violationCount >= 3 ? 'rgba(239, 68, 68, 0.25)' : violationCount >= 2 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: isTerminated || violationCount >= 3 ? '#EF4444' : violationCount >= 2 ? '#EF4444' : '#F59E0B',
              marginBottom: '0.75rem'
            }}
          >
            {isTerminated || violationCount >= 3
              ? 'Test Auto-Terminated (3 Strikes Disqualification)'
              : `Environment Warning (${violationCount}/3 logged)`}
          </span>

          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#F8FAFC' }}>
            {isTerminated || violationCount >= 3
              ? 'Maximum Allowed Warnings Exceeded'
              : 'Assessment Window Exited'}
          </h2>

          <p style={{ color: '#CBD5E1', maxWidth: '580px', lineHeight: 1.6, fontSize: '0.94rem', margin: '0 0 1.5rem' }}>
            {isTerminated || violationCount >= 3
              ? 'You have crossed the limit of 3 environment warnings (fullscreen exits or window tab switches). Per examination integrity guidelines, you cannot continue this test. Your exam has been automatically closed and submitted, and an incident notice has been sent to your trainer.'
              : violationReason || 'You have exited the fullscreen assessment environment. Please stay in the assessment window during your test to ensure exam integrity. Crossing 3 warnings will disqualify you and auto-submit the exam.'}
          </p>

          {isTerminated || violationCount >= 3 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => handleFinalSubmit(true, 'TERMINATED_MAX_WARNINGS')}
                className="btn-primary"
                style={{
                  padding: '0.85rem 2.25rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  backgroundColor: '#DC2626',
                  borderColor: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(220, 38, 38, 0.5)'
                }}
              >
                <span>Exit Assessment Now</span>
              </button>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Submitting your test and closing session automatically...
              </span>
            </div>
          ) : (
            <button
              onClick={enterFullscreen}
              className="btn-primary"
              style={{
                padding: '0.85rem 2.25rem',
                fontSize: '1rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(37, 99, 235, 0.5)'
              }}
            >
              <Maximize2 size={18} />
              <span>Return to Assessment Window</span>
            </button>
          )}
        </div>
      )}

      {/* ─── Top Assessment Status HUD Header ─────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #1E293B',
          zIndex: 100
        }}
      >
        {/* Left: Security Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#38BDF8'
            }}
          >
            <Shield size={14} color="#38BDF8" />
            <span>ASSESSMENT ENVIRONMENT</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '0.3rem 0.65rem',
              borderRadius: '6px',
              backgroundColor: isFullscreen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
              color: isFullscreen ? '#34D399' : '#EF4444',
              fontSize: '0.74rem',
              fontWeight: 700,
              border: isFullscreen ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <Lock size={12} />
            <span>{isFullscreen ? 'Fullscreen Active' : 'Window Exited'}</span>
          </div>
        </div>

        {/* Center: Test Title & Live Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
              {challenge.title}
            </h2>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              {challenge.category || 'Computer Science Assessment'} • {challenge.difficulty || 'Medium'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.4rem 0.9rem',
              borderRadius: '8px',
              backgroundColor: isTimeExpired
                ? 'rgba(239, 68, 68, 0.3)'
                : timeLeft < 300
                ? 'rgba(239, 68, 68, 0.2)'
                : '#1E293B',
              border: isTimeExpired || timeLeft < 300 ? '1px solid #EF4444' : '1px solid #334155',
              color: isTimeExpired || timeLeft < 300 ? '#F87171' : '#F8FAFC',
              fontWeight: 800,
              fontSize: '0.88rem',
              fontFamily: 'var(--font-mono)'
            }}
          >
            <Clock size={15} color={isTimeExpired || timeLeft < 300 ? '#F87171' : '#38BDF8'} />
            <span>{isTimeExpired ? 'TIME EXPIRED' : formatTimer(timeLeft)}</span>
          </div>
        </div>

        {/* Right: Strikes Monitor & Submit Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: violationCount === 0 ? '#94A3B8' : violationCount === 1 ? '#F59E0B' : '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <AlertTriangle size={13} />
            <span>Strikes: {violationCount} / 3</span>
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="btn-primary"
            style={{
              padding: '0.45rem 1.15rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: '8px',
              backgroundColor: '#059669',
              borderColor: '#059669'
            }}
          >
            Finish & Submit Exam
          </button>
        </div>
      </header>

      {/* ─── Kiosk Workspace Toolbar ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.55rem 1.5rem',
          backgroundColor: '#0B1120',
          borderBottom: '1px solid #1E293B'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#FEF3C7',
              color: '#D97706'
            }}
          >
            {challenge.difficulty || 'Medium'}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#CBD5E1', lineHeight: 1.4 }}>
            {challenge.description}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {challenge.hint && (
            <button
              onClick={() => setShowHint(!showHint)}
              style={{
                background: 'none',
                border: 'none',
                color: showHint ? '#F59E0B' : '#94A3B8',
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <Lightbulb size={14} color={showHint ? '#F59E0B' : '#94A3B8'} />
              <span>{showHint ? 'Hide Hint' : 'Hint'}</span>
            </button>
          )}

          {/* Language Selector */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedLangId}
              onChange={(e) => handleLanguageChange(e.target.value)}
              style={{
                padding: '0.35rem 2rem 0.35rem 0.75rem',
                borderRadius: '6px',
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                color: '#F8FAFC',
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
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94A3B8' }}
            />
          </div>

          <button
            onClick={handleReset}
            className="btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem', gap: '4px', backgroundColor: '#1E293B', borderColor: '#334155', color: '#CBD5E1' }}
            title="Reset code template"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          <button
            onClick={handleRunCode}
            disabled={isRunning || isTimeExpired}
            className="btn-primary"
            style={{ padding: '0.4rem 1.25rem', fontSize: '0.82rem', gap: '6px', fontWeight: 800 }}
          >
            <Play size={13} fill="currentColor" />
            <span>{isTimeExpired ? 'Assessment Expired' : isRunning ? 'Executing Tests...' : 'Run Test Cases'}</span>
          </button>
        </div>
      </div>

      {/* Optional Hint Box */}
      {showHint && challenge.hint && (
        <div
          style={{
            margin: '0.5rem 1.5rem 0',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            padding: '0.5rem 0.85rem',
            fontSize: '0.8rem',
            color: '#FBBF24',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Lightbulb size={14} />
          <span><strong>Hint:</strong> {challenge.hint}</span>
        </div>
      )}

      {/* ─── Split Screen: Monaco Editor on Left, Test Terminal on Right ──── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: '1rem',
          flex: 1,
          minHeight: 0,
          padding: '0.85rem 1.5rem 1.25rem'
        }}
      >
        {/* LEFT: MONACO CODE EDITOR */}
        <div
          style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
          }}
        >
          <div
            style={{
              padding: '0.45rem 1rem',
              borderBottom: '1px solid #1E293B',
              backgroundColor: '#1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              <span style={{ fontSize: '0.76rem', color: '#93C5FD', fontWeight: 700, fontFamily: 'var(--font-mono)', marginLeft: '6px' }}>
                {currentLanguage.fileName || 'solution'} • Active Proctoring
              </span>
            </div>
            <button onClick={handleCopyCode} className="btn-icon" style={{ color: '#94A3B8' }} title="Copy Code">
              {copied ? <Check size={12} color="#34D399" /> : <Copy size={12} />}
            </button>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <Editor
              height="100%"
              language={selectedLangId === 'c' || selectedLangId === 'cpp' ? 'cpp' : selectedLangId}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                tabSize: 4,
                readOnly: isTimeExpired
              }}
            />
          </div>
        </div>

        {/* RIGHT: PROCTORED TEST OUTPUT TERMINAL */}
        <div
          style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
          }}
        >
          <div
            style={{
              padding: '0.45rem 1rem',
              borderBottom: '1px solid #1E293B',
              backgroundColor: '#1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} color="#38BDF8" />
              <span style={{ fontSize: '0.76rem', color: '#F8FAFC', fontWeight: 700 }}>Automated Verification Output</span>
            </div>
            {isPassed && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#064E3B',
                  color: '#34D399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Check size={12} strokeWidth={3} />
                <span>ALL TESTS PASSED</span>
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              padding: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              lineHeight: 1.6,
              color: isPassed ? '#34D399' : '#CBD5E1',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              backgroundColor: '#050B17'
            }}
          >
            {output || (
              <div style={{ color: '#64748B', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <div>$ ready for test execution.</div>
                <div>$ click [Run Test Cases] to compile and validate in an isolated sandbox.</div>
                <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                  Anti-cheat validation will verify execution output against hidden test assertions.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Submit Confirmation Modal Dialog ────────────────────────────── */}
      {showSubmitConfirm && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 99999999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: '16px',
              padding: '2rem',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#F8FAFC' }}>
              Confirm Assessment Submission
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
              Are you sure you want to finish and submit your exam? 
              {isPassed 
                ? ' All automated test cases have passed! Your score and XP will be recorded.' 
                : ' Some test cases may not have passed yet. Unsubmitted questions will be graded as-is.'}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem' }}
              >
                Return to Editor
              </button>
              <button
                onClick={handleFinalSubmit}
                className="btn-primary"
                style={{ padding: '0.6rem 1.5rem', fontSize: '0.88rem', fontWeight: 800, backgroundColor: '#059669', borderColor: '#059669' }}
              >
                Confirm Submission & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
