import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  FileCheck2,
  List,
  Kanban,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  ChevronRight,
  Filter,
  Check,
  Code2,
  Award
} from 'lucide-react';

export const AssignmentsView = ({ onOpenSubmitModal, onOpenAssessmentModal }) => {
  usePageTitle('Assignments & Assessments');
  const { assignments, codingChallenges } = useLMS();

  const [activeTab, setActiveTab] = useState('coursework'); // 'coursework' | 'assessments'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'kanban'
  const [filterStatus, setFilterStatus] = useState('all'); // all, pending, completed

  const filteredAssignments = assignments.filter((asg) => {
    if (filterStatus === 'pending') return asg.status === 'todo' || asg.status === 'in_progress';
    if (filterStatus === 'completed') return asg.status === 'submitted' || asg.status === 'graded';
    return true;
  });

  const pendingCount = assignments.filter((a) => a.status === 'todo' || a.status === 'in_progress').length;
  const completedCount = assignments.filter((a) => a.status === 'submitted' || a.status === 'graded').length;

  const kanbanColumns = [
    { id: 'todo', title: 'To Do', color: '#64748B' },
    { id: 'in_progress', title: 'In Progress', color: '#D97706' },
    { id: 'submitted', title: 'Submitted', color: '#2563EB' },
    { id: 'graded', title: 'Graded', color: '#059669' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1080px' }}>
      {/* Top Level Section Tabs */}
      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('coursework')}
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: activeTab === 'coursework' ? 'var(--text-primary)' : 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'coursework' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            paddingBottom: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Coursework
        </button>
        <button
          onClick={() => setActiveTab('assessments')}
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: activeTab === 'assessments' ? 'var(--text-primary)' : 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'assessments' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            paddingBottom: '0.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Code2 size={18} />
          Coding Assessments
        </button>
      </div>

      {activeTab === 'coursework' ? (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Assignments
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                {pendingCount} tasks pending submission • {completedCount} completed
              </p>
            </div>

            {/* View Toggle */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '3px'
              }}
            >
              <button
                onClick={() => setViewMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: viewMode === 'list' ? 700 : 500,
                  backgroundColor: viewMode === 'list' ? 'var(--accent-blue-subtle)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  border: viewMode === 'list' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent'
                }}
              >
                <List size={14} />
                <span>List</span>
              </button>

              <button
                onClick={() => setViewMode('kanban')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: viewMode === 'kanban' ? 700 : 500,
                  backgroundColor: viewMode === 'kanban' ? 'var(--accent-blue-subtle)' : 'transparent',
                  color: viewMode === 'kanban' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  border: viewMode === 'kanban' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent'
                }}
              >
                <Kanban size={14} />
                <span>Board</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { id: 'all', label: `All (${assignments.length})` },
              { id: 'pending', label: `Pending (${pendingCount})` },
              { id: 'completed', label: `Completed (${completedCount})` }
            ].map((tab) => {
              const isSelected = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: isSelected ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Streamlined List View */}
          {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredAssignments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-card)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
                  <FileCheck2 size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700 }}>No assignments found</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.35rem' }}>
                    You have no {filterStatus !== 'all' ? filterStatus : ''} assignments at the moment.
                  </p>
                </div>
              ) : (
                filteredAssignments.map((asg) => {
                  const isUrgent = asg.priority === 'urgent' && asg.status !== 'graded';
                  const isGraded = asg.status === 'graded';
                  const isSubmitted = asg.status === 'submitted';

                  return (
                    <div
                      key={asg.id}
                      className="card card-interactive"
                      style={{
                        padding: '1rem 1.35rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${isUrgent ? 'rgba(220, 38, 38, 0.4)' : 'var(--border-default)'}`,
                        backgroundColor: 'var(--bg-card)'
                      }}
                      onClick={() => onOpenSubmitModal(asg)}
                    >
                      {/* Course Badge + Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '240px' }}>
                        <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>
                          {asg.courseCode}
                        </span>

                        <div>
                          <h3 style={{ fontSize: '0.96rem', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
                            {asg.title}
                          </h3>
                        </div>
                      </div>

                      {/* Middle: Deadline & Points */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: isUrgent ? '#DC2626' : 'var(--text-secondary)' }}>
                          {isUrgent ? <AlertTriangle size={14} color="#DC2626" /> : <Clock size={14} color="var(--text-muted)" />}
                          <span style={{ fontWeight: isUrgent ? 700 : 500 }}>
                            {isUrgent ? '⚠ ' : ''}{asg.status === 'graded' ? 'Completed' : asg.dueRelative}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: isGraded ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            minWidth: '65px',
                            textAlign: 'right'
                          }}
                        >
                          {isGraded ? `${asg.score}/${asg.points} pts` : `${asg.points} pts`}
                        </span>

                        {/* Action Status / Button */}
                        {isGraded ? (
                          <span
                            className="badge badge-emerald"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                          >
                            <Check size={13} strokeWidth={3} />
                            <span>Graded ({asg.score}%)</span>
                          </span>
                        ) : isSubmitted ? (
                          <span
                            className="badge badge-info"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                          >
                            In Review
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSubmitModal(asg);
                            }}
                            className="btn-primary"
                            style={{ padding: '0.4rem 0.95rem', fontSize: '0.8rem', gap: '5px' }}
                          >
                            <UploadCloud size={14} />
                            <span>Submit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Kanban Board */}
          {viewMode === 'kanban' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem'
              }}
            >
              {kanbanColumns.map((col) => {
                const colTasks = assignments.filter((a) => a.status === col.id);
                return (
                  <div
                    key={col.id}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      minHeight: '280px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {col.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-default)',
                          fontWeight: 700
                        }}
                      >
                        {colTasks.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {colTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => onOpenSubmitModal(task)}
                          className="card card-interactive"
                          style={{
                            padding: '0.85rem 1rem',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', fontWeight: 700 }}>
                              {task.courseCode}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {task.points} pts
                            </span>
                          </div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={11} /> {task.dueRelative}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Assessments Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em' }}>Coding Assessments</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>Complete algorithmic coding challenges to earn XP and boost your ranking.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {codingChallenges && codingChallenges.map((challenge) => (
              <div
                key={challenge.id || challenge.day}
                className="card card-interactive"
                style={{
                  padding: '1.15rem 1.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-card)'
                }}
                onClick={() => onOpenAssessmentModal(challenge)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    backgroundColor: challenge.solved ? 'var(--accent-primary-subtle)' : 'var(--bg-surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: challenge.solved ? 'var(--accent-primary)' : 'var(--text-muted)',
                    border: '1px solid var(--border-default)'
                  }}>
                    <Code2 size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 0.2rem 0' }}>
                      {challenge.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span style={{ 
                        fontWeight: 600,
                        color: challenge.difficulty === 'Easy' ? 'var(--accent-primary)' : challenge.difficulty === 'Medium' ? '#D97706' : '#DC2626' 
                      }}>
                        {challenge.difficulty}
                      </span>
                      <span>•</span>
                      <span>{challenge.category}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                    <Award size={16} />
                    {challenge.xpReward || 100} XP
                  </div>

                  {challenge.solved ? (
                    <span
                      className="badge badge-emerald"
                      style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                    >
                      <Check size={13} strokeWidth={3} />
                      Solved
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenAssessmentModal) onOpenAssessmentModal(challenge);
                      }}
                      className="btn-primary"
                      style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                    >
                      Solve Challenge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
