import React, { useState, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiService } from '../../services/apiService';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Code2,
  Play,
  Terminal,
  HelpCircle,
  FileCheck2,
  Award,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
  Layers,
  Circle,
  X,
  FileText,
  Download
} from 'lucide-react';
import { SchoolContextualHelpModal } from '../../components/school/SchoolContextualHelpModal';

export const SchoolSubjectsView = ({ onOpenHomeworkModal, onOpenAssessmentModal }) => {
  usePageTitle('My Subjects');
  const { user, schoolSubjects, setSchoolSubjects, schoolHomework, schoolTests, schoolResults, setActiveTab, addToast } = useLMS();
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectDetail, setSubjectDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState({ 1: true, 7: true });
  const [activeLessonModal, setActiveLessonModal] = useState(null); // { unit, topic, lesson }
  const [isCompletingTopic, setIsCompletingTopic] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [subjectMaterials, setSubjectMaterials] = useState([]);
  const [downloadingMatId, setDownloadingMatId] = useState(null);

  // Load subject detail when a subject card is clicked
  const handleSelectSubject = async (sub) => {
    setSelectedSubject(sub);
    setLoadingDetail(true);
    setSubjectMaterials([]);
    try {
      const res = await apiService.getSchoolSubjectDetail(sub.id || sub._id);
      if (res?.success && res.subject) {
        setSubjectDetail(res.subject);
        // Expand the current teaching topic's unit if available
        if (res.subject.currentTeachingTopic?.unitNumber) {
          setExpandedUnits(prev => ({ ...prev, [res.subject.currentTeachingTopic.unitNumber]: true }));
        }
      } else {
        // Fallback to basic subject data
        setSubjectDetail(sub);
      }
    } catch (err) {
      console.error('Error loading subject curriculum:', err);
      setSubjectDetail(sub);
    } finally {
      setLoadingDetail(false);
    }

    // Load subject study materials from object storage
    try {
      const materialsData = await apiService.getNotes({ subject: sub.name });
      if (Array.isArray(materialsData)) {
        setSubjectMaterials(materialsData);
      }
    } catch (matErr) {
      console.error('Error loading subject materials:', matErr);
    }
  };

  const handleDownloadSubjectMaterial = async (item) => {
    const file = item.files && item.files[0];
    if (!file?.s3Key) return;
    setDownloadingMatId(item.id);
    addToast('Requesting Download', 'Authorizing download link from Backblaze B2...', 'subtle');
    try {
      const url = await apiService.getNoteFileUrl(item.id, file.s3Key);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = file.originalName || item.title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('Download Started', `Downloading "${file.originalName || item.title}"`, 'emerald');
      } else {
        addToast('Access Denied', 'Unable to retrieve authorized download link.', 'rose');
      }
    } catch (err) {
      console.error('Download error:', err);
      addToast('Error', 'Failed to retrieve download link.', 'rose');
    } finally {
      setDownloadingMatId(null);
    }
  };

  const toggleUnit = (unitNumber) => {
    setExpandedUnits(prev => ({ ...prev, [unitNumber]: !prev[unitNumber] }));
  };

  // Handle Mark Topic as Completed
  const handleCompleteTopic = async (unitNumber, topicNumber, topicTitle) => {
    if (!subjectDetail) return;
    setIsCompletingTopic(true);
    try {
      const res = await apiService.completeSchoolTopic(
        subjectDetail.id || selectedSubject.id,
        unitNumber,
        topicNumber,
        topicTitle
      );

      if (res?.success) {
        // Update local subject detail
        setSubjectDetail(prev => ({
          ...prev,
          progress: res.progress,
          completedTopicsCount: res.completedTopicsCount,
          totalTopicsCount: res.totalTopicsCount,
          completedKeys: res.completedKeys
        }));

        // Update list view
        setSchoolSubjects(prev =>
          prev.map(s =>
            s.id === selectedSubject.id
              ? {
                  ...s,
                  progress: res.progress,
                  completedTopicsCount: res.completedTopicsCount,
                  totalTopicsCount: res.totalTopicsCount
                }
              : s
          )
        );

        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });

        addToast(
          'Topic Completed!',
          `You completed "${topicTitle}". Real progress updated to ${res.progress}%.`,
          'emerald'
        );
      } else {
        addToast('Notice', res?.message || 'Could not update completion status.', 'amber');
      }
    } catch (err) {
      addToast('Error', 'Network error completing topic.', 'rose');
    } finally {
      setIsCompletingTopic(false);
    }
  };

  // Linked homework, tests, and results
  const subjectHw = (schoolHomework || []).filter((h) =>
    h.courseId === (selectedSubject?.id || selectedSubject?._id) ||
    h.subject?.toLowerCase().includes((selectedSubject?.name || '').toLowerCase())
  );

  const subjectTests = (schoolTests || []).filter((t) =>
    t.subject?.toLowerCase().includes((selectedSubject?.name || '').toLowerCase())
  );

  const subjectResults = (schoolResults || []).filter((r) =>
    r.subject?.toLowerCase().includes((selectedSubject?.name || '').toLowerCase())
  );

  const currentTopic = subjectDetail?.currentTeachingTopic || selectedSubject?.currentTeachingTopic;

  // Jump to Current Lesson in reader
  const handleOpenCurrentLesson = () => {
    if (!subjectDetail?.units || !currentTopic) return;
    const unitObj = subjectDetail.units.find(u => u.unitNumber === currentTopic.unitNumber);
    if (!unitObj) return;
    const topicObj = unitObj.topics?.find(t => t.topicNumber === currentTopic.topicNumber) || unitObj.topics?.[0];
    if (!topicObj) return;
    const lessonObj = topicObj.lessons?.[0] || {
      title: topicObj.title,
      whatIsIt: topicObj.description,
      whyUseIt: 'Essential component of this academic unit.',
      syntax: '# Syntax and implementation details',
      example: 'print("Lesson in progress")',
      explanation: ['Follow teacher lecture notes and examples.'],
      expectedOutput: 'Output generated',
      commonMistakes: ['Check syntax and indentation.'],
      tryItYourself: 'Run this example in your school sandbox.',
      starterCode: 'print("Hello from classroom")\n',
      practiceQuestion: 'What are the main concepts in this topic?'
    };

    setActiveLessonModal({
      unit: unitObj,
      topic: topicObj,
      lesson: lessonObj
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DETAIL VIEW: Full 13-Unit Academic Curriculum & Lesson Reader
  // ─────────────────────────────────────────────────────────────────────────────
  if (selectedSubject) {
    const isTopicCompleted = (unitNum, topicNum) => {
      const key = `${unitNum}-${topicNum}`;
      return subjectDetail?.completedKeys?.includes(key);
    };

    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
        {/* Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            onClick={() => {
              setSelectedSubject(null);
              setSubjectDetail(null);
            }}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem' }}
          >
            <ArrowLeft size={16} />
            <span>Back to All Subjects</span>
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className="btn-icon"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)'
            }}
            title="Subject Curriculum Guidance"
          >
            <HelpCircle size={17} />
          </button>
        </div>

        {/* Subject Header Card */}
        <div
          className="card"
          style={{
            padding: '2rem',
            borderRadius: '18px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '2.5rem' }}>{selectedSubject.icon || '📚'}</span>
              <div>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.6rem',
                    borderRadius: '12px',
                    backgroundColor: `${selectedSubject.color || '#2563EB'}15`,
                    color: selectedSubject.color || '#2563EB'
                  }}
                >
                  {selectedSubject.code || 'Curriculum'} • {user?.className || user?.batchName || 'Academic Cohort'}
                </span>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {selectedSubject.name}
                </h1>
              </div>
            </div>

            {/* Curriculum Progress Display */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Curriculum Mastery
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                {subjectDetail?.progress ?? selectedSubject.progress ?? 0}%
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {subjectDetail?.completedTopicsCount ?? 0} of {subjectDetail?.totalTopicsCount ?? 0} topics completed
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              padding: '1.25rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              marginBottom: '1.25rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Assigned Teacher</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {selectedSubject.teacher}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Laboratory / Room</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {selectedSubject.room}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Next Scheduled Class</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '2px' }}>
                {selectedSubject.nextClass}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending Homework</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: subjectHw.filter(h => h.status === 'pending').length > 0 ? '#D97706' : '#059669', marginTop: '2px' }}>
                {subjectHw.filter(h => h.status === 'pending').length > 0
                  ? `${subjectHw.filter(h => h.status === 'pending').length} Tasks Pending`
                  : 'All Caught Up'}
              </div>
            </div>
          </div>

          {/* Real Current Teaching Topic Banner */}
          {currentTopic && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                marginBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#2563EB',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Current Teaching Topic • {currentTopic.scheduledTime || 'Today'}
                  </div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    Unit {currentTopic.unitNumber} ({currentTopic.unitTitle || 'Active Unit'}) — Topic {currentTopic.topicNumber}: {currentTopic.topicTitle}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Instructor: {currentTopic.teacherName || selectedSubject.teacher} • Class: {currentTopic.className || 'Class 10-A'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleOpenCurrentLesson}
                className="btn-primary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <BookOpen size={15} />
                <span>Open Current Lesson</span>
              </button>
            </div>
          )}

          {/* Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              <span>Curriculum Completion Progress</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>
                {subjectDetail?.completedTopicsCount ?? 0} / {subjectDetail?.totalTopicsCount ?? 0} topics completed
              </span>
            </div>
            <div className="progress-bar-bg" style={{ height: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${subjectDetail?.progress ?? selectedSubject.progress ?? 0}%`,
                  backgroundColor: '#059669'
                }}
              />
            </div>
          </div>
        </div>

        {/* 13-Unit Curriculum Accordion */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Term Curriculum Structure
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Comprehensive unit-by-unit syllabus with concept explanations, examples, and practice.
              </p>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {subjectDetail?.units?.length || 0} Instructional Units
            </div>
          </div>

          {loadingDetail ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading curriculum structure...
            </div>
          ) : !subjectDetail?.units || subjectDetail.units.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No structured curriculum units found for this subject.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {subjectDetail.units.map((unit) => {
                const isExpanded = expandedUnits[unit.unitNumber];
                const unitTopics = unit.topics || [];
                const completedInUnit = unitTopics.filter(t => isTopicCompleted(unit.unitNumber, t.topicNumber)).length;
                const isUnitFullyCompleted = unitTopics.length > 0 && completedInUnit === unitTopics.length;

                return (
                  <div
                    key={unit.unitNumber}
                    className="card"
                    style={{
                      borderRadius: '14px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    {/* Unit Header Bar */}
                    <div
                      onClick={() => toggleUnit(unit.unitNumber)}
                      style={{
                        padding: '1.15rem 1.4rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                        borderBottom: isExpanded ? '1px solid var(--border-default)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: isUnitFullyCompleted ? 'rgba(5, 150, 105, 0.12)' : 'rgba(37, 99, 235, 0.1)',
                            color: isUnitFullyCompleted ? '#059669' : '#2563EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem'
                          }}
                        >
                          {unit.unitNumber}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h3 style={{ fontSize: '1.02rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                              UNIT {unit.unitNumber} — {unit.title.toUpperCase()}
                            </h3>
                            {isUnitFullyCompleted && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(5, 150, 105, 0.12)',
                                  color: '#059669'
                                }}
                              >
                                Completed
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {unit.description || `${unitTopics.length} core topics`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {completedInUnit} / {unitTopics.length} Topics
                        </span>
                        {isExpanded ? <ChevronDown size={18} color="var(--text-secondary)" /> : <ChevronRight size={18} color="var(--text-secondary)" />}
                      </div>
                    </div>

                    {/* Topics List Inside Unit */}
                    {isExpanded && (
                      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {unitTopics.map((topic) => {
                          const completed = isTopicCompleted(unit.unitNumber, topic.topicNumber);
                          const lesson = topic.lessons?.[0] || {
                            title: topic.title,
                            whatIsIt: topic.description,
                            whyUseIt: 'Essential foundational skill.',
                            syntax: '# Example syntax',
                            example: 'print("Topic in progress")',
                            explanation: ['Follow lesson instructions.'],
                            expectedOutput: 'Output',
                            commonMistakes: ['Syntax error.'],
                            tryItYourself: 'Run in sandbox.',
                            starterCode: 'print("Hello")\n',
                            practiceQuestion: 'What is the purpose of this topic?'
                          };

                          return (
                            <div
                              key={topic.topicNumber}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.8rem 1rem',
                                borderRadius: '10px',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-default)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    backgroundColor: completed ? 'rgba(5, 150, 105, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                    color: completed ? '#059669' : 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {completed ? <Check size={14} strokeWidth={3} /> : <Circle size={10} />}
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {topic.topicNumber}. {topic.title}
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                    {topic.description}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                  onClick={() => setActiveLessonModal({ unit, topic, lesson })}
                                  className="btn-primary"
                                  style={{
                                    padding: '0.35rem 0.8rem',
                                    fontSize: '0.78rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <BookOpen size={13} />
                                  <span>Open Lesson</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Linked Homework Section */}
        <div style={{ marginTop: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileCheck2 size={18} color="var(--accent-primary)" />
            Assigned Homework for {selectedSubject.name}
          </h2>

          {subjectHw.length === 0 ? (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              No active homework assigned for this subject yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {subjectHw.map((hw) => (
                <div
                  key={hw.id || hw._id}
                  className="card"
                  style={{
                    padding: '1.15rem 1.4rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                      {hw.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Due: {hw.dueDate} • {hw.points || 20} Marks
                    </div>
                    {hw.feedback && (
                      <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: '4px' }}>
                        Feedback: {hw.feedback}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor:
                          hw.status === 'graded'
                            ? 'rgba(5, 150, 105, 0.12)'
                            : hw.status === 'submitted'
                            ? 'rgba(37, 99, 235, 0.12)'
                            : 'rgba(217, 119, 6, 0.12)',
                        color:
                          hw.status === 'graded'
                            ? '#059669'
                            : hw.status === 'submitted'
                            ? '#2563EB'
                            : '#D97706'
                      }}
                    >
                      {hw.status === 'graded'
                        ? `Graded: ${hw.score || 20}/${hw.points || 20}`
                        : hw.status === 'submitted'
                        ? 'Submitted'
                        : 'Pending'}
                    </span>

                    {hw.status === 'pending' && (
                      <button
                        onClick={() => onOpenHomeworkModal && onOpenHomeworkModal(hw)}
                        className="btn-primary"
                        style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                      >
                        Submit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Study Materials & Handouts for this Subject */}
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="#2563EB" />
              Study Materials & Handouts for {selectedSubject.name}
            </h2>
            <button
              onClick={() => setActiveTab('materials')}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
            >
              View All Study Materials →
            </button>
          </div>

          {subjectMaterials.length === 0 ? (
            <div className="card" style={{ padding: '1.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              No study materials or lecture notes have been uploaded for {selectedSubject.name} yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {subjectMaterials.map((mat) => {
                const file = mat.files && mat.files[0];
                const fileSize = file?.size ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : null;

                return (
                  <div
                    key={mat.id || mat._id}
                    className="card"
                    style={{
                      padding: '1.15rem 1.4rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <FileText size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                          {mat.title}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {mat.resourceType || 'Study Guide'} · {file ? `${file.originalName} (${fileSize || 'File'})` : 'Note'} · Published {new Date(mat.createdAt || Date.now()).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {file && (
                      <button
                        onClick={() => handleDownloadSubjectMaterial(mat)}
                        disabled={downloadingMatId === mat.id}
                        className="btn-primary"
                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Download size={14} className={downloadingMatId === mat.id ? 'spin' : ''} />
                        <span>{downloadingMatId === mat.id ? 'Authorizing...' : 'Download'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            2. INTERACTIVE LESSON VIEWER MODAL (10-STEP REAL SCHOOL LESSON FORMAT)
           ───────────────────────────────────────────────────────────────────────────── */}
        {activeLessonModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem'
            }}
            onClick={() => setActiveLessonModal(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '780px',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: '20px',
                padding: '2rem',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.4rem'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: '#2563EB',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}
                  >
                    UNIT {activeLessonModal.unit.unitNumber} • TOPIC {activeLessonModal.topic.topicNumber}
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0 2px', color: 'var(--text-primary)' }}>
                    {activeLessonModal.topic.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    {activeLessonModal.lesson.title || activeLessonModal.topic.description}
                  </p>
                </div>

                <button
                  onClick={() => setActiveLessonModal(null)}
                  className="btn-icon"
                  style={{ width: '34px', height: '34px', color: 'var(--text-secondary)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Step 1 & 2: What is this & Why do we use it */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1rem'
                }}
              >
                <div
                  style={{
                    padding: '1.1rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.35rem' }}>
                    1. WHAT IS THIS?
                  </div>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {activeLessonModal.lesson.whatIsIt}
                  </p>
                </div>

                <div
                  style={{
                    padding: '1.1rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#059669', marginBottom: '0.35rem' }}>
                    2. WHY DO WE USE IT?
                  </div>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {activeLessonModal.lesson.whyUseIt}
                  </p>
                </div>
              </div>

              {/* Step 3: Basic Syntax */}
              {activeLessonModal.lesson.syntax && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    3. BASIC SYNTAX
                  </div>
                  <pre
                    style={{
                      backgroundColor: '#0F172A',
                      color: '#38BDF8',
                      padding: '0.9rem 1.1rem',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-mono)',
                      margin: 0,
                      overflowX: 'auto'
                    }}
                  >
                    {activeLessonModal.lesson.syntax}
                  </pre>
                </div>
              )}

              {/* Step 4: Simple Example & Code Pattern */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    4. SIMPLE CODE EXAMPLE
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeLessonModal.lesson.example);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCode ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                    <span>{copiedCode ? 'Copied' : 'Copy Example'}</span>
                  </button>
                </div>
                <pre
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#93C5FD',
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    fontSize: '0.86rem',
                    fontFamily: 'var(--font-mono)',
                    margin: 0,
                    overflowX: 'auto',
                    border: '1px solid #1E293B'
                  }}
                >
                  {activeLessonModal.lesson.example}
                </pre>
              </div>

              {/* Step 5: Line-by-Line Explanation */}
              {activeLessonModal.lesson.explanation && activeLessonModal.lesson.explanation.length > 0 && (
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    5. LINE-BY-LINE EXPLANATION
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {activeLessonModal.lesson.explanation.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Step 6: Expected Output */}
              {activeLessonModal.lesson.expectedOutput && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Terminal size={14} color="#059669" />
                    <span>6. EXPECTED OUTPUT</span>
                  </div>
                  <pre
                    style={{
                      backgroundColor: '#020617',
                      color: '#4ADE80',
                      padding: '0.85rem 1.1rem',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontFamily: 'var(--font-mono)',
                      margin: 0,
                      border: '1px solid #1E293B'
                    }}
                  >
                    {activeLessonModal.lesson.expectedOutput}
                  </pre>
                </div>
              )}

              {/* Step 7: Common Mistakes */}
              {activeLessonModal.lesson.commonMistakes && activeLessonModal.lesson.commonMistakes.length > 0 && (
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#DC2626', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertCircle size={15} color="#DC2626" />
                    <span>7. COMMON MISTAKES TO AVOID</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {activeLessonModal.lesson.commonMistakes.map((m, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Step 8 & 9: Try It Yourself & Practice Question */}
              <div
                style={{
                  padding: '1.1rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(37, 99, 235, 0.06)',
                  border: '1px solid rgba(37, 99, 235, 0.2)'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB', marginBottom: '0.35rem' }}>
                  8. TRY IT YOURSELF & PRACTICE ACTIVITY
                </div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  {activeLessonModal.lesson.tryItYourself}
                </p>
                {activeLessonModal.lesson.practiceQuestion && (
                  <p style={{ margin: '0', fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Challenge Question: {activeLessonModal.lesson.practiceQuestion}
                  </p>
                )}
              </div>

              {/* Step 10: Action Footer (Mark as Completed) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Status: {isTopicCompleted(activeLessonModal.unit.unitNumber, activeLessonModal.topic.topicNumber) ? (
                    <strong style={{ color: '#059669' }}>Completed ✓</strong>
                  ) : (
                    <span>In Progress</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => setActiveLessonModal(null)}
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                  >
                    Close Lesson
                  </button>

                  <button
                    onClick={() => {
                      handleCompleteTopic(
                        activeLessonModal.unit.unitNumber,
                        activeLessonModal.topic.topicNumber,
                        activeLessonModal.topic.title
                      );
                    }}
                    disabled={isCompletingTopic}
                    className="btn-primary"
                    style={{
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      backgroundColor: isTopicCompleted(activeLessonModal.unit.unitNumber, activeLessonModal.topic.topicNumber) ? '#059669' : '#2563EB',
                      borderColor: isTopicCompleted(activeLessonModal.unit.unitNumber, activeLessonModal.topic.topicNumber) ? '#059669' : '#2563EB'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>
                      {isCompletingTopic
                        ? 'Saving...'
                        : isTopicCompleted(activeLessonModal.unit.unitNumber, activeLessonModal.topic.topicNumber)
                        ? 'Topic Completed ✓'
                        : 'Mark Topic as Completed'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showHelp && (
          <SchoolContextualHelpModal
            section="subjects"
            onClose={() => setShowHelp(false)}
          />
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. MAIN VIEW: Real Subject Cards Grid
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              My Subjects
            </h1>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.6rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563EB'
              }}
            >
              {user?.className || user?.batchName || 'Academic Cohort'}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Authorized technical curriculum, structured lesson units, and current teaching topics.
          </p>
        </div>

        <button
          onClick={() => setShowHelp(true)}
          className="btn-icon"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)'
          }}
          title="Subjects Guidance"
        >
          <HelpCircle size={17} />
        </button>
      </div>

      {/* Grid of Subject Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.4rem'
        }}
      >
        {(!schoolSubjects || schoolSubjects.length === 0) ? (
          <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center', gridColumn: '1 / -1' }}>
            <BookOpen size={38} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
              No subjects have been assigned yet.
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              When your educator configures a subject for your cohort, it will appear here.
            </p>
          </div>
        ) : (
          schoolSubjects.map((sub) => {
          const currentT = sub.currentTeachingTopic;
          return (
            <div
              key={sub.id || sub._id}
              className="card"
              onClick={() => handleSelectSubject(sub)}
              style={{
                padding: '1.6rem',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                position: 'relative'
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>{sub.icon || '📚'}</span>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: sub.color || '#2563EB', fontFamily: 'var(--font-mono)' }}>
                        {sub.code || 'SUB-101'}
                      </div>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        {sub.name}
                      </h2>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: sub.progress > 0 ? '#059669' : 'var(--text-muted)'
                    }}
                  >
                    {sub.progress}%
                  </span>
                </div>

                {/* Teacher and Room */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <User size={13} color="var(--text-muted)" />
                    <span>Educator: <strong>{sub.teacher}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={13} color="var(--text-muted)" />
                    <span>Room: <strong>{sub.room}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={13} color="var(--text-muted)" />
                    <span>Next Class: <strong>{sub.nextClass}</strong></span>
                  </div>
                </div>

                {/* Current Teaching Topic Card */}
                {currentT ? (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      marginBottom: '1rem',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div style={{ color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '2px' }}>
                      Current Topic: Unit {currentT.unitNumber}
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {currentT.topicTitle}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px dashed var(--border-default)',
                      marginBottom: '1rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    Syllabus active • Click to view units
                  </div>
                )}
              </div>

              {/* Progress Bar & Footer */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  <span>{sub.completedTopicsCount != null ? `${sub.completedTopicsCount}/${sub.totalTopicsCount} topics completed` : 'Curriculum progress'}</span>
                  <span>{sub.pendingHomeworkCount ? `${sub.pendingHomeworkCount} homework due` : 'No pending tasks'}</span>
                </div>
                <div className="progress-bar-bg" style={{ height: '6px', marginBottom: '0.85rem' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${sub.progress || 0}%`,
                      backgroundColor: sub.progress > 0 ? '#059669' : 'var(--border-default)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    Open Curriculum
                  </span>
                  <ChevronRight size={16} color="var(--accent-primary)" />
                </div>
              </div>
            </div>
          );
        }))}
      </div>

      {showHelp && (
        <SchoolContextualHelpModal
          section="subjects"
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};
