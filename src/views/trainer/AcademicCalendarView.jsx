import React, { useState, useEffect, useMemo } from 'react';
import { useLMS } from '../../context/LMSContext';
import { apiService } from '../../services/apiService';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Award,
  CheckSquare,
  Building2,
  Filter,
  CheckCircle2,
  X,
  MapPin,
  Users,
  AlertCircle,
  CalendarDays,
  List,
  CalendarRange
} from 'lucide-react';

export const AcademicCalendarView = ({ onNavigateTab }) => {
  const { terms, addToast } = useLMS();

  // Calendar View Mode: 'month' | 'week' | 'agenda'
  const [viewMode, setViewMode] = useState('month');

  // Currently viewed month/year date cursor
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Currently selected single day (for day-panel details)
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Event type filter: 'all' | 'classes' | 'tests' | 'homework'
  const [eventTypeFilter, setEventTypeFilter] = useState('all');

  // Data loaded from authoritative backend records
  const [persistentEvents, setPersistentEvents] = useState([]);
  const [tests, setTests] = useState([]);
  const [homework, setHomework] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals for scheduling directly from calendar with prefilled date
  const [showScheduleClassModal, setShowScheduleClassModal] = useState(false);
  const [showScheduleTestModal, setShowScheduleTestModal] = useState(false);
  const [showAssignHomeworkModal, setShowAssignHomeworkModal] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);

  // Form states for class / session scheduling
  const [classTitle, setClassTitle] = useState('');
  const [classType, setClassType] = useState('class');
  const [classSubject, setClassSubject] = useState('Python Programming');
  const [classStartTime, setClassStartTime] = useState('09:00');
  const [classEndTime, setClassEndTime] = useState('09:45');
  const [classRoom, setClassRoom] = useState('Coding Lab 1');
  const [classDescription, setClassDescription] = useState('');
  const [classBatch, setClassBatch] = useState('Class 10-A');

  // Form states for rescheduling / cancelling
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Form states for test scheduling
  const [testTitle, setTestTitle] = useState('');
  const [testSubject, setTestSubject] = useState('Python Programming');
  const [testTime, setTestTime] = useState('10:00 - 10:45 AM');
  const [testRoom, setTestRoom] = useState('Computer Lab 1');
  const [testDuration, setTestDuration] = useState(45);
  const [testMarks, setTestMarks] = useState(20);

  const [hwTitle, setHwTitle] = useState('');
  const [hwSubject, setHwSubject] = useState('Python Programming');
  const [hwTopic, setHwTopic] = useState('');
  const [hwPoints, setHwPoints] = useState(20);
  const [hwDescription, setHwDescription] = useState('');

  // Fetch all authoritative records
  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const [calRes, testsRes, hwRes, classesRes] = await Promise.all([
        apiService.getTrainerCalendarEvents(),
        apiService.getTrainerTests(),
        apiService.getTrainerHomework(),
        apiService.getTrainerClasses()
      ]);

      if (calRes?.success && Array.isArray(calRes.events)) {
        setPersistentEvents(calRes.events);
      }
      if (testsRes?.success && Array.isArray(testsRes.tests)) {
        setTests(testsRes.tests);
      }
      if (hwRes?.success && Array.isArray(hwRes.assignments)) {
        setHomework(hwRes.assignments);
      }
      if (classesRes?.success && Array.isArray(classesRes.classes)) {
        setClassesList(classesRes.classes);
      }
    } catch (e) {
      console.error('Error fetching calendar data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  // Format YYYY-MM-DD in local time
  const formatYMD = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert raw records into unified calendar events
  const allEvents = useMemo(() => {
    if (persistentEvents && persistentEvents.length > 0) {
      return persistentEvents.map((ev) => {
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
          linkedRecordId: ev.linkedRecordId,
          linkedModel: ev.linkedModel,
          data: ev
        };
      });
    }

    const list = [];

    // 1. Assessment / Test Records
    tests.forEach((t) => {
      const dateStr = t.date ? formatYMD(t.date) : null;
      if (dateStr) {
        list.push({
          id: `test-${t.id || t._id}`,
          type: 'test',
          typeLabel: 'Test / Exam',
          title: t.title,
          subject: t.subject,
          dateStr,
          rawDate: new Date(t.date),
          time: t.time || '10:00 - 10:45 AM',
          room: t.room || 'Computer Lab 1',
          marks: t.totalMarks || 20,
          color: '#7C3AED',
          bgColor: 'rgba(124, 58, 237, 0.1)',
          borderColor: 'rgba(124, 58, 237, 0.3)',
          data: t
        });
      }
    });

    // 2. Homework Deadlines
    homework.forEach((hw) => {
      const dateStr = hw.dueTimestamp ? formatYMD(hw.dueTimestamp) : hw.dueDate ? formatYMD(hw.dueDate) : null;
      if (dateStr) {
        list.push({
          id: `hw-${hw.id || hw._id}`,
          type: 'homework',
          typeLabel: 'Homework Due',
          title: hw.title,
          subject: hw.subject,
          dateStr,
          rawDate: new Date(hw.dueTimestamp || hw.dueDate),
          time: 'Due 11:59 PM',
          room: 'Portal Submission',
          marks: hw.points || 20,
          color: '#D97706',
          bgColor: 'rgba(217, 119, 6, 0.1)',
          borderColor: 'rgba(217, 119, 6, 0.3)',
          data: hw
        });
      }
    });

    // 3. Timetable / Teaching Sessions from assigned classes
    if (classesList && classesList.length > 0) {
      classesList.forEach((cls, idx) => {
        if (cls.scheduleDate) {
          const dateStr = formatYMD(cls.scheduleDate);
          list.push({
            id: `class-${cls.id || cls._id || idx}`,
            type: 'class',
            typeLabel: 'Class Lecture',
            title: `${cls.name || 'Class Session'}`,
            subject: cls.subject || cls.name || 'Class',
            dateStr,
            rawDate: new Date(cls.scheduleDate),
            time: cls.schedule || '10:00 AM',
            room: cls.room || 'Room 101',
            color: '#2563EB',
            bgColor: 'rgba(37, 99, 235, 0.1)',
            borderColor: 'rgba(37, 99, 235, 0.3)'
          });
        }
      });
    }

    return list;
  }, [persistentEvents, tests, homework, classesList, currentDate]);

  // Filter events by type
  const filteredEvents = useMemo(() => {
    if (eventTypeFilter === 'classes') return allEvents.filter((e) => e.type === 'class');
    if (eventTypeFilter === 'tests') return allEvents.filter((e) => e.type === 'test');
    if (eventTypeFilter === 'homework') return allEvents.filter((e) => e.type === 'homework');
    return allEvents;
  }, [allEvents, eventTypeFilter]);

  // Map events by dateStr for instant month cell lookup
  const eventsByDate = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach((ev) => {
      if (!map.has(ev.dateStr)) map.set(ev.dateStr, []);
      map.get(ev.dateStr).push(ev);
    });
    return map;
  }, [filteredEvents]);

  // Selected date events
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

  // Month grid calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthTitle = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Create 35 or 42 grid cells
  const calendarCells = useMemo(() => {
    const cells = [];

    // Days from previous month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      cells.push({
        dayNumber: dayNum,
        date: d,
        dateStr: formatYMD(d),
        isCurrentMonth: false
      });
    }

    // Days from current month
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      cells.push({
        dayNumber: i,
        date: d,
        dateStr: formatYMD(d),
        isCurrentMonth: true
      });
    }

    // Trailing days from next month
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({
        dayNumber: i,
        date: d,
        dateStr: formatYMD(d),
        isCurrentMonth: false
      });
    }

    return cells;
  }, [year, month, firstDayOfMonth, daysInCurrentMonth, daysInPrevMonth]);

  // Week View calculation (7 days surrounding selectedDate)
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    // Start on Monday (day 1)
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        dateStr: formatYMD(d),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate()
      });
    }
    return days;
  }, [selectedDate]);

  // Handle Schedule Class / Academic Session
  const handleScheduleClass = async (e) => {
    e.preventDefault();
    if (!classTitle.trim()) return;

    try {
      const datePart = formatYMD(selectedDate);
      const startDateTime = new Date(`${datePart}T${classStartTime}:00`);
      const endDateTime = new Date(`${datePart}T${classEndTime}:00`);

      if (endDateTime <= startDateTime) {
        addToast('Invalid Time', 'Class end time must be after start time.', 'amber');
        return;
      }

      const res = await apiService.createTrainerCalendarEvent({
        title: classTitle.trim(),
        eventType: classType,
        subject: classSubject,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        room: classRoom.trim(),
        batch: classBatch.trim(),
        description: classDescription.trim()
      });

      if (res?.success) {
        addToast('Session Scheduled', `Added "${classTitle}" to cohort academic calendar.`, 'emerald');
        setShowScheduleClassModal(false);
        setClassTitle('');
        setClassDescription('');
        loadCalendarData();
      } else {
        addToast('Notice', res?.message || 'Failed to schedule session.', 'amber');
      }
    } catch {
      addToast('Error', 'Network error scheduling session.', 'rose');
    }
  };

  // Handle Rescheduling
  const handleRescheduleEvent = async () => {
    if (!selectedEventDetails?.id) return;
    try {
      const datePart = rescheduleDate || selectedEventDetails.dateStr;
      const startDT = rescheduleStartTime ? new Date(`${datePart}T${rescheduleStartTime}:00`) : null;
      const endDT = rescheduleEndTime ? new Date(`${datePart}T${rescheduleEndTime}:00`) : null;

      const payload = {};
      if (startDT) payload.startTime = startDT.toISOString();
      if (endDT) payload.endTime = endDT.toISOString();

      const res = await apiService.updateTrainerCalendarEvent(selectedEventDetails.id, payload);
      if (res?.success) {
        addToast('Event Rescheduled', 'Calendar updated successfully.', 'emerald');
        setIsRescheduling(false);
        setSelectedEventDetails(null);
        loadCalendarData();
      } else {
        addToast('Notice', res?.message || 'Failed to reschedule event.', 'amber');
      }
    } catch {
      addToast('Error', 'Network error rescheduling event.', 'rose');
    }
  };

  // Handle Cancellation
  const handleCancelEvent = async () => {
    if (!selectedEventDetails?.id) return;
    try {
      const res = await apiService.cancelTrainerCalendarEvent(selectedEventDetails.id, cancelReason || 'Class cancelled by instructor.');
      if (res?.success) {
        addToast('Event Cancelled', 'Notice published to student calendar.', 'amber');
        setIsCancelling(false);
        setSelectedEventDetails(null);
        loadCalendarData();
      } else {
        addToast('Notice', res?.message || 'Failed to cancel event.', 'amber');
      }
    } catch {
      addToast('Error', 'Network error cancelling event.', 'rose');
    }
  };

  // Handle Schedule Test Submission
  const handleScheduleTest = async (e) => {
    e.preventDefault();
    if (!testTitle.trim()) return;

    try {
      const res = await apiService.scheduleAssessment({
        title: testTitle.trim(),
        subject: testSubject,
        date: formatYMD(selectedDate),
        time: testTime,
        room: testRoom,
        totalMarks: Number(testMarks) || 20,
        durationMinutes: Number(testDuration) || 45,
        isCodingExam: true
      });

      if (res?.success) {
        addToast('Test Scheduled', `Scheduled "${testTitle}" on ${formatYMD(selectedDate)}.`, 'emerald');
        setShowScheduleTestModal(false);
        setTestTitle('');
        loadCalendarData();
      } else {
        addToast('Notice', res?.message || 'Failed to schedule test.', 'amber');
      }
    } catch (err) {
      addToast('Error', 'Network error scheduling test.', 'rose');
    }
  };

  // Handle Assign Homework Submission
  const handleAssignHomework = async (e) => {
    e.preventDefault();
    if (!hwTitle.trim()) return;

    try {
      const res = await apiService.createTrainerHomework({
        title: hwTitle.trim(),
        subject: hwSubject,
        topic: hwTopic.trim(),
        dueDate: new Date(selectedDate.setHours(23, 59, 0, 0)).toISOString(),
        points: Number(hwPoints) || 20,
        description: hwDescription.trim() || 'Complete exercises and submit solution before deadline.'
      });

      if (res?.success) {
        addToast('Homework Assigned', `Assigned "${hwTitle}" due on ${formatYMD(selectedDate)}.`, 'emerald');
        setShowAssignHomeworkModal(false);
        setHwTitle('');
        setHwTopic('');
        setHwDescription('');
        loadCalendarData();
      } else {
        addToast('Notice', res?.message || 'Failed to assign homework.', 'amber');
      }
    } catch (err) {
      addToast('Error', 'Network error assigning homework.', 'rose');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* ─── Top Toolbar: Title, View Switcher & Actions ─── */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '16px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CalendarIcon size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Academic Calendar & Schedule
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Authoritative view of class periods, scheduled tests, and homework deadlines
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Today, Prev/Next, Mode Switcher, Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* View Mode Switcher */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '9px',
              padding: '2px',
              border: '1px solid var(--border-default)'
            }}
          >
            {[
              { id: 'month', label: 'Month', icon: CalendarDays },
              { id: 'week', label: 'Week', icon: CalendarRange },
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
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 800 : 600,
                    backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  <Icon size={13} />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>

          {/* Prev / Today / Next Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <button
              onClick={prevPeriod}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.6rem', borderRadius: '8px' }}
              title="Previous Period"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToToday}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}
            >
              Today
            </button>
            <button
              onClick={nextPeriod}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.6rem', borderRadius: '8px' }}
              title="Next Period"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-default)' }} />

          {/* Quick Schedule Actions */}
          <button
            onClick={() => setShowScheduleClassModal(true)}
            className="btn-primary"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: '#2563EB',
              borderColor: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Plus size={14} />
            <span>Schedule Session</span>
          </button>

          <button
            onClick={() => setShowScheduleTestModal(true)}
            className="btn-primary"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: '#7C3AED',
              borderColor: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Award size={14} />
            <span>Schedule Test</span>
          </button>

          <button
            onClick={() => setShowAssignHomeworkModal(true)}
            className="btn-primary"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: '#059669',
              borderColor: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <CheckSquare size={14} />
            <span>Assign Homework</span>
          </button>
        </div>
      </div>

      {/* ─── Filters & Month Header Banner ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0.25rem 0.25rem'
        }}
      >
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          {monthTitle}
        </h3>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Academic Events' },
            { id: 'classes', label: 'Class Lectures', color: '#2563EB' },
            { id: 'tests', label: 'Tests & Exams', color: '#7C3AED' },
            { id: 'homework', label: 'Homework Deadlines', color: '#D97706' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setEventTypeFilter(f.id)}
              style={{
                fontSize: '0.78rem',
                fontWeight: eventTypeFilter === f.id ? 800 : 600,
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: `1px solid ${eventTypeFilter === f.id ? 'var(--text-primary)' : 'var(--border-default)'}`,
                backgroundColor: eventTypeFilter === f.id ? 'var(--bg-card)' : 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              {f.color && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: f.color }} />
              )}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Content Split: Calendar View + Selected-Day Details Panel ─── */}
      <div className="calendar-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.25rem', alignItems: 'start' }}>
        {/* Left Column: Calendar Presentation */}
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
          {/* VIEW: MONTH VIEW */}
          {viewMode === 'month' && (
            <div style={{ width: '100%', minWidth: 0 }}>
              {/* Day of Week Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', marginBottom: '8px', width: '100%' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div
                    key={d}
                    style={{
                      textAlign: 'center',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: 'var(--text-secondary)',
                      padding: '0.4rem 0',
                      textTransform: 'uppercase'
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', width: '100%' }}>
                {calendarCells.map((cell, idx) => {
                  const isSelected = formatYMD(selectedDate) === cell.dateStr;
                  const isToday = formatYMD(new Date()) === cell.dateStr;
                  const dayEvents = eventsByDate.get(cell.dateStr) || [];

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(cell.date)}
                      style={{
                        minWidth: 0,
                        minHeight: '88px',
                        padding: '0.5rem',
                        borderRadius: '10px',
                        backgroundColor: isSelected
                          ? 'rgba(37, 99, 235, 0.08)'
                          : cell.isCurrentMonth
                          ? 'var(--bg-surface)'
                          : 'var(--bg-secondary)',
                        border: isSelected
                          ? '2px solid #2563EB'
                          : isToday
                          ? '1px solid rgba(37, 99, 235, 0.5)'
                          : '1px solid var(--border-default)',
                        boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        opacity: cell.isCurrentMonth ? 1 : 0.45,
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
                            color: isToday ? '#FFFFFF' : 'var(--text-primary)',
                            width: isToday ? '22px' : 'auto',
                            height: isToday ? '22px' : 'auto',
                            borderRadius: isToday ? '50%' : 'none',
                            backgroundColor: isToday ? '#2563EB' : 'transparent',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {cell.dayNumber}
                        </span>

                        {dayEvents.length > 0 && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: isSelected ? '#2563EB' : 'var(--text-secondary)',
                              backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.14)' : 'var(--bg-card)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '999px',
                              padding: '1px 5px',
                              lineHeight: '14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title={`${dayEvents.length} events scheduled`}
                          >
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: dayEvents[0]?.color || '#2563EB' }} />
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Event Chips (compact preview inside cell) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventDetails(ev);
                            }}
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
                            {ev.title}
                          </div>
                        ))}

                        {dayEvents.length > 2 && (
                          <span
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
                            title="Click to view all events in Day Agenda"
                          >
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: WEEK VIEW */}
          {viewMode === 'week' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px', width: '100%' }}>
              {weekDays.map((wDay) => {
                const dayEvents = eventsByDate.get(wDay.dateStr) || [];
                const isSelected = formatYMD(selectedDate) === wDay.dateStr;
                const isToday = formatYMD(new Date()) === wDay.dateStr;

                return (
                  <div
                    key={wDay.dateStr}
                    onClick={() => setSelectedDate(wDay.date)}
                    style={{
                      borderRadius: '12px',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface)',
                      border: isSelected ? '2px solid #2563EB' : '1px solid var(--border-default)',
                      boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                      padding: '0.75rem',
                      minHeight: '380px',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      minWidth: 0,
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ textAlign: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-default)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                        {wDay.dayName}
                      </div>
                      <div
                        style={{
                          fontSize: '1rem',
                          fontWeight: 900,
                          color: isToday ? '#FFFFFF' : 'var(--text-primary)',
                          backgroundColor: isToday ? '#2563EB' : 'transparent',
                          width: isToday ? '26px' : 'auto',
                          height: isToday ? '26px' : 'auto',
                          borderRadius: isToday ? '50%' : 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '2px auto 0'
                        }}
                      >
                        {wDay.dayNumber}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', minWidth: 0, overflow: 'hidden' }}>
                      {dayEvents.length === 0 ? (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                          No events
                        </div>
                      ) : (
                        dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventDetails(ev);
                            }}
                            style={{
                              padding: '0.45rem',
                              borderRadius: '8px',
                              backgroundColor: ev.bgColor,
                              border: `1px solid ${ev.borderColor}`,
                              fontSize: '0.72rem',
                              minWidth: 0,
                              maxWidth: '100%',
                              boxSizing: 'border-box',
                              cursor: 'pointer'
                            }}
                            title={`${ev.time} · ${ev.title}`}
                          >
                            <div style={{ fontWeight: 800, color: ev.color, fontSize: '0.66rem' }}>{ev.time}</div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginTop: '2px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {ev.title}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW: AGENDA / LIST VIEW */}
          {viewMode === 'agenda' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredEvents.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No academic events recorded for this selection.
                </div>
              ) : (
                filteredEvents
                  .sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr))
                  .map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setSelectedDate(new Date(ev.dateStr));
                        setSelectedEventDetails(ev);
                      }}
                      style={{
                        padding: '0.85rem 1.15rem',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            backgroundColor: ev.bgColor,
                            color: ev.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {ev.type === 'test' ? <Award size={18} /> : ev.type === 'homework' ? <CheckSquare size={18} /> : <Building2 size={18} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: ev.color }}>{ev.typeLabel}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>• {ev.dateStr}</span>
                          </div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>{ev.title}</div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ev.time}</div>
                        <div>{ev.room}</div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>

        {/* Right Column: Selected-Day Agenda & Scheduling Panel */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
              Day Agenda
            </span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </h3>
          </div>

          {/* Quick Schedule Actions for this specific date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
            <button
              onClick={() => setShowScheduleClassModal(true)}
              style={{
                padding: '0.45rem 0.3rem',
                borderRadius: '8px',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: '#2563EB',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                cursor: 'pointer'
              }}
              title="Schedule a class session on this date"
            >
              <Plus size={12} />
              <span>Session</span>
            </button>

            <button
              onClick={() => setShowScheduleTestModal(true)}
              style={{
                padding: '0.45rem 0.3rem',
                borderRadius: '8px',
                border: '1px solid rgba(124, 58, 237, 0.3)',
                backgroundColor: 'rgba(124, 58, 237, 0.08)',
                color: '#7C3AED',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                cursor: 'pointer'
              }}
              title="Schedule an exam or test on this date"
            >
              <Plus size={12} />
              <span>Test</span>
            </button>

            <button
              onClick={() => setShowAssignHomeworkModal(true)}
              style={{
                padding: '0.45rem 0.3rem',
                borderRadius: '8px',
                border: '1px solid rgba(5, 150, 105, 0.3)',
                backgroundColor: 'rgba(5, 150, 105, 0.08)',
                color: '#059669',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                cursor: 'pointer'
              }}
              title="Assign homework due on this date"
            >
              <Plus size={12} />
              <span>Homework</span>
            </button>
          </div>

          {/* Events for this Selected Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Events Scheduled ({selectedDayEvents.length})
            </span>

            {selectedDayEvents.length === 0 ? (
              <div
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: '1px dashed var(--border-default)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)'
                }}
              >
                No classes, exams, or homework deadlines scheduled on this date.
              </div>
            ) : (
              selectedDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventDetails(ev)}
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-surface)',
                    border: `1px solid ${ev.borderColor}`,
                    borderLeft: `4px solid ${ev.color}`,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: ev.color,
                        textTransform: 'uppercase'
                      }}
                    >
                      {ev.typeLabel}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {ev.time}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {ev.title}
                  </div>

                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={12} />
                    <span>{ev.room}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL: SCHEDULE TEST (Prefilled with selected date) ─── */}
      {showScheduleTestModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowScheduleTestModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '18px',
              padding: '1.75rem',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={20} color="#7C3AED" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Schedule Assessment / Examination
                </h3>
              </div>
              <button onClick={() => setShowScheduleTestModal(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleTest} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Test Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unit 3 — Loops & Conditionals Assessment"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Subject
                  </label>
                  <select
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  >
                    <option value="Python Programming">Python Programming</option>
                    <option value="SQL & Relational Databases">SQL & Relational Databases</option>
                    <option value="C++ Fundamentals">C++ Fundamentals</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Scheduled Date
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formatYMD(selectedDate)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Time Slot
                  </label>
                  <input
                    type="text"
                    value={testTime}
                    onChange={(e) => setTestTime(e.target.value)}
                    placeholder="10:00 - 10:45 AM"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Venue / Room
                  </label>
                  <input
                    type="text"
                    value={testRoom}
                    onChange={(e) => setTestRoom(e.target.value)}
                    placeholder="Computer Lab 1"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={testMarks}
                    onChange={(e) => setTestMarks(e.target.value)}
                    min="10"
                    max="100"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={testDuration}
                    onChange={(e) => setTestDuration(e.target.value)}
                    min="15"
                    max="180"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowScheduleTestModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: '#7C3AED', borderColor: '#7C3AED' }}>
                  Save & Publish to Student Schedules
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ASSIGN HOMEWORK (Prefilled with selected date as due date) ─── */}
      {showAssignHomeworkModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowAssignHomeworkModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '18px',
              padding: '1.75rem',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckSquare size={20} color="#059669" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Assign Homework (Due: {formatYMD(selectedDate)})
                </h3>
              </div>
              <button onClick={() => setShowAssignHomeworkModal(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignHomework} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Assignment Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Iterative Factorials and Loop Homework"
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Subject
                  </label>
                  <select
                    value={hwSubject}
                    onChange={(e) => setHwSubject(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  >
                    <option value="Python Programming">Python Programming</option>
                    <option value="SQL & Relational Databases">SQL & Relational Databases</option>
                    <option value="C++ Fundamentals">C++ Fundamentals</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Maximum Marks
                  </label>
                  <input
                    type="number"
                    value={hwPoints}
                    onChange={(e) => setHwPoints(e.target.value)}
                    min="10"
                    max="100"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Curriculum Topic (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unit 3 — Loops and Ranges"
                  value={hwTopic}
                  onChange={(e) => setHwTopic(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Instructions & Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide problem requirements and instructions..."
                  value={hwDescription}
                  onChange={(e) => setHwDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAssignHomeworkModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: '#059669', borderColor: '#059669' }}>
                  Publish Homework
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: SCHEDULE CLASS / ACADEMIC SESSION ─── */}
      {showScheduleClassModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowScheduleClassModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '18px',
              padding: '1.75rem',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarIcon size={20} color="#2563EB" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Schedule Session ({formatYMD(selectedDate)})
                </h3>
              </div>
              <button onClick={() => setShowScheduleClassModal(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleClass} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Session Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Iterative Factorials & Lab Practice"
                  value={classTitle}
                  onChange={(e) => setClassTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Event Type
                  </label>
                  <select
                    value={classType}
                    onChange={(e) => setClassType(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  >
                    <option value="class">Class Lecture</option>
                    <option value="session">Extra Session / Lab</option>
                    <option value="announcement">Academic Announcement</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Subject
                  </label>
                  <select
                    value={classSubject}
                    onChange={(e) => setClassSubject(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  >
                    <option value="Python Programming">Python Programming</option>
                    <option value="SQL & Relational Databases">SQL & Relational Databases</option>
                    <option value="C++ Fundamentals">C++ Fundamentals</option>
                    <option value="Web Development (HTML/CSS/JS)">Web Development (HTML/CSS/JS)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={classStartTime}
                    onChange={(e) => setClassStartTime(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={classEndTime}
                    onChange={(e) => setClassEndTime(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Room / Lab
                  </label>
                  <input
                    type="text"
                    value={classRoom}
                    onChange={(e) => setClassRoom(e.target.value)}
                    placeholder="Coding Lab 1"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Class / Section
                  </label>
                  <input
                    type="text"
                    value={classBatch}
                    onChange={(e) => setClassBatch(e.target.value)}
                    placeholder="Class 10-A"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Description / Topic Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Class objectives or required materials..."
                  value={classDescription}
                  onChange={(e) => setClassDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.86rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowScheduleClassModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}>
                  Schedule Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EVENT DETAILS INSPECTION ─── */}
      {selectedEventDetails && (
        <div
          className="modal-overlay"
          onClick={() => {
            setSelectedEventDetails(null);
            setIsRescheduling(false);
            setIsCancelling(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '18px',
              padding: '1.75rem',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: selectedEventDetails.bgColor,
                  color: selectedEventDetails.color,
                  textTransform: 'uppercase'
                }}
              >
                {selectedEventDetails.typeLabel}
              </span>
              <button
                onClick={() => {
                  setSelectedEventDetails(null);
                  setIsRescheduling(false);
                  setIsCancelling(false);
                }}
                className="btn-icon"
              >
                <X size={18} />
              </button>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
              {selectedEventDetails.title}
            </h3>

            {selectedEventDetails.isCancelled && (
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#EF4444', fontSize: '0.82rem', marginBottom: '0.85rem' }}>
                <strong>CANCELLED:</strong> {selectedEventDetails.cancellationReason || 'Class cancelled by instructor.'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <Clock size={15} color="#2563EB" />
                <span>
                  <strong>Date & Time:</strong> {selectedEventDetails.dateStr} ({selectedEventDetails.time})
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <MapPin size={15} color="#2563EB" />
                <span>
                  <strong>Venue / Room:</strong> {selectedEventDetails.room}
                </span>
              </div>

              {selectedEventDetails.marks && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  <Award size={15} color="#2563EB" />
                  <span>
                    <strong>Weightage:</strong> {selectedEventDetails.marks} Marks
                  </span>
                </div>
              )}
            </div>

            {/* In-line Reschedule Form */}
            {isRescheduling && (
              <div style={{ padding: '0.9rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-default)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Reschedule Event Time
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Start Time</label>
                    <input
                      type="time"
                      value={rescheduleStartTime}
                      onChange={(e) => setRescheduleStartTime(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>End Time</label>
                    <input
                      type="time"
                      value={rescheduleEndTime}
                      onChange={(e) => setRescheduleEndTime(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button onClick={() => setIsRescheduling(false)} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                    Cancel
                  </button>
                  <button onClick={handleRescheduleEvent} className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', backgroundColor: '#2563EB', borderColor: '#2563EB' }}>
                    Save Reschedule
                  </button>
                </div>
              </div>
            )}

            {/* In-line Cancel Form */}
            {isCancelling && (
              <div style={{ padding: '0.9rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#EF4444', marginBottom: '0.4rem' }}>
                  Cancel This Session
                </div>
                <input
                  type="text"
                  placeholder="Reason (e.g. Faculty on leave, Lab maintenance)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button onClick={() => setIsCancelling(false)} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                    Dismiss
                  </button>
                  <button onClick={handleCancelEvent} className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', backgroundColor: '#EF4444', borderColor: '#EF4444' }}>
                    Confirm Cancellation
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                {!selectedEventDetails.isProjected && !selectedEventDetails.isCancelled && !isRescheduling && !isCancelling && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => {
                        setIsRescheduling(true);
                        setIsCancelling(false);
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem' }}
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => {
                        setIsCancelling(true);
                        setIsRescheduling(false);
                      }}
                      className="btn-ghost"
                      style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem', color: '#EF4444' }}
                    >
                      Cancel Class
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    setSelectedEventDetails(null);
                    setIsRescheduling(false);
                    setIsCancelling(false);
                  }}
                  className="btn-secondary"
                >
                  Close
                </button>
                {selectedEventDetails.type === 'homework' && onNavigateTab && (
                  <button
                    onClick={() => {
                      setSelectedEventDetails(null);
                      onNavigateTab('homework');
                    }}
                    className="btn-primary"
                  >
                    Manage in Homework
                  </button>
                )}
                {selectedEventDetails.type === 'test' && onNavigateTab && (
                  <button
                    onClick={() => {
                      setSelectedEventDetails(null);
                      onNavigateTab('tests');
                    }}
                    className="btn-primary"
                    style={{ backgroundColor: '#7C3AED', borderColor: '#7C3AED' }}
                  >
                    Inspect Test
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
