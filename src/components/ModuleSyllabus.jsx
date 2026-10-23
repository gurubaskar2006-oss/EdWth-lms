import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  PlayCircle,
  FileCode2,
  HelpCircle,
  FileText,
  CheckCircle2,
  Circle,
  Lock
} from 'lucide-react';

export const ModuleSyllabus = ({
  syllabus = [],
  activeLessonId,
  onSelectLesson,
  onToggleComplete
}) => {
  // Keep all modules expanded by default
  const [expandedModules, setExpandedModules] = useState(
    syllabus.reduce((acc, mod) => ({ ...acc, [mod.id]: true }), {})
  );

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const getLessonIcon = (type) => {
    switch (type) {
      case 'video':
        return PlayCircle;
      case 'coding':
        return FileCode2;
      case 'quiz':
        return HelpCircle;
      case 'assignment':
        return FileText;
      default:
        return PlayCircle;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        height: '100%',
        overflowY: 'auto'
      }}
    >
      {syllabus.map((mod, modIndex) => {
        const isExpanded = expandedModules[mod.id];
        const completedInMod = mod.lessons.filter((l) => l.completed).length;
        const totalInMod = mod.lessons.length;
        const isModFinished = totalInMod > 0 && completedInMod === totalInMod;

        return (
          <div
            key={mod.id}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden'
            }}
          >
            {/* Module Accordion Header */}
            <div
              onClick={() => toggleModule(mod.id)}
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderBottom: isExpanded ? '1px solid var(--border-default)' : 'none',
                userSelect: 'none'
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                    Module {modIndex + 1}
                  </span>
                  {isModFinished && (
                    <span className="badge badge-emerald" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                      Complete
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {mod.title.replace(/^Module \d+:\s*/, '')}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {completedInMod}/{totalInMod}
                </span>
                {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>
            </div>

            {/* Lessons List in Module */}
            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {mod.lessons.map((lesson) => {
                  const isActive = activeLessonId === lesson.id;
                  const Icon = getLessonIcon(lesson.type);

                  return (
                    <div
                      key={lesson.id}
                      onClick={() => onSelectLesson(lesson.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'var(--accent-blue-subtle)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--accent-blue)' : '3px solid transparent',
                        borderBottom: '1px solid var(--border-default)',
                        transition: 'background-color var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Left: Completion Checkbox & Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleComplete(lesson.id);
                          }}
                          style={{
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                          title={lesson.completed ? "Mark Incomplete" : "Mark Complete"}
                        >
                          {lesson.completed ? (
                            <CheckCircle2
                              size={18}
                              color="var(--accent-primary)"
                              fill="rgba(5, 150, 105, 0.15)"
                            />
                          ) : (
                            <Circle size={18} color="var(--border-hover)" />
                          )}
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.84rem',
                              fontWeight: isActive ? 700 : 500,
                              color: isActive ? 'var(--accent-blue)' : lesson.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {lesson.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{lesson.type}</span>
                            <span>•</span>
                            <span>{lesson.duration}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Type Icon */}
                      <Icon
                        size={16}
                        color={isActive ? 'var(--accent-blue)' : 'var(--text-muted)'}
                        style={{ flexShrink: 0 }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
