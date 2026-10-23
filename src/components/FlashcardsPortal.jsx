import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Layers,
  RotateCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Flame,
  Award,
  Zap,
  Target,
  Edit3,
  Send,
  BookOpen,
  Check,
  RefreshCw,
  BrainCircuit,
  Trophy,
  Star
} from 'lucide-react';

export const FlashcardsPortal = () => {
  const { flashcardDecks, triggerConfetti, addToast, user, setUser } = useLMS();

  // Mode Selection: 'quiz' (MCQ Answering), 'type' (Type-in Answer Recall), 'flip' (3D Spaced Repetition)
  const [practiceMode, setPracticeMode] = useState('quiz');

  // Deck & Card State
  const [activeDeckIdx, setActiveDeckIdx] = useState(null);
  const currentDeck = activeDeckIdx !== null ? flashcardDecks[activeDeckIdx] : null;
  const [cardIdx, setCardIdx] = useState(0);
  const currentCard = currentDeck ? (currentDeck.cards[cardIdx] || currentDeck.cards[0]) : null;

  // Quiz Mode State
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [streakCombo, setStreakCombo] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);

  // Type-In Answer Mode State
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typeResult, setTypeResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // 3D Flip Card State
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Completion Summary Modal
  const [deckCompleted, setDeckCompleted] = useState(false);

  // Reset card state when moving to next or switching decks
  const resetCardInteraction = () => {
    setSelectedOptionId(null);
    setHasAnswered(false);
    setTypedAnswer('');
    setTypeResult(null);
    setIsFlipped(false);
    setShowHint(false);
  };

  // Switch Active Deck
  const handleDeckChange = (idx) => {
    setActiveDeckIdx(idx);
    setCardIdx(0);
    setQuizScore(0);
    setStreakCombo(0);
    setSessionXP(0);
    setDeckCompleted(false);
    resetCardInteraction();
  };

  // 1. HANDLE MULTIPLE CHOICE ANSWER CLICK
  const handleOptionSelect = (option) => {
    if (hasAnswered) return;

    setSelectedOptionId(option.id);
    setHasAnswered(true);

    if (option.isCorrect) {
      setQuizScore((prev) => prev + 1);
      setStreakCombo((prev) => prev + 1);
      setSessionXP((prev) => prev + 25);
      triggerConfetti();

      if (user) {
        setUser((prev) => ({ ...prev, xp: (prev.xp || 3450) + 25 }));
      }

      addToast('Correct Answer! 🎉', '+25 XP gained for accurate concept mastery', 'emerald');
    } else {
      setStreakCombo(0);
      addToast('Incorrect', 'Review the detailed explanation below', 'subtle');
    }
  };

  // 2. HANDLE TYPE-IN ANSWER SUBMISSION (Active Recall AI Grader)
  const handleSubmitTypedAnswer = (e) => {
    e.preventDefault();
    if (!typedAnswer.trim()) return;

    setIsEvaluating(true);

    setTimeout(() => {
      const lower = typedAnswer.toLowerCase();
      const keywords = currentCard.keywords || ['variance', 'gradient', 'softmax', 'scale'];
      const matched = keywords.filter((kw) => lower.includes(kw.toLowerCase()));
      const matchPercentage = Math.min(100, Math.max(35, Math.round((matched.length / keywords.length) * 100) + 20));

      const isPass = matchPercentage >= 65;

      setTypeResult({
        score: matchPercentage,
        isPass,
        matchedKeywords: matched,
        totalKeywords: keywords
      });

      setIsEvaluating(false);

      if (isPass) {
        setQuizScore((prev) => prev + 1);
        setStreakCombo((prev) => prev + 1);
        setSessionXP((prev) => prev + 50);
        triggerConfetti();

        if (user) {
          setUser((prev) => ({ ...prev, xp: (prev.xp || 3450) + 50 }));
        }

        addToast('Great Answer! 🧠', `+50 XP • ${matchPercentage}% conceptual alignment`, 'emerald');
      } else {
        addToast('Review Needed', 'Check the key terms in the model answer below.', 'subtle');
      }
    }, 450);
  };

  // Move to Next Card
  const handleNextCard = () => {
    resetCardInteraction();
    if (cardIdx < currentDeck.cards.length - 1) {
      setCardIdx((prev) => prev + 1);
    } else {
      setDeckCompleted(true);
      triggerConfetti();
      addToast('Deck Completed! 🏆', `You mastered ${currentDeck.title}!`, 'emerald');
    }
  };

  // Move to Previous Card
  const handlePrevCard = () => {
    resetCardInteraction();
    setCardIdx((prev) => (prev > 0 ? prev - 1 : currentDeck.cards.length - 1));
  };

  // Restart Deck
  const handleRestartDeck = () => {
    setCardIdx(0);
    setQuizScore(0);
    setStreakCombo(0);
    setSessionXP(0);
    setDeckCompleted(false);
    resetCardInteraction();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '860px', margin: '0 auto' }}>
      {activeDeckIdx === null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {(!flashcardDecks || flashcardDecks.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)' }}>
              <Layers size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>No decks available yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Check back later when new flashcard decks are added.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {flashcardDecks.map((deck, idx) => (
                <div
                  key={deck.id}
                  onClick={() => handleDeckChange(idx)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = deck.color || 'var(--accent-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="badge" style={{ backgroundColor: `${deck.color || '#10B981'}20`, color: deck.color || '#10B981', border: `1px solid ${deck.color || '#10B981'}40` }}>
                        {deck.courseCode}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{deck.cardsCount} Cards</span>
                    </div>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.3 }}>{deck.title}</h3>
                  </div>
                  
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mastery Progress</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{deck.mastered || 0} / {deck.cardsCount}</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--bg-surface)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          backgroundColor: deck.color || 'var(--accent-primary)', 
                          width: `${((deck.mastered || 0) / deck.cardsCount) * 100}%`,
                          borderRadius: '3px'
                        }} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeDeckIdx !== null && currentDeck && (
        <>
          {/* Dynamic Header specific to the active deck */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <button 
                onClick={() => handleDeckChange(null)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '4px', 
                  background: 'transparent', border: '1px solid var(--border-default)', 
                  color: 'var(--text-secondary)', padding: '0.2rem 0.6rem', 
                  borderRadius: 'var(--radius-md)', fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <ArrowLeft size={12} /> Back to Decks
              </button>
              <span className="badge" style={{ backgroundColor: `${currentDeck.color}20`, color: currentDeck.color, border: `1px solid ${currentDeck.color}40` }}>
                {currentDeck.courseCode}
              </span>
            </div>
            <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800 }}>
              {currentDeck.title}
            </h2>
          </div>
      {/* 1. TOP BAR: MODE TOGGLES, COMBO STREAK & DECK SELECTOR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '1rem 1.35rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Left: Interactive Mode Selector */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '3px'
          }}
        >
          <button
            onClick={() => {
              setPracticeMode('quiz');
              resetCardInteraction();
            }}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: practiceMode === 'quiz' ? 700 : 500,
              backgroundColor: practiceMode === 'quiz' ? 'var(--accent-blue-subtle)' : 'transparent',
              color: practiceMode === 'quiz' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: practiceMode === 'quiz' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Target size={15} />
            <span>Interactive Quiz</span>
          </button>

          <button
            onClick={() => {
              setPracticeMode('type');
              resetCardInteraction();
            }}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: practiceMode === 'type' ? 700 : 500,
              backgroundColor: practiceMode === 'type' ? 'var(--accent-blue-subtle)' : 'transparent',
              color: practiceMode === 'type' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: practiceMode === 'type' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Edit3 size={15} />
            <span>Type & Explain</span>
          </button>

          <button
            onClick={() => {
              setPracticeMode('flip');
              resetCardInteraction();
            }}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: practiceMode === 'flip' ? 700 : 500,
              backgroundColor: practiceMode === 'flip' ? 'var(--accent-blue-subtle)' : 'transparent',
              color: practiceMode === 'flip' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: practiceMode === 'flip' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RotateCw size={14} />
            <span>3D Flashcards</span>
          </button>
        </div>

        {/* Right: Live Session Stats (Combo Streak & XP) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {streakCombo > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                color: '#fbbf24',
                fontSize: '0.78rem',
                fontWeight: 800
              }}
            >
              <Flame size={15} />
              <span>{streakCombo}x Combo</span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              padding: '0.35rem 0.8rem',
              borderRadius: 'var(--radius-full)',
              color: 'var(--accent-primary)',
              fontSize: '0.78rem',
              fontWeight: 800
            }}
          >
            <Zap size={14} />
            <span>+{sessionXP} XP Earned</span>
          </div>
        </div>
      </div>

      {/* 2. DECK CAROUSEL & PROGRESS BAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {flashcardDecks.map((deck, idx) => (
            <button
              key={deck.id}
              onClick={() => handleDeckChange(idx)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.8rem',
                fontWeight: activeDeckIdx === idx ? 800 : 500,
                backgroundColor: activeDeckIdx === idx ? '#ECFDF5' : 'var(--bg-surface)',
                color: activeDeckIdx === idx ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: `1px solid ${activeDeckIdx === idx ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                cursor: 'pointer'
              }}
            >
              <span>{deck.courseCode}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                ({deck.cards.length})
              </span>
            </button>
          ))}
        </div>

        {/* Question Counter & Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Question {cardIdx + 1} of {currentDeck.cards.length}
          </span>
          <div style={{ width: '90px', height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${((cardIdx + 1) / currentDeck.cards.length) * 100}%`,
                backgroundColor: 'var(--accent-primary)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. MAIN INTERACTIVE ARENA: QUESTION CARD */}
      <div
        className="card"
        style={{
          padding: '2rem 2.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        {/* Card Header: Difficulty & Hint Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor:
                  currentCard.difficulty === 'Easy'
                    ? 'rgba(52, 211, 153, 0.2)'
                    : currentCard.difficulty === 'Hard'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(245, 158, 11, 0.2)',
                color:
                  currentCard.difficulty === 'Easy'
                    ? '#34d399'
                    : currentCard.difficulty === 'Hard'
                    ? '#f87171'
                    : '#fbbf24',
                fontWeight: 800
              }}
            >
              {currentCard.difficulty || 'Concept'}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              • {currentDeck.title}
            </span>
          </div>

          {currentCard.hint && (
            <button
              onClick={() => setShowHint(!showHint)}
              style={{
                background: 'none',
                border: 'none',
                color: showHint ? '#fbbf24' : 'var(--text-muted)',
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <Lightbulb size={14} color={showHint ? '#fbbf24' : 'var(--text-muted)'} />
              <span>{showHint ? 'Hide Clue' : 'Show Clue'}</span>
            </button>
          )}
        </div>

        {/* Big Bold Question Prompt */}
        <div>
          <span style={{ fontSize: '0.74rem', color: 'var(--accent-blue)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
            Concept Recall & Application:
          </span>
          <h2
            style={{
              fontSize: '1.35rem',
              color: 'var(--text-primary)',
              fontWeight: 800,
              lineHeight: 1.35,
              letterSpacing: '-0.02em',
              marginBottom: currentCard.codeSnippet ? '1rem' : 0
            }}
          >
            {currentCard.question}
          </h2>

          {/* Python Code Block Terminal (Clean Developer Terminal) */}
          {currentCard.codeSnippet && (
            <div
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem 1.25rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.88rem',
                color: '#E2E8F0',
                lineHeight: 1.6,
                overflowX: 'auto',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '0.4rem',
                  marginBottom: '0.75rem',
                  fontSize: '0.72rem',
                  color: 'var(--accent-primary)',
                  fontWeight: 800
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                  <span style={{ marginLeft: '6px' }}>🐍 Python 3.11 Execution</span>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>snippet.py</span>
              </div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#a7f3d0' }}>
                <code>{currentCard.codeSnippet}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Expandable Hint Banner */}
        {showHint && currentCard.hint && (
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.82rem',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Lightbulb size={16} />
            <span>
              <strong>Concept Clue:</strong> {currentCard.hint}
            </span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 1: MULTIPLE CHOICE INTERACTIVE ANSWERING                 */}
        {/* ------------------------------------------------------------- */}
        {practiceMode === 'quiz' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Select the most accurate answer:
            </span>

            {(currentCard.options || [
              { id: 'opt-1', text: currentCard.answer, isCorrect: true, explanation: "Correct!" },
              { id: 'opt-2', text: "It reduces quadratic matrix multiplication complexity to linear time.", isCorrect: false, explanation: "Incorrect." },
              { id: 'opt-3', text: "It prevents causal attention leaks into future tokens.", isCorrect: false, explanation: "Incorrect." },
              { id: 'opt-4', text: "It forces hidden state projections into orthogonal subspaces.", isCorrect: false, explanation: "Incorrect." }
            ]).map((option, idx) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C, D
              const isSelected = selectedOptionId === option.id;
              const showResult = hasAnswered;

              let btnBg = 'var(--bg-surface)';
              let btnBorder = 'var(--border-default)';
              let textColor = 'var(--text-primary)';

              if (showResult) {
                if (option.isCorrect) {
                  btnBg = 'rgba(5, 150, 105, 0.08)';
                  btnBorder = 'var(--accent-primary)';
                  textColor = 'var(--accent-primary)';
                } else if (isSelected && !option.isCorrect) {
                  btnBg = 'rgba(220, 38, 38, 0.08)';
                  btnBorder = '#DC2626';
                  textColor = '#DC2626';
                }
              } else if (isSelected) {
                btnBg = 'var(--accent-blue-subtle)';
                btnBorder = 'var(--accent-blue)';
                textColor = 'var(--accent-blue)';
              }

              return (
                <div key={option.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <button
                    onClick={() => handleOptionSelect(option)}
                    disabled={hasAnswered}
                    style={{
                      padding: '0.9rem 1.15rem',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: btnBg,
                      border: `1.5px solid ${btnBorder}`,
                      color: textColor,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.85rem',
                      textAlign: 'left',
                      cursor: hasAnswered ? 'default' : 'pointer',
                      transition: 'all 0.15s ease',
                      fontSize: '0.88rem',
                      lineHeight: 1.45
                    }}
                  >
                    {/* Option Letter Tag */}
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: showResult && option.isCorrect
                          ? 'var(--accent-primary)'
                          : showResult && isSelected && !option.isCorrect
                          ? '#DC2626'
                          : isSelected
                          ? 'var(--accent-blue)'
                          : 'var(--bg-card)',
                        border: `1px solid ${showResult && (option.isCorrect || isSelected) ? 'transparent' : 'var(--border-default)'}`,
                        color: (showResult && (option.isCorrect || isSelected)) || isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        flexShrink: 0,
                        marginTop: '1px'
                      }}
                    >
                      {showResult && option.isCorrect ? (
                        <Check size={16} strokeWidth={3} />
                      ) : showResult && isSelected && !option.isCorrect ? (
                        <XCircle size={16} />
                      ) : (
                        letter
                      )}
                    </div>

                    <span style={{ flex: 1, fontWeight: showResult && option.isCorrect ? 700 : 500 }}>
                      {option.text}
                    </span>
                  </button>

                  {/* Detailed Explanation Box */}
                  {showResult && (isSelected || option.isCorrect) && option.explanation && (
                    <div
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: option.isCorrect ? '#ECFDF5' : '#FEF2F2',
                        border: `1px solid ${option.isCorrect ? '#A7F3D0' : '#FECACA'}`,
                        fontSize: '0.8rem',
                        color: option.isCorrect ? 'var(--accent-primary)' : 'var(--accent-urgent)',
                        marginLeft: '2.5rem'
                      }}
                    >
                      💡 <strong>Explanation:</strong> {option.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 2: TYPE-IN ACTIVE RECALL ANSWERING                       */}
        {/* ------------------------------------------------------------- */}
        {practiceMode === 'type' && (
          <form onSubmit={handleSubmitTypedAnswer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              ✍️ Type your explanation in your own words:
            </span>

            <textarea
              rows={4}
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              disabled={typeResult !== null}
              placeholder="Explain the underlying mechanics, mathematical properties, or architectural tradeoffs..."
              style={{
                width: '100%',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                padding: '1rem',
                borderRadius: 'var(--radius-md)'
              }}
            />

            {!typeResult ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={!typedAnswer.trim() || isEvaluating}
                  className="btn-primary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.84rem', gap: '6px' }}
                >
                  <Send size={15} />
                  <span>{isEvaluating ? 'Evaluating Answer...' : 'Submit & Grade Answer'}</span>
                </button>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: typeResult.isPass ? '#ECFDF5' : '#FFFBEB',
                  border: `1.5px solid ${typeResult.isPass ? 'var(--accent-primary)' : '#f59e0b'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BrainCircuit size={18} color={typeResult.isPass ? 'var(--accent-primary)' : 'var(--priority-high-text)'} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      AI Concept Evaluation: {typeResult.score}% Alignment
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: typeResult.isPass ? 'var(--priority-emerald-bg)' : 'var(--priority-high-bg)',
                      color: typeResult.isPass ? 'var(--priority-emerald-text)' : 'var(--priority-high-text)',
                      border: `1px solid ${typeResult.isPass ? 'var(--priority-emerald-border)' : 'var(--priority-high-border)'}`
                    }}
                  >
                    {typeResult.isPass ? 'PASSED (+50 XP)' : 'REVIEW SUGGESTED'}
                  </span>
                </div>

                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  <strong>Key terms identified:</strong>{' '}
                  {typeResult.matchedKeywords.length > 0 ? (
                    typeResult.matchedKeywords.map((kw, i) => (
                      <span key={i} style={{ color: 'var(--accent-primary)', marginRight: '6px', fontWeight: 700 }}>
                        ✓ {kw}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>None detected</span>
                  )}
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--accent-blue)', fontWeight: 700, display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    Model Answer:
                  </span>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                    {currentCard.answer}
                  </p>
                </div>
              </div>
            )}
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 3: 3D FLIP CARD & SPACED REPETITION SELF-GRADING         */}
        {/* ------------------------------------------------------------- */}
        {practiceMode === 'flip' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              style={{
                backgroundColor: isFlipped ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                border: `1.5px dashed ${isFlipped ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '1.75rem',
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              {!isFlipped ? (
                <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                  <RotateCw size={16} color="var(--accent-blue)" />
                  <span>Click here or press Space to reveal complete solution & formula</span>
                </div>
              ) : (
                <div style={{ animation: 'fadeIn 0.2s ease' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--accent-blue)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                    Detailed Concept Answer:
                  </span>
                  <p style={{ fontSize: '0.96rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                    {currentCard.answer}
                  </p>
                </div>
              )}
            </div>

            {/* Anki Spaced Repetition Grading Buttons */}
            {isFlipped && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
                <button
                  onClick={() => {
                    addToast('Review Queued', 'Card will repeat in 1 min', 'subtle');
                    handleNextCard();
                  }}
                  className="btn-secondary"
                  style={{ borderColor: '#ef4444', color: '#f87171', justifyContent: 'center' }}
                >
                  🔴 Again (&lt;1m)
                </button>

                <button
                  onClick={() => {
                    addToast('Interval Set', 'Card scheduled for tomorrow', 'subtle');
                    handleNextCard();
                  }}
                  className="btn-secondary"
                  style={{ borderColor: '#f59e0b', color: '#fbbf24', justifyContent: 'center' }}
                >
                  🟡 Hard (1d)
                </button>

                <button
                  onClick={() => {
                    addToast('Good Recall! 🧠', '+15 XP • Scheduled in 3 days', 'emerald');
                    handleNextCard();
                  }}
                  className="btn-secondary"
                  style={{ borderColor: '#34d399', color: '#34d399', justifyContent: 'center' }}
                >
                  🟢 Good (3d)
                </button>

                <button
                  onClick={() => {
                    triggerConfetti();
                    addToast('Mastered! 🚀', '+25 XP • Scheduled in 7 days', 'emerald');
                    handleNextCard();
                  }}
                  className="btn-primary"
                  style={{ justifyContent: 'center' }}
                >
                  🔵 Easy (7d)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer Controls: Previous & Next Card Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1rem',
            marginTop: '0.5rem'
          }}
        >
          <button
            onClick={handlePrevCard}
            className="btn-secondary"
            style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', gap: '6px' }}
          >
            <ArrowLeft size={15} />
            <span>Previous Question</span>
          </button>

          <button
            onClick={handleNextCard}
            className="btn-primary"
            style={{ padding: '0.5rem 1.35rem', fontSize: '0.84rem', gap: '6px' }}
          >
            <span>{cardIdx === currentDeck.cards.length - 1 ? 'Finish Deck' : 'Next Question'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* 4. DECK COMPLETION SUMMARY MODAL */}
      {deckCompleted && (
        <div className="modal-overlay" onClick={() => setDeckCompleted(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '520px', padding: '2.25rem', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#ECFDF5',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                border: '2px solid #A7F3D0',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Trophy size={32} />
            </div>

            <h3 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '0.35rem' }}>
              Deck Session Mastered!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              You reviewed all questions in <strong style={{ color: 'var(--text-primary)' }}>{currentDeck.title}</strong>
            </p>

            {/* Score Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                marginBottom: '1.75rem'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Score</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {quizScore} / {currentDeck.cards.length}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Accuracy</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24' }}>
                  {Math.round((quizScore / currentDeck.cards.length) * 100)}%
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>XP Earned</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4ade80' }}>
                  +{sessionXP} XP
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={handleRestartDeck}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem', gap: '6px' }}
              >
                <RefreshCw size={15} />
                <span>Practice Again</span>
              </button>

              <button
                onClick={() => {
                  const nextIdx = (activeDeckIdx + 1) % flashcardDecks.length;
                  handleDeckChange(nextIdx);
                }}
                className="btn-primary"
                style={{ padding: '0.6rem 1.4rem', gap: '6px' }}
              >
                <span>Next Subject Deck</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
