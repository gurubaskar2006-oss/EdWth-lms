import React, { useState, useMemo } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  CalendarDays,
  Clock,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  Columns3,
  User,
  X,
  BookOpen,
  AlertCircle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  BookmarkPlus
} from 'lucide-react';

export const ScheduleView = ({ onOpenAddEvent }) => {
  usePageTitle('Academic Schedule');
  const { events, eventFilter, setEventFilter, createStudyNote, addToast, user } = useLMS();

  // Calendar View Mode: 'month', 'week', 'agenda'
  const [calendarView, setCalendarView] = useState('month');

  // Month navigation (Defaults to August 2026 for academic term context)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(7); // 0-indexed: 7 = August

  // Selected Day & Active Event for Contextual Drawer
  const [selectedDateStr, setSelectedDateStr] = useState('2026-08-15');
  const [activeEventDetail, setActiveEventDetail] = useState(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Month Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(7);
    setSelectedDateStr('2026-08-15');
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (eventFilter === 'all') return true;
      if (eventFilter === 'deadline') return e.type === 'deadline' || e.type === 'assignment';
      return e.type === eventFilter;
    });
  }, [events, eventFilter]);

  // Event Styling Map (Restrained Semantic Palette)
  const getEventStyle = (type) => {
    switch (type) {
      case 'lecture':
        return {
          bg: 'rgba(5, 150, 105, 0.08)',
          border: '#059669',
          text: '#047857',
          label: 'Lecture'
        };
      case 'deadline':
      case 'assignment':
        return {
          bg: 'rgba(220, 38, 38, 0.08)',
          border: '#DC2626',
          text: '#B91C1C',
          label: 'Deadline'
        };
      case 'exam':
        return {
          bg: 'rgba(217, 119, 6, 0.08)',
          border: '#D97706',
          text: '#B45309',
          label: 'Exam'
        };
      case 'study':
        return {
          bg: 'rgba(99, 102, 241, 0.08)',
          border: '#6366F1',
          text: '#4F46E5',
          label: 'Study Block'
        };
      case 'workshop':
        return {
          bg: 'rgba(37, 99, 235, 0.08)',
          border: '#2563EB',
          text: '#1D4ED8',
          label: 'Workshop'
        };
      default:
        return {
          bg: 'rgba(100, 116, 139, 0.08)',
          border: '#64748B',
          text: '#475569',
          label: 'Academic'
        };
    }
  };

  // Calculate calendar grid days for current month
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells = [];

    // Trailing days from previous month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({ day: dayNum, isCurrentMonth: false, dateStr, dayOfWeek: (firstDayOfMonth - 1 - i + 7) % 7 });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(currentYear, currentMonth, d).getDay();
      cells.push({ day: d, isCurrentMonth: true, dateStr, dayOfWeek: dow });
    }

    // Leading days from next month
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      const dow = new Date(nextYear, nextMonthIdx, n).getDay();
      cells.push({ day: n, isCurrentMonth: false, dateStr, dayOfWeek: dow });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Calculate Week Days based on selectedDateStr
  const currentWeekDays = useMemo(() => {
    const selectedDate = new Date(`${selectedDateStr}T00:00:00`);
    const dayOfWeek = selectedDate.getDay(); // 0 is Sun
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - dayOfWeek);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      week.push({
        date: d,
        dateStr: dStr,
        dayName: daysOfWeek[i],
        dayNum: d.getDate(),
        isToday: dStr === '2026-08-15',
        isSelected: dStr === selectedDateStr,
        isWeekend: i === 0 || i === 6
      });
    }
    return week;
  }, [selectedDateStr]);

  // Upcoming Milestones (chronologically sorted from today forward)
  const upcomingMilestones = useMemo(() => {
    const todayStr = '2026-08-15';
    return [...events]
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .slice(0, 5);
  }, [events]);

  const handleSaveToNotes = (evt) => {
    if (createStudyNote) {
      createStudyNote({
        title: `${evt.courseCode}: ${evt.title} - Session Notes`,
        category: evt.courseCode,
        color: 'emerald',
        content: `### Session: ${evt.title}\n- **Course**: ${evt.courseCode}\n- **Date**: ${evt.date}\n- **Time**: ${evt.startTime} - ${evt.endTime}\n- **Location**: ${evt.location || 'Online'}\n- **Instructor**: ${evt.instructor || 'Staff'}\n\n#### Key Takeaways:\n- \n- \n`
      });
      addToast('Saved to Notebook', `Session outline added to Notes.`, 'emerald');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ─── 1. ACADEMIC SCHEDULE WORKSPACE HEADER ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '0.25rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: 'var(--accent-blue)',
                textTransform: 'uppercase'
              }}
            >
              Academic Workspace
            </span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>• Fall Term 2026</span>
          </div>
          <h2 style={{ fontSize: '1.65rem', color: 'var(--text-primary)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Academic Schedule
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: '0.25rem 0 0 0' }}>
            Your academic timeline for classes, assignments, exams, deadlines and important activities.
          </p>
        </div>

        {/* Header Right: View Switcher (Month, Week, Agenda) + Add Event */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '3px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <button
              onClick={() => setCalendarView('month')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0.38rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                fontWeight: calendarView === 'month' ? 700 : 500,
                backgroundColor: calendarView === 'month' ? 'var(--accent-blue-subtle)' : 'transparent',
                color: calendarView === 'month' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: calendarView === 'month' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
                transition: 'all var(--transition-fast)'
              }}
            >
              <CalendarIcon size={13} />
              <span>Month</span>
            </button>

            <button
              onClick={() => setCalendarView('week')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0.38rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                fontWeight: calendarView === 'week' ? 700 : 500,
                backgroundColor: calendarView === 'week' ? 'var(--accent-blue-subtle)' : 'transparent',
                color: calendarView === 'week' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: calendarView === 'week' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
                transition: 'all var(--transition-fast)'
              }}
            >
              <Columns3 size={13} />
              <span>Week</span>
            </button>

            <button
              onClick={() => setCalendarView('agenda')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0.38rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                fontWeight: calendarView === 'agenda' ? 700 : 500,
                backgroundColor: calendarView === 'agenda' ? 'var(--accent-blue-subtle)' : 'transparent',
                color: calendarView === 'agenda' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: calendarView === 'agenda' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
                transition: 'all var(--transition-fast)'
              }}
            >
              <List size={13} />
              <span>Agenda</span>
            </button>
          </div>

          {(user?.role === 'trainer' || user?.role === 'admin' || onOpenAddEvent) && (
            <button
              onClick={onOpenAddEvent}
              className="btn-primary"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem', gap: '5px' }}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Schedule Event</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. TIMELINE NAVIGATION & CATEGORY FILTER STRIP ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.7rem 1.15rem',
          flexWrap: 'wrap',
          gap: '0.85rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Month Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <button
              onClick={handlePrevMonth}
              className="btn-icon"
              style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-md)' }}
              title="Previous month"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={handleNextMonth}
              className="btn-icon"
              style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-md)' }}
              title="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
            {monthNames[currentMonth]} {currentYear}
          </h3>

          <button
            onClick={handleJumpToday}
            className="btn-secondary"
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-surface)'
            }}
          >
            Today
          </button>
        </div>

        {/* Event Type Filter Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Activities' },
            { id: 'lecture', label: 'Lectures' },
            { id: 'deadline', label: 'Deadlines' },
            { id: 'exam', label: 'Exams' },
            { id: 'study', label: 'Study Blocks' },
            { id: 'workshop', label: 'Workshops' }
          ].map((f) => {
            const isSelected = eventFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setEventFilter(f.id)}
                style={{
                  padding: '0.28rem 0.7rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.74rem',
                  fontWeight: isSelected ? 700 : 500,
                  backgroundColor: isSelected ? 'var(--accent-blue)' : 'var(--bg-surface)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 3. WORKSPACE BODY: MAIN CALENDAR + RESPONSIVE UPCOMING TIMELINE ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: '1.25rem',
          alignItems: 'start'
        }}
        className="calendar-layout-wrapper"
      >
        {/* MAIN CALENDAR AREA */}
        <div style={{ minWidth: 0 }}>
          {/* VIEW: MONTH GRID */}
          {calendarView === 'month' && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-card)'
              }}
            >
              {/* Day Headers (Sun-Sat) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  borderBottom: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  textAlign: 'center',
                  padding: '0.6rem 0'
                }}
              >
                {daysOfWeek.map((day, i) => {
                  const isWeekend = i === 0 || i === 6;
                  return (
                    <div
                      key={day}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: isWeekend ? 'var(--text-muted)' : 'var(--accent-blue)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

              {/* Day Cells Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  backgroundColor: 'var(--border-default)',
                  gap: '1px'
                }}
              >
                {calendarCells.map((cell, idx) => {
                  const isSelected = cell.dateStr === selectedDateStr;
                  const isToday = cell.dateStr === '2026-08-15';
                  const isWeekend = cell.dayOfWeek === 0 || cell.dayOfWeek === 6;
                  const dayEvents = filteredEvents.filter((e) => e.date === cell.dateStr);

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDateStr(cell.dateStr)}
                      style={{
                        minHeight: '115px',
                        padding: '0.5rem',
                        backgroundColor: isSelected
                          ? 'var(--accent-blue-subtle)'
                          : !cell.isCurrentMonth
                          ? '#F8FAFC'
                          : isWeekend
                          ? '#FAFBFD'
                          : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        transition: 'background-color var(--transition-fast)',
                        position: 'relative',
                        outline: isSelected ? '2px solid var(--accent-blue)' : 'none',
                        outlineOffset: '-2px',
                        zIndex: isSelected ? 2 : 1
                      }}
                    >
                      {/* Top Day Number & Today indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: isToday || isSelected ? 800 : 500,
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isToday
                              ? 'var(--accent-blue)'
                              : isSelected
                              ? 'rgba(37, 99, 235, 0.15)'
                              : 'transparent',
                            color: isToday
                              ? '#FFFFFF'
                              : isSelected
                              ? 'var(--accent-blue)'
                              : cell.isCurrentMonth
                              ? isWeekend
                                ? 'var(--text-secondary)'
                                : 'var(--text-primary)'
                              : 'var(--text-muted)'
                          }}
                        >
                          {cell.day}
                        </span>

                        {isToday && (
                          <span style={{ fontSize: '0.62rem', color: 'var(--accent-blue)', fontWeight: 800, letterSpacing: '0.04em' }}>
                            TODAY
                          </span>
                        )}
                      </div>

                      {/* Event Cards inside cell */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                        {dayEvents.slice(0, 2).map((evt) => {
                          const style = getEventStyle(evt.type);
                          return (
                            <div
                              key={evt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDateStr(cell.dateStr);
                                setActiveEventDetail(evt);
                              }}
                              style={{
                                fontSize: '0.68rem',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                backgroundColor: style.bg,
                                borderLeft: `3px solid ${style.border}`,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'transform 0.1s ease'
                              }}
                              title={`${evt.courseCode} — ${evt.title} (${evt.startTime})`}
                            >
                              <span style={{ color: style.border, marginRight: '4px', fontWeight: 700 }}>
                                {evt.courseCode}
                              </span>
                              <span>{evt.title.replace(`${evt.courseCode}: `, '')}</span>
                            </div>
                          );
                        })}

                        {dayEvents.length > 2 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateStr(cell.dateStr);
                              // Open first event or prompt detail
                              setActiveEventDetail(dayEvents[0]);
                            }}
                            style={{
                              fontSize: '0.64rem',
                              color: 'var(--accent-blue)',
                              fontWeight: 700,
                              paddingLeft: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            +{dayEvents.length - 2} more...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: WEEK TIMELINE */}
          {calendarView === 'week' && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-card)'
              }}
            >
              {/* Week Columns Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  borderBottom: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)'
                }}
              >
                {currentWeekDays.map((day) => (
                  <div
                    key={day.dateStr}
                    onClick={() => setSelectedDateStr(day.dateStr)}
                    style={{
                      padding: '0.75rem 0.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderRight: '1px solid var(--border-subtle)',
                      backgroundColor: day.isSelected ? 'var(--accent-blue-subtle)' : 'transparent'
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: day.isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {day.dayName}
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: day.isToday ? 'var(--accent-blue)' : 'transparent',
                        color: day.isToday ? '#FFFFFF' : day.isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                        fontWeight: day.isToday || day.isSelected ? 800 : 600,
                        fontSize: '0.92rem',
                        marginTop: '3px'
                      }}
                    >
                      {day.dayNum}
                    </div>
                  </div>
                ))}
              </div>

              {/* Week Day Event Columns */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  backgroundColor: 'var(--border-default)',
                  gap: '1px',
                  minHeight: '380px'
                }}
              >
                {currentWeekDays.map((day) => {
                  const dayEvents = filteredEvents.filter((e) => e.date === day.dateStr);

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDateStr(day.dateStr)}
                      style={{
                        backgroundColor: day.isSelected
                          ? 'var(--accent-blue-subtle)'
                          : day.isWeekend
                          ? '#FAFBFD'
                          : '#FFFFFF',
                        padding: '0.65rem 0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      {dayEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0.25rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          No events
                        </div>
                      ) : (
                        dayEvents.map((evt) => {
                          const style = getEventStyle(evt.type);
                          return (
                            <div
                              key={evt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveEventDetail(evt);
                              }}
                              style={{
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: style.bg,
                                borderLeft: `3px solid ${style.border}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px'
                              }}
                            >
                              <span style={{ fontSize: '0.64rem', fontWeight: 800, color: style.border }}>
                                {evt.courseCode}
                              </span>
                              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                                {evt.title}
                              </div>
                              <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                <Clock size={11} />
                                <span>{evt.startTime}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: AGENDA CHRONOLOGICAL LIST */}
          {calendarView === 'agenda' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredEvents.length === 0 ? (
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}
                >
                  <CalendarDays size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
                    No events matching filter
                  </h4>
                  <p style={{ fontSize: '0.84rem', margin: '0.25rem 0 0' }}>
                    Try selecting a different filter category above.
                  </p>
                </div>
              ) : (
                filteredEvents.map((evt) => {
                  const style = getEventStyle(evt.type);
                  const dateObj = new Date(`${evt.date}T00:00:00`);

                  return (
                    <div
                      key={evt.id}
                      onClick={() => setActiveEventDetail(evt)}
                      className="card card-interactive"
                      style={{
                        padding: '0.9rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        borderRadius: 'var(--radius-lg)',
                        borderLeft: `4px solid ${style.border}`,
                        backgroundColor: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        {/* Date Mini Block */}
                        <div style={{ textAlign: 'center', minWidth: '48px' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                            {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                          <div style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 800, lineHeight: 1.1 }}>
                            {dateObj.getDate()}
                          </div>
                        </div>

                        {/* Title & Tags */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '3px',
                                backgroundColor: style.bg,
                                color: style.border
                              }}
                            >
                              {evt.courseCode}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: style.text, fontWeight: 700 }}>
                              • {style.label}
                            </span>
                          </div>
                          <h4 style={{ fontSize: '0.94rem', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
                            {evt.title}
                          </h4>
                        </div>
                      </div>

                      {/* Time & Location meta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} color="var(--accent-blue)" />
                          <span>{evt.startTime} - {evt.endTime}</span>
                        </div>
                        {evt.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={13} />
                            <span>{evt.location}</span>
                          </div>
                        )}
                        <ArrowRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ─── 4. UPCOMING ACADEMIC MILESTONES (Supporting Sidebar) ─── */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Upcoming Milestones
              </span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Next 14 Days</span>
          </div>

          {/* List of upcoming items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {upcomingMilestones.map((milestone) => {
              const style = getEventStyle(milestone.type);
              const mDate = new Date(`${milestone.date}T00:00:00`);

              return (
                <div
                  key={milestone.id}
                  onClick={() => {
                    setSelectedDateStr(milestone.date);
                    setActiveEventDetail(milestone);
                  }}
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface)',
                    borderLeft: `3px solid ${style.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: style.border }}>
                      {milestone.courseCode} • {style.label}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                    {milestone.title}
                  </div>

                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} />
                    <span>{milestone.startTime}</span>
                    {milestone.location && (
                      <>
                        <span>•</span>
                        <span>{milestone.location}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              💡 <strong>Workspace Tip:</strong> Click any event card in the calendar to view full classroom details or push notes to your notebook.
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. INTERACTIVE EVENT DETAIL SLIDE-OUT DRAWER ─── */}
      {activeEventDetail && (
        <div
          className="modal-overlay"
          onClick={() => setActiveEventDetail(null)}
          style={{ backdropFilter: 'blur(3px)' }}
        >
          <div
            className="modal-content"
            style={{ maxWidth: '520px', padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Type & Course */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: getEventStyle(activeEventDetail.type).bg,
                    color: getEventStyle(activeEventDetail.type).border
                  }}
                >
                  {activeEventDetail.courseCode}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {getEventStyle(activeEventDetail.type).label}
                </span>
              </div>

              <button
                onClick={() => setActiveEventDetail(null)}
                className="btn-icon"
                style={{ width: '28px', height: '28px' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Event Title */}
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.3 }}>
              {activeEventDetail.title}
            </h3>

            {/* Detail Spec Matrix */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.15rem',
                fontSize: '0.84rem',
                color: 'var(--text-secondary)',
                marginBottom: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarDays size={16} color="var(--accent-blue)" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {new Date(`${activeEventDetail.date}T00:00:00`).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={16} color="var(--accent-blue)" />
                <span>{activeEventDetail.startTime} - {activeEventDetail.endTime}</span>
              </div>

              {activeEventDetail.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MapPin size={16} color="#D97706" />
                  <span>{activeEventDetail.location}</span>
                </div>
              )}

              {activeEventDetail.instructor && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <User size={16} color="var(--accent-primary)" />
                  <span>Faculty: {activeEventDetail.instructor}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <button
                onClick={() => handleSaveToNotes(activeEventDetail)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
              >
                <BookmarkPlus size={14} color="var(--accent-indigo)" />
                <span>Send to Notes</span>
              </button>

              <button
                onClick={() => setActiveEventDetail(null)}
                className="btn-primary"
                style={{ padding: '0.45rem 1.15rem', fontSize: '0.82rem' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
