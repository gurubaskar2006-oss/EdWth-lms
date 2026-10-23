import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { HelpCircle, CheckCircle2, XCircle, Award, RotateCcw, ArrowRight } from 'lucide-react';

export const LessonQuiz = ({ lessonId, onCompleteLesson }) => {
  const { triggerConfetti, addToast } = useLMS();

  const quizQuestions = [
    {
      id: 1,
      question: "In Transformer scaled dot-product attention, why is the matrix product divided by √d_k?",
      options: [
        "To invert the matrix determinants",
        "To prevent large values from pushing softmax into regions with vanishing gradients",
        "To reduce computational complexity from O(N^2) to O(N)",
        "To satisfy the unitary eigenvalue property"
      ],
      correctIndex: 1,
      explanation: "Dividing by √d_k scales the dot products to unit variance, preventing saturation in the softmax function."
    },
    {
      id: 2,
      question: "Which tensor positional encoding multiplies query & key vectors by 2D orthogonal rotation matrices?",
      options: [
        "Learned Absolute Embeddings",
        "Sinusoidal 1D encodings",
        "Rotary Position Embeddings (RoPE)",
        "ALiBi Linear Biases"
      ],
      correctIndex: 2,
      explanation: "RoPE applies rotation matrices parameterized by token position m to naturally capture relative distance in the inner product."
    },
    {
      id: 3,
      question: "What is the primary architectural advantage of Pre-LayerNorm over Post-LayerNorm?",
      options: [
        "Provides a direct identity path throughout the residual stream, stabilizing deep network training",
        "Decreases parameter count by 50%",
        "Eliminates the need for feed-forward MLP layers",
        "Guarantees deterministic GPU execution"
      ],
      correctIndex: 0,
      explanation: "Pre-LN creates an unimpeded gradient highway via the identity skip connection, removing the need for fragile learning rate warmups."
    }
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const currentQ = quizQuestions[currentIdx];
  const isAnswered = selectedAnswers[currentQ.id] !== undefined;

  const handleSelect = (optionIdx) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optionIdx }));
  };

  const handleNext = () => {
    if (currentIdx < quizQuestions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setSubmitted(true);
      const correctCount = quizQuestions.filter((q) => selectedAnswers[q.id] === q.correctIndex).length;
      if (correctCount === quizQuestions.length) {
        triggerConfetti();
        addToast("Perfect Quiz Score! 🎯", "+100 XP awarded to your profile!", "emerald");
        if (onCompleteLesson) onCompleteLesson();
      } else {
        addToast("Quiz Completed", `You scored ${correctCount}/${quizQuestions.length}`, "subtle");
      }
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentIdx(0);
    setSubmitted(false);
  };

  const correctCount = quizQuestions.filter((q) => selectedAnswers[q.id] === q.correctIndex).length;
  const scorePercent = Math.round((correctCount / quizQuestions.length) * 100);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <HelpCircle size={20} color="var(--accent-blue)" />
          <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>Lesson Knowledge Check</h4>
        </div>
        <span className="badge badge-info">
          {submitted ? 'Completed' : `Question ${currentIdx + 1} of ${quizQuestions.length}`}
        </span>
      </div>

      {!submitted ? (
        <div>
          {/* Question Title */}
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem', lineHeight: 1.45 }}>
            {currentQ.question}
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
            {currentQ.options.map((opt, i) => {
              const isSelected = selectedAnswers[currentQ.id] === i;
              return (
                <div
                  key={i}
                  onClick={() => handleSelect(i)}
                  style={{
                    padding: '0.85rem 1.15rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                    color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-default)';
                  }}
                >
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--accent-blue)' : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                      color: isSelected ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ fontSize: '0.88rem' }}>{opt}</span>
                </div>
              );
            })}
          </div>

          {/* Next Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleNext}
              disabled={!isAnswered}
              className="btn-blue"
              style={{
                opacity: isAnswered ? 1 : 0.5,
                cursor: isAnswered ? 'pointer' : 'not-allowed'
              }}
            >
              <span>{currentIdx === quizQuestions.length - 1 ? 'Submit Answers' : 'Next Question'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Results View */
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary-subtle)',
              border: '2px solid var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}
          >
            <Award size={32} color="var(--accent-primary)" />
          </div>

          <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '0.5rem' }}>
            {scorePercent === 100 ? 'Flawless Comprehension! 🌟' : 'Good Effort!'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            You scored {correctCount} out of {quizQuestions.length} ({scorePercent}%)
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button onClick={handleRetake} className="btn-secondary">
              <RotateCcw size={16} /> Retake Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
