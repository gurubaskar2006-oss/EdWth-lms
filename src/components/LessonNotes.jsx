import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import { Save, Bookmark, Copy, Check, Download, Sparkles } from 'lucide-react';

export const LessonNotes = ({ lessonId, lessonTitle }) => {
  const { notes, saveLessonNote, addToast } = useLMS();
  const [currentText, setCurrentText] = useState(notes[lessonId] || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCurrentText(notes[lessonId] || '');
  }, [lessonId, notes]);

  const handleSave = () => {
    saveLessonNote(lessonId, currentText);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast("Copied to Clipboard", "Notes copied successfully", "subtle");
  };

  const insertTimestamp = () => {
    const timestampTag = `\n> **[Bookmark at 12:45]** Key concept explanation:\n- `;
    setCurrentText((prev) => prev + timestampTag);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        height: '100%',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>Interactive Notepad</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Notes for {lessonTitle || 'Current Lesson'} (Auto-saved)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={insertTimestamp}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            title="Add timestamp bookmark"
          >
            <Bookmark size={13} color="var(--accent-blue)" />
            <span>Timestamp</span>
          </button>

          <button
            onClick={handleCopy}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
          >
            {copied ? <Check size={13} color="var(--accent-primary)" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleSave}
            className="btn-primary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
          >
            <Save size={13} />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Editor Textarea */}
      <textarea
        value={currentText}
        onChange={(e) => setCurrentText(e.target.value)}
        placeholder="Type Markdown notes here... (e.g. # Formulas, - Bullet points, > Quotes)"
        style={{
          flex: 1,
          minHeight: '260px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.86rem',
          lineHeight: '1.6',
          resize: 'vertical'
        }}
      />
    </div>
  );
};
