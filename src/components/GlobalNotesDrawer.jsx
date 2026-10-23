import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  StickyNote,
  X,
  Plus,
  Pin,
  Trash2,
  Copy,
  Check,
  Search,
  Tag,
  Download,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Filter,
  Layers,
  FileText
} from 'lucide-react';

export const GlobalNotesDrawer = () => {
  const {
    notesDrawerOpen,
    setNotesDrawerOpen,
    studyNotes,
    addStudyNote,
    updateStudyNote,
    deleteStudyNote,
    togglePinStudyNote,
    activeTab,
    addToast
  } = useLMS();

  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [copiedId, setCopiedId] = useState(null);

  // Form State for new note
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newColor, setNewColor] = useState('emerald');
  const [isPinned, setIsPinned] = useState(false);
  const [newNoteId, setNewNoteId] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Filtered & Sorted Notes (covers both College & School subjects)
  const categories = [
    'All',
    'Python Programming',
    'Database Systems (SQL)',
    'C++ & OOP',
    'Web Development',
    'Code Lab & Algorithms',
    'CS 401 Deep Learning',
    'DS 202 Algorithms',
    'CS 330 Systems',
    'General',
    'Exam Prep'
  ];

  const filteredNotes = studyNotes
    .filter((note) => {
      const matchCat = categoryFilter === 'All' || note.category === categoryFilter;
      const matchSearch =
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() && pendingFiles.length === 0) return;

    await addStudyNote({
      id: newNoteId,
      title: newTitle || 'Untitled Note with Attachment',
      content: newContent,
      category: newCategory,
      color: newColor,
      pinned: isPinned,
      sourcePage: activeTab,
      files: pendingFiles
    });

    setNewTitle('');
    setNewContent('');
    setPendingFiles([]);
    setIsCreating(false);
  };
  
  const handleStartCreate = () => {
    setNewNoteId(`note-${Date.now()}`);
    setPendingFiles([]);
    setIsCreating(!isCreating);
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 25 * 1024 * 1024) {
      addToast('File too large', 'Max file size is 25MB', 'urgent');
      return;
    }
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteId', newNoteId);
    
    const result = await apiService.uploadNoteFile(formData);
    if (result.success) {
      setPendingFiles([...pendingFiles, result.file]);
      addToast('File Uploaded', `${file.name} attached.`, 'emerald');
    } else {
      addToast('Upload Failed', result.error, 'urgent');
    }
    setIsUploading(false);
  };
  
  const handleDownloadFile = async (noteId, s3Key, originalName) => {
    addToast('Requesting link...', 'Generating secure download link', 'subtle');
    const url = await apiService.getNoteFileUrl(noteId, s3Key);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      addToast('Download Failed', 'Could not retrieve file.', 'urgent');
    }
  };

  const handleCopyNote = (note) => {
    navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
    addToast('Note Copied', 'Content copied to clipboard.', 'emerald');
  };

  const handleExportAll = () => {
    const markdownContent = studyNotes
      .map(
        (n) =>
          `# ${n.title}\n*Category: ${n.category} | Created: ${new Date(n.createdAt).toLocaleDateString()}*\n\n${n.content}\n\n---\n`
      )
      .join('\n');

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexus_study_notes_${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('Notes Exported', 'All study notes downloaded as Markdown.', 'emerald');
  };

  const getColorStyles = (color) => {
    switch (color) {
      case 'amber':
        return { border: '#FDE68A', bg: '#FFFBEB', tag: '#B45309' };
      case 'cyan':
        return { border: '#BAE6FD', bg: '#F0F9FF', tag: '#0369A1' };
      case 'rose':
        return { border: '#FECDD3', bg: '#FFF1F2', tag: '#BE123C' };
      case 'purple':
        return { border: '#DDD6FE', bg: '#F5F3FF', tag: '#6D28D9' };
      case 'emerald':
      default:
        return { border: '#A7F3D0', bg: '#ECFDF5', tag: '#047857' };
    }
  };

  return (
    <>
      {/* 1. FLOATING QUICK TRIGGER BUTTON (Always visible across every site page) */}
      <button
        onClick={() => setNotesDrawerOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 95,
          backgroundColor: '#FFFFFF',
          border: '1.5px solid var(--accent-primary)',
          borderRadius: 'var(--radius-full)',
          padding: '0.65rem 1.15rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-card)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
          e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = 'var(--shadow-card)';
        }}
        title="Universal Sticky Notes (Ctrl+J)"
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ECFDF5',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <StickyNote size={14} />
        </div>
        <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>Notes</span>
        <span
          style={{
            fontSize: '0.7rem',
            padding: '1px 6px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: '#D1FAE5',
            color: 'var(--accent-primary)',
            fontWeight: 800
          }}
        >
          {studyNotes.length}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '2px' }}>[Ctrl+J]</span>
      </button>

      {/* 2. SLIDE-OUT SCRATCHPAD DRAWER */}
      {notesDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setNotesDrawerOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              height: '100%',
              backgroundColor: '#FFFFFF',
              borderLeft: '1px solid var(--border-default)',
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFDF5',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #A7F3D0'
                  }}
                >
                  <StickyNote size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                    Study Notes & Scratchpad
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Accessible on every page • Auto-saved to your browser
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={handleExportAll}
                  className="btn-icon"
                  style={{ width: '32px', height: '32px' }}
                  title="Export Notes as Markdown (.md)"
                >
                  <Download size={15} />
                </button>
                <button
                  onClick={() => setNotesDrawerOpen(false)}
                  className="btn-icon"
                  style={{ width: '32px', height: '32px' }}
                  title="Close Drawer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick Action & Search Bar */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.01)'
              }}
            >
              {/* Search input + New Note Button */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search
                    size={14}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search notes, algorithms, keywords..."
                    style={{
                      width: '100%',
                      paddingLeft: '32px',
                      paddingTop: '0.45rem',
                      paddingBottom: '0.45rem',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>

                <button
                  onClick={handleStartCreate}
                  className="btn-primary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  <Plus size={15} />
                  <span>{isCreating ? 'Cancel' : 'New Note'}</span>
                </button>
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    style={{
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.72rem',
                      fontWeight: categoryFilter === cat ? 700 : 500,
                      backgroundColor: categoryFilter === cat ? '#ECFDF5' : 'var(--bg-surface)',
                      color: categoryFilter === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      border: `1px solid ${categoryFilter === cat ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Note Creation Form (Collapsible) */}
            {isCreating && (
              <form
                onSubmit={handleCreateNote}
                style={{
                  padding: '1.25rem 1.5rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderBottom: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  animation: 'fadeIn 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                    📝 New Quick Note on {activeTab}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPinned(!isPinned)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isPinned ? '#D97706' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Pin size={13} />
                    <span>{isPinned ? 'Pinned' : 'Pin Note'}</span>
                  </button>
                </div>

                <input
                  type="text"
                  required
                  placeholder="Note Title (e.g. GPT-2 Attention Equation)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />

                <textarea
                  rows={4}
                  placeholder="Write note contents, formulas, markdown bullets, reminders..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  style={{ width: '100%', fontSize: '0.84rem', resize: 'vertical', fontFamily: 'var(--font-mono)' }}
                />
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {pendingFiles.map((f, i) => (
                     <div key={i} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={12} /> {f.originalName} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                     </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                      <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
                      <div className="btn-secondary" style={{ padding: '0.25rem 0.5rem', pointerEvents: 'none' }}>
                         {isUploading ? <Sparkles size={12} className="spin" /> : <Plus size={12} />} Attach File
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                  >
                    <option value="CS 401 Deep Learning">CS 401 Deep Learning</option>
                    <option value="DS 202 Algorithms">DS 202 Algorithms</option>
                    <option value="Code Lab & Algorithms">Code Lab & Algorithms</option>
                    <option value="CS 330 Systems">CS 330 Systems</option>
                    <option value="Exam Prep">Exam Prep</option>
                    <option value="General">General</option>
                  </select>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Scrollable Notes List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              {filteredNotes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    No notes found
                  </div>
                  <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                    {searchTerm ? 'Try adjusting your search query' : 'Click "New Note" to jot down thoughts on this page!'}
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const colorStyles = getColorStyles(note.color);
                  return (
                    <div
                      key={note.id}
                      style={{
                        backgroundColor: colorStyles.bg,
                        border: `1px solid ${note.pinned ? 'var(--accent-primary)' : colorStyles.border}`,
                        borderRadius: 'var(--radius-lg)',
                        padding: '1rem 1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                    >
                      {/* Card Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: colorStyles.tag,
                              backgroundColor: 'rgba(255, 255, 255, 0.7)',
                              border: `1px solid ${colorStyles.border}`,
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            {note.category}
                          </span>
                          {note.pinned && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                color: '#D97706',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontWeight: 700
                              }}
                            >
                              <Pin size={11} fill="currentColor" /> Pinned
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            onClick={() => togglePinStudyNote(note.id)}
                            className="btn-icon"
                            style={{ width: '26px', height: '26px' }}
                            title={note.pinned ? 'Unpin' : 'Pin to top'}
                          >
                            <Pin size={12} color={note.pinned ? '#D97706' : 'var(--text-muted)'} />
                          </button>

                          <button
                            onClick={() => handleCopyNote(note)}
                            className="btn-icon"
                            style={{ width: '26px', height: '26px' }}
                            title="Copy Note Text"
                          >
                            {copiedId === note.id ? (
                              <Check size={12} color="var(--accent-primary)" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>

                          <button
                            onClick={() => deleteStudyNote(note.id)}
                            className="btn-icon"
                            style={{ width: '26px', height: '26px', color: '#DC2626' }}
                            title="Delete Note"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {note.title}
                      </h4>

                      {/* Content */}
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          fontFamily: note.content?.includes('```') ? 'var(--font-mono)' : 'inherit'
                        }}
                      >
                        {note.content}
                      </div>

                      {note.files && note.files.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                          {note.files.map((file, idx) => (
                            <div key={idx} onClick={() => handleDownloadFile(note.id, file.s3Key, file.originalName)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                              <FileText size={14} color="var(--accent-primary)" />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{file.originalName}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Timestamp & Source Page Footer */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid var(--border-default)',
                          paddingTop: '0.5rem',
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)'
                        }}
                      >
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        {note.sourcePage && <span>📍 {note.sourcePage}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
