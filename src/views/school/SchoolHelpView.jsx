import React, { useState, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { HelpCircle, Send, MessageSquare, Phone, Mail, CheckCircle2, User, AlertCircle, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { socketService } from '../../services/socketService';

export const SchoolHelpView = () => {
  usePageTitle('Help & Support');
  const { schoolSubjects, addToast, triggerConfetti } = useLMS();

  // Selected teacher & form fields
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');

  // Questions / Doubts state
  const [sentQuestions, setSentQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [questionsError, setQuestionsError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // School Academic Contacts state
  const [contactsData, setContactsData] = useState({ configured: false, contacts: null });
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Set default selected teacher when school subjects load
  useEffect(() => {
    if (schoolSubjects && schoolSubjects.length > 0 && !selectedTeacher) {
      const firstWithTeacher = schoolSubjects.find((s) => s.teacher);
      if (firstWithTeacher) {
        setSelectedTeacher(`${firstWithTeacher.teacher} (${firstWithTeacher.name || firstWithTeacher.title})`);
      }
    }
  }, [schoolSubjects, selectedTeacher]);

  // Load real student doubts from backend
  const loadQuestions = async () => {
    setLoadingQuestions(true);
    setQuestionsError(null);
    try {
      const res = await apiService.getStudentDoubts();
      if (res?.success && Array.isArray(res.doubts)) {
        setSentQuestions(res.doubts);
        setQuestionsError(null);
      } else {
        setQuestionsError(res?.message || 'Failed to retrieve your questions.');
      }
    } catch (err) {
      setQuestionsError('Network error loading questions.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Load genuine school contacts from backend
  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await apiService.getSchoolAcademicContacts();
      if (res?.success) {
        setContactsData({
          configured: Boolean(res.configured),
          contacts: res.contacts || null
        });
      } else {
        setContactsData({ configured: false, contacts: null });
      }
    } catch (err) {
      setContactsData({ configured: false, contacts: null });
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadQuestions();
    loadContacts();

    const unsub = socketService.onDoubtAnswered(() => {
      addToast('Teacher Replied', 'A faculty reply has been posted to your question.', 'emerald');
      loadQuestions();
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!question.trim()) {
      addToast('Validation Notice', 'Please describe your question or difficulty.', 'amber');
      return;
    }
    if (question.trim().length < 5) {
      addToast('Validation Notice', 'Question must be at least 5 characters.', 'amber');
      return;
    }
    if (!topic.trim()) {
      addToast('Validation Notice', 'Please enter a Topic or Chapter.', 'amber');
      return;
    }

    setIsSubmitting(true);
    try {
      const teacherName = selectedTeacher.split('(')[0].trim();
      const matchedSubject = (schoolSubjects || []).find((s) =>
        selectedTeacher.includes(s.name) || selectedTeacher.includes(s.title)
      );

      const payload = {
        teacherName: teacherName || 'Subject Teacher',
        subject: matchedSubject ? (matchedSubject.name || matchedSubject.title) : 'General Academic Doubt',
        topic: topic.trim(),
        question: question.trim()
      };

      if (matchedSubject?.teacherId || matchedSubject?.instructorId) {
        payload.teacherId = matchedSubject.teacherId || matchedSubject.instructorId;
      }

      const res = await apiService.submitStudentDoubt(payload);
      if (res?.success) {
        const newDoubt = res.doubt || {
          id: Date.now().toString(),
          teacher: teacherName,
          topic: topic.trim(),
          question: question.trim(),
          status: 'Submitted',
          response: null
        };
        setSentQuestions((prev) => [newDoubt, ...prev]);
        setQuestion('');
        setTopic('');
        triggerConfetti();
        addToast('Message Sent to Teacher', 'Your question has been delivered to your teacher.', 'emerald');
      } else {
        addToast('Error', res?.message || 'Failed to submit question.', 'rose');
      }
    } catch (err) {
      addToast('Network Error', 'Could not send question to server. Please try again.', 'rose');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
          Help & Teacher Doubts
        </h1>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Ask your assigned subject teacher questions and get guidance on homework or lessons
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Send Question Form */}
        <div
          className="card"
          style={{
            padding: '1.75rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Ask a Teacher
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Direct message to your assigned subject teacher
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Select Assigned Teacher
              </label>
              {(schoolSubjects || []).length > 0 ? (
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', fontSize: '0.88rem' }}
                >
                  {(schoolSubjects || []).map((sub) => {
                    const label = sub.teacher
                      ? `${sub.teacher} (${sub.name || sub.title})`
                      : `${sub.name || sub.title}`;
                    return (
                      <option key={sub.id || sub._id} value={label}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  placeholder="Enter teacher name or subject"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', fontSize: '0.88rem' }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Topic / Chapter
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Chapter 4 Quadratic Equations Question 5"
                required
                maxLength={200}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Your Question or Difficulty
              </label>
              <textarea
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Explain what part is confusing or what you tried..."
                required
                maxLength={2000}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', fontSize: '0.88rem', resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                padding: '0.75rem',
                borderRadius: '10px',
                backgroundColor: '#2563EB',
                borderColor: '#2563EB',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                fontSize: '0.9rem'
              }}
            >
              <Send size={16} />
              <span>{isSubmitting ? 'Sending Question...' : 'Send Message to Teacher'}</span>
            </button>
          </form>
        </div>

        {/* School Help & Emergency Desk */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            className="card"
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.85rem', color: 'var(--text-primary)' }}>
              School Academic Contacts
            </h3>

            {loadingContacts ? (
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Loading contact details...</div>
            ) : contactsData.configured && contactsData.contacts ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.86rem' }}>
                {contactsData.contacts.helpline ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-secondary)' }}>
                    <Phone size={16} color="#059669" />
                    <span>Helpline: <strong>{contactsData.contacts.helpline}</strong></span>
                  </div>
                ) : null}
                {contactsData.contacts.email ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-secondary)' }}>
                    <Mail size={16} color="#2563EB" />
                    <span>Academic Office: <strong>{contactsData.contacts.email}</strong></span>
                  </div>
                ) : null}
                {contactsData.contacts.counselor ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-secondary)' }}>
                    <User size={16} color="#7C3AED" />
                    <span>Student Counselor: <strong>{contactsData.contacts.counselor}</strong></span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                <AlertCircle size={16} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span>Contact details not configured. Please contact your school administrator.</span>
              </div>
            )}
          </div>

          {/* Past Doubts List */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Recent Questions & Replies
              </h3>
              <button
                onClick={loadQuestions}
                disabled={loadingQuestions}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <RefreshCw size={13} className={loadingQuestions ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {questionsError ? (
              <div style={{ padding: '1.25rem', textAlign: 'center', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ color: '#EF4444', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {questionsError}
                </div>
                <button onClick={loadQuestions} className="btn-primary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}>
                  Retry
                </button>
              </div>
            ) : loadingQuestions ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Loading your questions...
              </div>
            ) : sentQuestions.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '12px' }}>
                <CheckCircle2 size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  You haven't asked a question yet.
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Submit a doubt above and your teacher's response will appear here.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {sentQuestions.map((q) => {
                  const isAnswered = q.status === 'Answered';
                  const key = q.id || q._id;
                  return (
                    <div
                      key={key}
                      style={{
                        padding: '0.9rem',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563EB' }}>
                          To: {q.teacher || q.teacherName || 'Subject Teacher'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '6px',
                            backgroundColor: isAnswered ? 'rgba(5, 150, 105, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                            color: isAnswered ? '#059669' : '#D97706'
                          }}
                        >
                          {isAnswered ? 'Answered' : 'Awaiting teacher response'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {q.topic}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                        "{q.question}"
                      </p>
                      {isAnswered && (q.response || q.reply) ? (
                        <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.05)', padding: '0.45rem 0.65rem', borderRadius: '6px' }}>
                          <strong>Reply:</strong> {q.response || q.reply}
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Awaiting teacher response.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default SchoolHelpView;
