import React, { useState, useMemo } from 'react';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useLMS } from '../../context/LMSContext';
import {
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  User,
  Coffee,
  Info,
  HelpCircle,
  Award,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  List,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { SchoolContextualHelpModal } from '../../components/school/SchoolContextualHelpModal';

const ALL_WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const WEEKLY_TIMETABLE = {
  Monday: [
    { period: 1, time: '09:00 - 09:45 AM', subject: 'Python Programming', teacher: 'Mr. David Miller', room: 'Coding Lab 1' },
    { period: 2, time: '09:50 - 10:35 AM', subject: 'SQL & Relational Databases', teacher: 'Database Instructor', room: 'Database Studio' },
    { period: 'Break', time: '10:35 - 10:55 AM', subject: 'Morning Recess', isBreak: true },
    { period: 3, time: '10:55 - 11:40 AM', subject: 'C++ Fundamentals', teacher: 'Dr. Robert Vance', room: 'Systems Lab B' },
    { period: 4, time: '11:45 - 12:30 PM', subject: 'Algorithms & Logic Building', teacher: 'Mr. Alan Parker', room: 'Logic Hall 108' },
    { period: 'Lunch', time: '12:30 - 01:15 PM', subject: 'Lunch Break', isBreak: true },
    { period: 5, time: '01:15 - 02:00 PM', subject: 'Web Development (HTML/CSS/JS)', teacher: 'Ms. Clara Higgins', room: 'Web Studio' },
    { period: 6, time: '02:05 - 02:50 PM', subject: 'Hands-on Code Sandbox Practice', teacher: 'Faculty Mentors', room: 'Open Lab' }
  ],
  Tuesday: [
    { period: 1, time: '09:00 - 09:45 AM', subject: 'SQL & Relational Databases', teacher: 'Database Instructor', room: 'Database Studio' },
    { period: 2, time: '09:50 - 10:35 AM', subject: 'Python Programming', teacher: 'Mr. David Miller', room: 'Coding Lab 1' },
    { period: 'Break', time: '10:35 - 10:55 AM', subject: 'Morning Recess', isBreak: true },
    { period: 3, time: '10:55 - 11:40 AM', subject: 'C++ OOP & Memory', teacher: 'Dr. Robert Vance', room: 'Systems Lab B' },
    { period: 4, time: '11:45 - 12:30 PM', subject: 'Web Development (DOM & Events)', teacher: 'Ms. Clara Higgins', room: 'Web Studio' },
    { period: 'Lunch', time: '12:30 - 01:15 PM', subject: 'Lunch Break', isBreak: true },
    { period: 5, time: '01:15 - 02:00 PM', subject: 'Competitive Coding & Problem Solving', teacher: 'Mr. David Miller', room: 'Coding Lab 1' },
    { period: 6, time: '02:05 - 02:50 PM', subject: 'Database Schema Design Lab', teacher: 'Database Instructor', room: 'Database Studio' }
  ],
  Wednesday: [
    { period: 1, time: '09:00 - 09:45 AM', subject: 'C++ Fundamentals', teacher: 'Dr. Robert Vance', room: 'Systems Lab B' },
    { period: 2, time: '09:50 - 10:35 AM', subject: 'Python Programming', teacher: 'Mr. David Miller', room: 'Coding Lab 1' },
    { period: 'Break', time: '10:35 - 10:55 AM', subject: 'Morning Recess', isBreak: true },
    { period: 3, time: '10:55 - 11:40 AM', subject: 'SQL & Relational Databases', teacher: 'Database Instructor', room: 'Database Studio' },
    { period: 4, time: '11:45 - 12:30 PM', subject: 'Algorithms & Logic Building', teacher: 'Mr. Alan Parker', room: 'Logic Hall 108' },
    { period: 'Lunch', time: '12:30 - 01:15 PM', subject: 'Lunch Break', isBreak: true },
    { period: 5, time: '01:15 - 02:00 PM', subject: 'Web Development (Async & APIs)', teacher: 'Ms. Clara Higgins', room: 'Web Studio' },
    { period: 6, time: '02:05 - 02:50 PM', subject: 'Proctored Coding Test Preparation', teacher: 'Faculty Mentors', room: 'Coding Lab 1' }
  ],
  Thursday: [
    { period: 1, time: '09:00 - 09:45 AM', subject: 'Python Programming (Data Structures)', teacher: 'Mr. David Miller', room: 'Coding Lab 1' },
    { period: 2, time: '09:50 - 10:35 AM', subject: 'C++ Pointers & STL Lab', teacher: 'Dr. Robert Vance', room: 'Systems Lab B' },
    { period: 'Break', time: '10:35 - 10:55 AM', subject: 'Morning Recess', isBreak: true },
    { period: 3, time: '10:55 - 11:40 AM', subject: 'SQL Joins & Complex Queries', teacher: 'Database Instructor', room: 'Database Studio' },
    { period: 4, time: '11:45 - 12:30 PM', subject: 'Algorithms (Sorting & Searching)', teacher: 'Mr. Alan Parker', room: 'Logic Hall 108' },
    { period: 'Lunch', time: '12:30 - 01:15 PM', subject: 'Lunch Break', isBreak: true },
    { period: 5, time: '01:15 - 02:00 PM', subject: 'Responsive UI Design (CSS Grid)', teacher: 'Ms. Clara Higgins', room: 'Web Studio' },
    { period: 6, time: '02:05 - 02:50 PM', subject: 'Peer Code Review & Debugging', teacher: 'Various Mentors', room: 'Coding Lab 1' }
  ],
  Friday: [
    { period: 1, time: '09:00 - 09:45 AM', subject: 'SQL & Database Lab Practice', teacher: 'Database Instructor', room: 'Database Studio' },
    { period: 2, time: '09:50 - 10:35 AM', subject: 'Python Algorithmic Problem Solving', teacher: 'Mr. David Miller', room: 'Coding Lab 1' },
    { period: 'Break', time: '10:35 - 10:55 AM', subject: 'Morning Recess', isBreak: true },
    { period: 3, time: '10:55 - 11:40 AM', subject: 'Web Fullstack Integration', teacher: 'Ms. Clara Higgins', room: 'Web Studio' },
    { period: 4, time: '11:45 - 12:30 PM', subject: 'C++ Algorithms & Complexity', teacher: 'Dr. Robert Vance', room: 'Systems Lab B' },
    { period: 'Lunch', time: '12:30 - 01:15 PM', subject: 'Lunch Break', isBreak: true },
    { period: 5, time: '01:15 - 02:00 PM', subject: 'Weekly Proctored Benchmark Exam', teacher: 'Examination Committee', room: 'Examination Lab' },
    { period: 6, time: '02:05 - 02:50 PM', subject: 'Tech Showcase & Coding Awards', teacher: 'Academic Faculty', room: 'Auditorium' }
  ]
};

export const SchoolScheduleView = () => {
  usePageTitle('Schedule');
  const { portalConfig, schoolCalendarEvents, setActiveTab } = useLMS();
  const [showHelp, setShowHelp] = useState(false);

  // Active top tab: 'calendar' (authoritative dynamic events) | 'timetable' (bell schedule)
  const [activeTab, setLocalActiveTab] = useState('calendar');

  // Calendar View Mode: 'month' | 'week' | 'agenda'
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [eventTypeFilter, setEventTypeFilter] = useState('all');

  // Institution working days configuration
  const workingDays = useMemo(() => {
    return portalConfig?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  }, [portalConfig]);

  const todayDayName = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  }, []);

  const [selectedDay, setSelectedDay] = useState(() => {
    return workingDays.includes(todayDayName) ? todayDayName : (workingDays[0] || 'Monday');
  });

  const isSelectedDayWorkingDay = workingDays.includes(selectedDay);
  const isSelectedDayToday = selectedDay === todayDayName;
  const periods = WEEKLY_TIMETABLE[selectedDay] || [];

  // Local date formatting
  const formatYMD = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert raw calendar events into unified presentation items
  const calendarEvents = useMemo(() => {
    if (!Array.isArray(schoolCalendarEvents)) return [];

    return schoolCalendarEvents.map((ev) => {
      const isCancelled = ev.status === 'cancelled';
      const isTest = ev.eventType === 'test' || ev.eventType === 'exam';
      const isHw = ev.eventType === 'homework';
      const isAnnounce = ev.eventType === 'announcement';

      let type = 'class';
      let typeLabel = 'Class Session';
      let color = '#2563EB';
      let bgColor = 'rgba(37, 99, 235, 0.1)';
      let borderColor = 'rgba(37, 99, 235, 0.3)';

      if (isCancelled) {
        color = '#EF4444';
        bgColor = 'rgba(239, 68, 68, 0.12)';
        borderColor = 'rgba(239, 68, 68, 0.35)';
        typeLabel = 'Cancelled';
      } else if (isTest) {
        type = 'test';
        typeLabel = 'Test / Exam';
        color = '#7C3AED';
        bgColor = 'rgba(124, 58, 237, 0.1)';
        borderColor = 'rgba(124, 58, 237, 0.3)';
      } else if (isHw) {
        type = 'homework';
        typeLabel = 'Homework Due';
        color = '#D97706';
        bgColor = 'rgba(217, 119, 6, 0.1)';
        borderColor = 'rgba(217, 119, 6, 0.3)';
      } else if (isAnnounce) {
        type = 'announcement';
        typeLabel = 'Announcement';
        color = '#059669';
        bgColor = 'rgba(5, 150, 105, 0.1)';
        borderColor = 'rgba(5, 150, 105, 0.3)';
      }

      const rawDate = new Date(ev.startTime || ev.date || Date.now());
      const dateStr = formatYMD(rawDate);
      let timeStr = '10:00 AM';
      if (ev.startTime && ev.endTime) {
        timeStr = `${new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(ev.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (ev.time) {
        timeStr = ev.time;
      }

      return {
        id: ev.id || ev._id,
        type,
        typeLabel,
        title: ev.title,
        subject: ev.subject || '',
        dateStr,
        rawDate,
        time: timeStr,
        room: ev.room || 'Computer Lab 1',
        marks: ev.points || ev.totalMarks,
        status: ev.status || 'scheduled',
        isCancelled,
        cancellationReason: ev.cancellationReason || '',
        color,
        bgColor,
        borderColor,
        isProjected: Boolean(ev.isProjected),
        data: ev
      };
    });
  }, [schoolCalendarEvents]);

  // Filter events by type
  const filteredEvents = useMemo(() => {
    if (eventTypeFilter === 'classes') return calendarEvents.filter((e) => e.type === 'class');
    if (eventTypeFilter === 'tests') return calendarEvents.filter((e) => e.type === 'test');
    if (eventTypeFilter === 'homework') return calendarEvents.filter((e) => e.type === 'homework');
    if (eventTypeFilter === 'announcements') return calendarEvents.filter((e) => e.type === 'announcement');
    return calendarEvents;
  }, [calendarEvents, eventTypeFilter]);

  // Map events by dateStr
  const eventsByDate = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach((ev) => {
      if (!map.has(ev.dateStr)) map.set(ev.dateStr, []);
      map.get(ev.dateStr).push(ev);
    });
    return map;
  }, [filteredEvents]);

  const selectedDateYMD = formatYMD(selectedDate);
  const selectedDayEvents = eventsByDate.get(selectedDateYMD) || [];

  // Month navigation
  const prevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const nextD = new Date(selectedDate);
      nextD.setDate(nextD.getDate() - 7);
      setSelectedDate(nextD);
      setCurrentDate(nextD);
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const nextD = new Date(selectedDate);
      nextD.setDate(nextD.getDate() + 7);
      setSelectedDate(nextD);
      setCurrentDate(nextD);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthTitle = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      cells.push({ dayNumber: dayNum, date: d, dateStr: formatYMD(d), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      cells.push({ dayNumber: i, date: d, dateStr: formatYMD(d), isCurrentMonth: true });
    }
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ dayNumber: i, date: d, dateStr: formatYMD(d), isCurrentMonth: false });
    }
    return cells;
  }, [year, month, firstDayOfMonth, daysInCurrentMonth, daysInPrevMonth]);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Header & Portal Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Academic Calendar & Timetable
            </h1>
            <button
              onClick={() => setShowHelp(true)}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)'
              }}
              title="Schedule Help & Guidance"
            >
              <HelpCircle size={17} />
            </button>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Authoritative schedule of daily classes, upcoming tests, and homework deadlines
          </p>
        </div>

        {/* Tab Switcher: Calendar vs Period Timetable */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '4px',
            border: '1px solid var(--border-default)'
          }}
        >
          <button
            onClick={() => setLocalActiveTab('calendar')}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'calendar' ? 800 : 600,
              backgroundColor: activeTab === 'calendar' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'calendar' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'calendar' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <CalendarIcon size={14} />
            <span>Academic Calendar & Deadlines</span>
          </button>

          <button
            onClick={() => setLocalActiveTab('timetable')}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'timetable' ? 800 : 600,
              backgroundColor: activeTab === 'timetable' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'timetable' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'timetable' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Clock size={14} />
            <span>Weekly Bell Schedule</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: AUTHORITATIVE ACADEMIC CALENDAR ─── */}
      {activeTab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Calendar Controls Bar */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '1rem 1.25rem',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {monthTitle}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button onClick={prevPeriod} className="btn-secondary" style={{ padding: '0.35rem 0.55rem', borderRadius: '7px' }}>
                  <ChevronLeft size={15} />
                </button>
                <button onClick={goToToday} className="btn-secondary" style={{ padding: '0.35rem 0.65rem', borderRadius: '7px', fontSize: '0.75rem', fontWeight: 700 }}>
                  Today
                </button>
                <button onClick={nextPeriod} className="btn-secondary" style={{ padding: '0.35rem 0.55rem', borderRadius: '7px' }}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* View Switcher: Month / Agenda */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '2px',
                  border: '1px solid var(--border-default)'
                }}
              >
                {[
                  { id: 'month', label: 'Month', icon: CalendarDays },
                  { id: 'agenda', label: 'Agenda', icon: List }
                ].map((v) => {
                  const Icon = v.icon;
                  const isActive = viewMode === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setViewMode(v.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 800 : 600,
                        backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      <Icon size={12} />
                      <span>{v.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Event Filter Pills */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'classes', label: 'Classes', color: '#2563EB' },
                  { id: 'tests', label: 'Tests', color: '#7C3AED' },
                  { id: 'homework', label: 'Homework', color: '#D97706' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setEventTypeFilter(f.id)}
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: eventTypeFilter === f.id ? 800 : 600,
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      border: `1px solid ${eventTypeFilter === f.id ? 'var(--text-primary)' : 'var(--border-default)'}`,
                      backgroundColor: eventTypeFilter === f.id ? 'var(--bg-card)' : 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    {f.color && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: f.color }} />}
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Month / Agenda Display */}
          {viewMode === 'month' ? (
            <div className="calendar-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.25rem', alignItems: 'start' }}>
              {/* Month Grid */}
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {/* Day of Week Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', marginBottom: '8px', textAlign: 'center', width: '100%' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', padding: '0.35rem 0', textTransform: 'uppercase' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day Cells Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', width: '100%' }}>
                  {calendarCells.map((cell, idx) => {
                    const dayEvs = eventsByDate.get(cell.dateStr) || [];
                    const isSelected = cell.dateStr === selectedDateYMD;
                    const isToday = cell.dateStr === formatYMD(new Date());

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDate(cell.date)}
                        style={{
                          minWidth: 0,
                          minHeight: '88px',
                          padding: '0.5rem',
                          borderRadius: '10px',
                          border: isSelected
                            ? '2px solid var(--accent-primary)'
                            : isToday
                            ? '1px solid rgba(5, 150, 105, 0.4)'
                            : '1px solid var(--border-default)',
                          backgroundColor: isSelected
                            ? 'var(--accent-primary-subtle)'
                            : cell.isCurrentMonth
                            ? 'var(--bg-surface)'
                            : 'var(--bg-secondary)',
                          boxShadow: isSelected ? '0 2px 8px rgba(5, 150, 105, 0.15)' : 'none',
                          opacity: cell.isCurrentMonth ? 1 : 0.45,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                          overflow: 'hidden',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: isToday || isSelected ? 900 : 700,
                              color: isToday ? '#FFF' : 'var(--text-primary)',
                              backgroundColor: isToday ? 'var(--accent-primary)' : 'transparent',
                              borderRadius: isToday ? '50%' : 'none',
                              width: '22px',
                              height: '22px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {cell.dayNumber}
                          </span>
                          {dayEvs.length > 0 && (
                            <span
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                backgroundColor: isSelected ? 'rgba(5, 150, 105, 0.14)' : 'var(--bg-card)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '999px',
                                padding: '1px 5px',
                                lineHeight: '14px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title={`${dayEvs.length} events scheduled`}
                            >
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: dayEvs[0]?.color || 'var(--accent-primary)' }} />
                              {dayEvs.length}
                            </span>
                          )}
                        </div>

                        {/* Event Preview Chips */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
                          {dayEvs.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              style={{
                                fontSize: '0.64rem',
                                fontWeight: 700,
                                padding: '2px 5px',
                                borderRadius: '4px',
                                backgroundColor: ev.bgColor,
                                color: ev.color,
                                border: `1px solid ${ev.borderColor}`,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                display: 'block',
                                cursor: 'pointer'
                              }}
                              title={`${ev.time ? ev.time + ' · ' : ''}${ev.title}`}
                            >
                              {ev.isCancelled ? '[Cancelled] ' : ''}{ev.title}
                            </div>
                          ))}
                          {dayEvs.length > 2 && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(cell.date);
                              }}
                              style={{
                                fontSize: '0.62rem',
                                color: 'var(--text-muted)',
                                fontWeight: 800,
                                paddingLeft: '2px',
                                cursor: 'pointer'
                              }}
                              title="Click to view all events in Daily Schedule"
                            >
                              +{dayEvs.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Day Agenda Side Panel */}
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Daily Schedule
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </h3>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '12px' }}>
                    <CalendarIcon size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>No upcoming academic events.</div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      No classes, homework due, or tests on this date.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedDayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '12px',
                          backgroundColor: ev.bgColor,
                          border: `1px solid ${ev.borderColor}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: ev.color, textTransform: 'uppercase' }}>
                            {ev.typeLabel}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {ev.time}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {ev.title}
                        </div>

                        {ev.isCancelled && (
                          <div style={{ fontSize: '0.74rem', color: '#EF4444', fontWeight: 700, margin: '0.25rem 0' }}>
                            Reason: {ev.cancellationReason || 'Cancelled by instructor'}
                          </div>
                        )}

                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{ev.room}</span>
                          {ev.subject && <span>• {ev.subject}</span>}
                          {ev.marks && <span>• {ev.marks} pts</span>}
                        </div>

                        {/* Navigation action links */}
                        {ev.type === 'homework' && (
                          <button
                            onClick={() => setActiveTab('homework')}
                            className="btn-text"
                            style={{ fontSize: '0.74rem', color: '#D97706', fontWeight: 700, marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          >
                            Go to Homework <ArrowRight size={12} />
                          </button>
                        )}
                        {ev.type === 'test' && (
                          <button
                            onClick={() => setActiveTab('tests')}
                            className="btn-text"
                            style={{ fontSize: '0.74rem', color: '#7C3AED', fontWeight: 700, marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          >
                            View Test <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Agenda List View */
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
                Upcoming Academic Agenda ({filteredEvents.length} Events)
              </h3>

              {filteredEvents.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '12px' }}>
                  <CalendarIcon size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>No upcoming academic events.</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    There are no scheduled items matching this filter.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredEvents.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        backgroundColor: ev.bgColor,
                        border: `1px solid ${ev.borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: ev.color, textTransform: 'uppercase' }}>
                            {ev.typeLabel}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            {ev.dateStr} ({ev.time})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {ev.title}
                        </div>
                        {ev.isCancelled && (
                          <div style={{ fontSize: '0.74rem', color: '#EF4444', fontWeight: 700, marginTop: '2px' }}>
                            Reason: {ev.cancellationReason || 'Cancelled by instructor'}
                          </div>
                        )}
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Venue: {ev.room} {ev.subject ? `· ${ev.subject}` : ''}
                        </div>
                      </div>

                      <div>
                        {ev.type === 'homework' && (
                          <button onClick={() => setActiveTab('homework')} className="btn-secondary" style={{ fontSize: '0.78rem' }}>
                            Go to Homework
                          </button>
                        )}
                        {ev.type === 'test' && (
                          <button onClick={() => setActiveTab('tests')} className="btn-secondary" style={{ fontSize: '0.78rem' }}>
                            View Test
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: WEEKLY BELL SCHEDULE TIMETABLE ─── */}
      {activeTab === 'timetable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Day Selectors */}
          <div
            style={{
              display: 'flex',
              gap: '0.35rem',
              backgroundColor: 'var(--bg-secondary)',
              padding: '0.35rem',
              borderRadius: '14px',
              border: '1px solid var(--border-default)',
              flexWrap: 'wrap'
            }}
          >
            {ALL_WEEK_DAYS.map((day) => {
              const isWorking = workingDays.includes(day);
              const isToday = day === todayDayName;
              const isSelected = selectedDay === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    backgroundColor: isSelected ? 'var(--bg-card)' : 'transparent',
                    color: isSelected ? 'var(--accent-primary)' : isWorking ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{day.slice(0, 3)}</span>
                  {isToday && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#10B981'
                      }}
                      title="Today"
                    />
                  )}
                  {!isWorking && (
                    <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>•</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day Status Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              backgroundColor: isSelectedDayWorkingDay ? 'rgba(37, 99, 235, 0.08)' : 'rgba(100, 116, 139, 0.1)',
              border: isSelectedDayWorkingDay ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(100, 116, 139, 0.2)',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CalendarIcon size={18} color={isSelectedDayWorkingDay ? 'var(--accent-primary)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {selectedDay} {isSelectedDayToday && '(Today)'}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: isSelectedDayWorkingDay ? '#065F46' : 'var(--bg-secondary)',
                  color: isSelectedDayWorkingDay ? '#34D399' : 'var(--text-muted)'
                }}
              >
                {isSelectedDayWorkingDay ? 'Instructional School Day' : 'Non-Working Day / Rest Day'}
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {isSelectedDayWorkingDay
                ? `${periods.filter(p => !p.isBreak).length} Academic Periods • 2 Scheduled Recesses`
                : 'No live class periods scheduled'}
            </div>
          </div>

          {/* Daily Schedule Display or Non-Working Day State */}
          {!isSelectedDayWorkingDay ? (
            <div
              className="card"
              style={{
                padding: '3.5rem 2rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card)',
                border: '1px dashed var(--border-default)',
                borderRadius: '16px'
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: 'var(--text-muted)'
                }}
              >
                <CalendarIcon size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                No Classes Scheduled for {selectedDay}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                {selectedDay} is an official institution non-working day. 
                Use this time to review past lessons in <strong>Code Lab</strong>, prepare homework, or review upcoming tests.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => setSelectedDay(workingDays[0] || 'Monday')}
                  className="btn-secondary"
                  style={{ fontSize: '0.84rem', padding: '0.5rem 1.25rem' }}
                >
                  View Next School Day ({workingDays[0] || 'Monday'})
                </button>
              </div>
            </div>
          ) : periods.length === 0 ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <Info size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                Timetable Pending Configuration
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                No periods have been scheduled for {selectedDay} yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {periods.map((item, index) => {
                if (item.isBreak) {
                  return (
                    <div
                      key={index}
                      style={{
                        padding: '0.85rem 1.5rem',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(217, 119, 6, 0.08)',
                        border: '1px dashed rgba(217, 119, 6, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: '#D97706',
                        fontWeight: 700,
                        fontSize: '0.88rem'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Coffee size={16} /> {item.subject}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.time}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={index}
                    className="card"
                    style={{
                      padding: '1.2rem 1.5rem',
                      borderRadius: '14px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1rem'
                        }}
                      >
                        P{item.period}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {item.subject}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '3px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <User size={13} /> {item.teacher}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={13} /> {item.room}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        color: 'var(--accent-primary)',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '8px'
                      }}
                    >
                      <Clock size={14} />
                      <span>{item.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Contextual Help Modal */}
      {showHelp && (
        <SchoolContextualHelpModal
          section="schedule"
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};
