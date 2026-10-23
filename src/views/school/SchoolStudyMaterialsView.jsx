import React, { useState, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiService } from '../../services/apiService';
import {
  FileText,
  Download,
  Search,
  BookOpen,
  Calendar,
  Tag,
  HelpCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { SchoolContextualHelpModal } from '../../components/school/SchoolContextualHelpModal';

export const SchoolStudyMaterialsView = () => {
  usePageTitle('Study Material');
  const { terms, addToast, user, portalConfig } = useLMS();

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [downloadingId, setDownloadingId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const fetchMaterials = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getNotes();
      if (Array.isArray(data)) {
        // Filter to items that have files attached or are shared study notes
        setMaterials(data);
      } else {
        setMaterials([]);
      }
    } catch (err) {
      console.error('Error fetching student study materials:', err);
      setError('Unable to load study materials at this time. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleDownload = async (item) => {
    const file = item.files && item.files[0];
    if (!file || !file.s3Key) {
      addToast('Notice', 'No attached file found for this resource.', 'amber');
      return;
    }

    setDownloadingId(item.id);
    addToast('Requesting Download', 'Requesting secure, time-limited download URL from Backblaze B2...', 'subtle');

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
        addToast('Access Denied', 'Could not obtain authorized download URL. Material may be restricted.', 'rose');
      }
    } catch (err) {
      console.error('Download error:', err);
      addToast('Download Error', 'Network error during download authorization.', 'rose');
    } finally {
      setDownloadingId(null);
    }
  };

  // Extract unique subjects from materials
  const availableSubjects = [
    'All',
    ...Array.from(new Set(materials.map((m) => m.subject || m.category).filter(Boolean)))
  ];

  const filteredMaterials = materials.filter((m) => {
    const titleMatch = (m.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const subjectMatch = (m.subject || m.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const contentMatch = (m.content || '').toLowerCase().includes(searchTerm.toLowerCase());
    const fileMatch = m.files && m.files.some((f) => (f.originalName || '').toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSearch = titleMatch || subjectMatch || contentMatch || fileMatch;
    const matchesSubject = selectedSubject === 'All' || 
      (m.subject && m.subject.toLowerCase() === selectedSubject.toLowerCase()) ||
      (m.category && m.category.toLowerCase() === selectedSubject.toLowerCase());

    return matchesSearch && matchesSubject;
  });

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {terms?.materialsLabel || 'Study Material & Handouts'}
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
              title="Study Materials Help"
            >
              <HelpCircle size={17} />
            </button>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Lesson handouts, slide decks, syllabus worksheets, and guides distributed for {user?.major || 'Class 10-A'}
          </p>
        </div>

        <button
          onClick={fetchMaterials}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          title="Refresh Materials"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)'
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search study materials, topics, handouts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '36px',
              paddingTop: '0.55rem',
              paddingBottom: '0.55rem',
              fontSize: '0.86rem',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={13} /> Subject:
          </span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem'
            }}
          >
            {availableSubjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div
          className="card"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)'
          }}
        >
          <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem', color: '#2563EB' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
            Fetching Study Materials...
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
            Verifying class enrollment and requesting authorized material documents.
          </p>
        </div>
      ) : error ? (
        <div
          className="card"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          <AlertCircle size={36} color="#DC2626" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#DC2626', margin: '0 0 0.5rem' }}>
            Failed to Load Study Materials
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1rem' }}>
            {error}
          </p>
          <button onClick={fetchMaterials} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.84rem' }}>
            Retry Loading
          </button>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            border: '2px dashed var(--border-default)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: '#2563EB'
            }}
          >
            <BookOpen size={28} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            No study materials found
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
            {searchTerm || selectedSubject !== 'All'
              ? 'No study materials matched your current search filters. Try clearing filters to see all available handouts.'
              : 'When your teachers publish lecture slides, worksheets, or PDFs for your class, they will appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1.25rem' }}>
          {filteredMaterials.map((item) => {
            const file = item.files && item.files[0];
            const fileSize = file?.size
              ? (file.size / (1024 * 1024)).toFixed(2) + ' MB'
              : null;

            return (
              <div
                key={item.id || item._id}
                className="card"
                style={{
                  padding: '1.4rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  minWidth: 0,
                  overflow: 'hidden',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  {/* Category and Date Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        color: '#2563EB',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {item.subject || item.category || 'General'}
                    </span>

                    {item.resourceType && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {item.resourceType}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontSize: '1.08rem',
                      fontWeight: 800,
                      margin: '0 0 0.5rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      hyphens: 'auto'
                    }}
                    title={item.title}
                  >
                    {item.title && item.title.includes('_') && !item.title.includes(' ')
                      ? item.title.replace(/_+/g, ' ')
                      : (item.title || 'Untitled Document')}
                  </h3>

                  {/* Content snippet if available */}
                  {item.content && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.content}
                    </p>
                  )}

                  {/* File Metadata */}
                  {file && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        marginTop: '0.5rem'
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <FileText size={17} />
                      </div>
                      <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {file.originalName}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {fileSize ? `${fileSize} · ` : ''}Backblaze B2 Verified
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer and Download Action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid var(--border-default)'
                  }}
                >
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Published {new Date(item.createdAt || Date.now()).toLocaleDateString()}
                  </div>

                  {file ? (
                    <button
                      onClick={() => handleDownload(item)}
                      disabled={downloadingId === item.id}
                      className="btn-primary"
                      style={{
                        padding: '0.45rem 0.95rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Download size={14} className={downloadingId === item.id ? 'spin' : ''} />
                      <span>{downloadingId === item.id ? 'Authorizing...' : 'Download Resource'}</span>
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Text Note
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showHelp && (
        <SchoolContextualHelpModal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title="Study Material Help"
          guidance="All lecture handouts, textbook chapters, and review exercises uploaded by your teachers are stored securely in Backblaze B2 cloud storage. Click 'Download Resource' to generate a secure, temporary download link."
        />
      )}
    </div>
  );
};
