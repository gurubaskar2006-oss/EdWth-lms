import React, { useState, useEffect, useMemo } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { apiService } from '../services/apiService';
import {
  Trophy,
  Medal,
  Award,
  Star,
  Building,
  School,
  Flame,
  CheckCircle2,
  BookOpen,
  Filter,
  BarChart3,
  Users,
  ShieldCheck,
  Calendar,
  AlertCircle
} from 'lucide-react';

export const LeaderboardView = () => {
  usePageTitle('Academic Leaderboard');
  const { user } = useLMS();

  const isPlatformAdmin = user?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Student / single school leaderboard state
  const [schoolData, setSchoolData] = useState(null);
  const [leaderboardItems, setLeaderboardItems] = useState([]);

  // Platform Admin state
  const [adminSchools, setAdminSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [comparisonData, setComparisonData] = useState([]);
  const [activeAdminTab, setActiveAdminTab] = useState('rankings'); // 'rankings' | 'comparison'
  const [selectedCohortFilter, setSelectedCohortFilter] = useState('ALL');

  // Load school leaderboard for student or platform admin
  const loadLeaderboard = async (schoolIdToFetch = null) => {
    setLoading(true);
    setError(null);
    try {
      if (isPlatformAdmin) {
        if (!schoolIdToFetch && adminSchools.length > 0) {
          schoolIdToFetch = adminSchools[0]._id || adminSchools[0].id;
        }

        if (schoolIdToFetch) {
          const res = await apiService.getAdminSchoolLeaderboard(schoolIdToFetch);
          if (res?.success) {
            setSchoolData(res.school || null);
            setLeaderboardItems(res.leaderboard || []);
          } else {
            setError(res?.message || 'Failed to load school leaderboard');
          }
        }
      } else {
        const res = await apiService.getSchoolLeaderboard();
        if (res?.success) {
          setSchoolData(res.school || null);
          setLeaderboardItems(res.leaderboard || []);
        } else {
          setError(res?.message || 'Failed to load school leaderboard');
        }
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError('Network error loading verified leaderboard');
    } finally {
      setLoading(false);
    }
  };

  // Initial load for admin: fetch school directory and comparison
  useEffect(() => {
    if (isPlatformAdmin) {
      const initAdmin = async () => {
        try {
          const [schoolsRes, compRes] = await Promise.all([
            apiService.getAdminSchools(),
            apiService.getAdminSchoolsComparison()
          ]);

          if (schoolsRes?.success && Array.isArray(schoolsRes.schools) && schoolsRes.schools.length > 0) {
            setAdminSchools(schoolsRes.schools);
            const initialId = schoolsRes.schools[0]._id || schoolsRes.schools[0].id;
            setSelectedSchoolId(initialId);
            loadLeaderboard(initialId);
          }
          if (compRes?.success && Array.isArray(compRes.comparison)) {
            setComparisonData(compRes.comparison);
          }
        } catch (e) {
          console.error('Error initializing admin multi-school leaderboard:', e);
        }
      };
      initAdmin();
    } else {
      loadLeaderboard();
    }
  }, [isPlatformAdmin]);

  const handleAdminSchoolChange = (e) => {
    const newSchoolId = e.target.value;
    setSelectedSchoolId(newSchoolId);
    setSelectedCohortFilter('ALL');
    loadLeaderboard(newSchoolId);
  };

  // Filter leaderboard items if class or cohort filter is active
  const filteredLeaderboard = useMemo(() => {
    if (!selectedCohortFilter || selectedCohortFilter === 'ALL') {
      return leaderboardItems;
    }
    return leaderboardItems.filter(item => {
      const cls = (item.className || '').toLowerCase();
      const bName = (item.batchName || '').toLowerCase();
      if (selectedCohortFilter === 'Class 11') {
        return cls.includes('11') || bName.includes('11');
      }
      if (selectedCohortFilter === 'Class 12') {
        return cls.includes('12') || bName.includes('12');
      }
      return item.batchId === selectedCohortFilter;
    });
  }, [leaderboardItems, selectedCohortFilter]);

  const getRankBadge = (index) => {
    if (index === 0) return <Trophy size={24} color="#D97706" fill="#D97706" />;
    if (index === 1) return <Medal size={22} color="#64748B" />;
    if (index === 2) return <Award size={22} color="#B45309" />;
    return <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-muted)' }}>#{index + 1}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto', padding: '0 0.5rem' }}>
      
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(217, 119, 6, 0.12)',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(217, 119, 6, 0.25)'
            }}
          >
            <Trophy size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Academic Honors Leaderboard
              </h1>
              {schoolData && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--accent-blue)',
                  fontWeight: 700,
                  border: '1px solid rgba(37, 99, 235, 0.2)'
                }}>
                  {schoolData.name} ({schoolData.code})
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: '0.25rem 0 0 0' }}>
              {isPlatformAdmin
                ? 'Centralized multi-school ranking and performance analytics'
                : 'Verified cohort rankings based on actual assessment and homework records'}
            </p>
          </div>
        </div>

        {/* Platform Admin Selector & View Toggle */}
        {isPlatformAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-subtle)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
              <button
                type="button"
                onClick={() => setActiveAdminTab('rankings')}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeAdminTab === 'rankings' ? 'var(--accent-primary)' : 'transparent',
                  color: activeAdminTab === 'rankings' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                School Honors
              </button>
              <button
                type="button"
                onClick={() => setActiveAdminTab('comparison')}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeAdminTab === 'comparison' ? 'var(--accent-primary)' : 'transparent',
                  color: activeAdminTab === 'comparison' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cross-School Comparison
              </button>
            </div>

            {activeAdminTab === 'rankings' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <School size={16} color="var(--text-muted)" />
                <select
                  value={selectedSchoolId}
                  onChange={handleAdminSchoolChange}
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.84rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontWeight: 600
                  }}
                >
                  {adminSchools.map(sch => (
                    <option key={sch._id || sch.id} value={sch._id || sch.id}>
                      {sch.name} ({sch.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cohort Class Filter Bar */}
      {activeAdminTab === 'rankings' && leaderboardItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter by Class:</span>
            {['ALL', 'Class 11', 'Class 12'].map((cf) => (
              <button
                key={cf}
                type="button"
                onClick={() => setSelectedCohortFilter(cf)}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: selectedCohortFilter === cf ? '1px solid var(--accent-blue)' : '1px solid var(--border-default)',
                  backgroundColor: selectedCohortFilter === cf ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-card)',
                  color: selectedCohortFilter === cf ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {cf === 'ALL' ? 'All Classes' : cf}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Showing {filteredLeaderboard.length} of {leaderboardItems.length} verified scholars
          </span>
        </div>
      )}

      {/* Cross-School Comparison View (Platform Admin only) */}
      {isPlatformAdmin && activeAdminTab === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Cross-School Aggregate Performance Overview
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
              Comparative benchmark across participating schools. Individual student records remain strictly isolated within each school.
            </p>

            {comparisonData.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No participating schools available for comparison.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-default)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>School</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Students</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Class 11</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Class 12</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Active Cohorts</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Avg Test Score</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Attendance Rate</th>
                      <th style={{ padding: '0.75rem 1rem' }}>HW Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((sch) => (
                      <tr key={sch.schoolId || sch.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <div>{sch.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sch.code}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{sch.totalStudents}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{sch.class11Count}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{sch.class12Count}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', fontWeight: 700, fontSize: '0.76rem' }}>
                            {sch.activeCohortsCount} Active
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: sch.metrics?.averageAssessmentScore ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                          {sch.metrics?.averageAssessmentScore != null ? `${sch.metrics.averageAssessmentScore}%` : 'Pending'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: sch.metrics?.averageAttendanceRate ? '#10B981' : 'var(--text-muted)' }}>
                          {sch.metrics?.averageAttendanceRate != null ? `${sch.metrics.averageAttendanceRate}%` : 'Pending'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: sch.metrics?.homeworkCompletionRate ? '#2563EB' : 'var(--text-muted)' }}>
                          {sch.metrics?.homeworkCompletionRate != null ? `${sch.metrics.homeworkCompletionRate}%` : 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard View (Rankings) */}
      {activeAdminTab === 'rankings' && (
        <>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading verified school rankings...
            </div>
          ) : error ? (
            <div style={{
              padding: '1.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div style={{
              padding: '3rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <Trophy size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                No Scholars Evaluated Yet
              </h3>
              <p style={{ fontSize: '0.86rem', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                There are no evaluated assessment attempts or graded submissions recorded for this cohort yet. Rankings will appear automatically once submissions are graded.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredLeaderboard.map((student, index) => {
                const isTop3 = index < 3;
                const scoreDisplay = student.compositeScore != null && student.compositeScore > 0
                  ? `${student.compositeScore}%`
                  : 'Pending';

                return (
                  <div
                    key={student.id || student.studentId}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1.1rem 1.5rem',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-lg)',
                      border: isTop3 ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid var(--border-default)',
                      boxShadow: isTop3 ? '0 2px 10px rgba(0, 0, 0, 0.05)' : 'var(--shadow-sm)',
                      gap: '1.25rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Rank */}
                    <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                      {getRankBadge(index)}
                    </div>

                    {/* Avatar */}
                    <div style={{ position: 'relative' }}>
                      <img
                        src={student.avatar}
                        alt={student.name}
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: isTop3 ? '2px solid var(--accent-blue)' : '2px solid var(--border-default)'
                        }}
                      />
                    </div>

                    {/* Name & Academic Class Info */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <h3 style={{
                        margin: '0 0 0.25rem 0',
                        fontSize: '1.05rem',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        {student.name}
                        {isTop3 && <Star size={14} color="#D97706" fill="#D97706" />}
                      </h3>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {student.studentId}
                        </span>
                        <span>•</span>
                        <span style={{
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(37, 99, 235, 0.08)',
                          color: 'var(--accent-blue)',
                          fontWeight: 600,
                          fontSize: '0.76rem'
                        }}>
                          {student.className || 'Class 11'}
                        </span>
                        <span>•</span>
                        <span>{student.batchName}</span>
                      </div>
                    </div>

                    {/* Verified Metrics Pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      {/* Tests Avg */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Test Avg
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: student.assessmentAverage != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {student.assessmentAverage != null ? `${student.assessmentAverage}%` : '—'}
                        </div>
                      </div>

                      {/* Attendance */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Attendance
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: student.attendanceRate != null ? '#10B981' : 'var(--text-muted)' }}>
                          {student.attendanceRate != null ? `${student.attendanceRate}%` : '—'}
                        </div>
                      </div>

                      {/* Streak */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
                          <Flame size={12} color="#D97706" /> Streak
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#D97706' }}>
                          {student.streakDays || 0}d
                        </div>
                      </div>

                      {/* Authoritative Overall Score */}
                      <div style={{ textAlign: 'right', minWidth: '80px', marginLeft: '0.5rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.2rem' }}>
                          Academic Score
                        </div>
                        <div style={{
                          fontSize: '1.45rem',
                          fontWeight: 800,
                          color: isTop3 ? 'var(--accent-primary)' : 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {scoreDisplay}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
