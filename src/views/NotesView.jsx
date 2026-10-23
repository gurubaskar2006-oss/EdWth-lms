import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  StickyNote,
  Plus,
  Pin,
  Trash2,
  Copy,
  Check,
  Search,
  Download,
  Clock,
  Sparkles,
  BookOpen,
  Filter,
  FileText,
  Tag,
  Edit3,
  Layers
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const NotesView = () => {
  usePageTitle('Notes');
  const {
    studyNotes,
    addStudyNote,
    updateStudyNote,
    deleteStudyNote,
    togglePinStudyNote,
    addToast
  } = useLMS();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [copiedId, setCopiedId] = useState(null);
  const [noteToDelete, setNoteToDelete] = useState(null);

  // New Note State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('CS 401 Deep Learning');
  const [newColor, setNewColor] = useState('emerald');
  const [isPinned, setIsPinned] = useState(false);
  
  const [newNoteId, setNewNoteId] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const categories = [
    'All',
    'CS 401 Deep Learning',
    'DS 202 Algorithms',
    'Code Lab & Algorithms',
    'CS 330 Systems',
    'Exam Prep',
    'General'
  ];

  const filteredNotes = studyNotes
    .filter((note) => {
      const matchCat = selectedCategory === 'All' || note.category === selectedCategory;
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
      sourcePage: 'My Study Notes',
      files: pendingFiles
    });

    setNewTitle('');
    setNewContent('');
    setPendingFiles([]);
    setIsModalOpen(false);
  };
  
  const handleStartCreate = () => {
    setNewNoteId(`note-${Date.now()}`);
    setPendingFiles([]);
    setIsModalOpen(true);
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
    
    const result = await (await import('../services/apiService')).apiService.uploadNoteFile(formData);
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
    const { apiService } = await import('../services/apiService');
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
    link.download = `lumina_study_notes_${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('Notes Exported', 'All study notes downloaded as Markdown (.md).', 'emerald');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '2.5rem' }}>
      {/* Header with Search & Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-info">Knowledge Vault</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {studyNotes.length} Notes Synchronized Across All Pages
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            My Study Notes & Scratchpad
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Organize lecture equations, code snippets, algorithm proofs, and exam preparation checklists
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleExportAll}
            className="btn-secondary"
            style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
          >
            <Download size={15} />
            <span>Export Markdown (.md)</span>
          </button>

          <button
            onClick={handleStartCreate}
            className="btn-primary"
            style={{ padding: '0.55rem 1.15rem', fontSize: '0.82rem' }}
          >
            <Plus size={16} />
            <span>Create New Note</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '0.85rem 1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '450px' }}>
          <Search
            size={16}
            color="var(--text-secondary)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notes by keyword, title, or formula..."
            style={{ width: '100%', paddingLeft: '36px', fontSize: '0.86rem' }}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '2px' }}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? 700 : 500,
                  backgroundColor: isSelected ? 'var(--accent-blue)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {filteredNotes.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '4rem 1rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <FileText size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              No study notes found
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.35rem' }}>
              {searchTerm ? 'No results matched your search' : 'Click "Create New Note" to add your first study note!'}
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className="card card-interactive"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: `1px solid ${note.pinned ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                borderLeft: note.pinned ? '4px solid var(--accent-blue)' : '1px solid var(--border-default)',
                padding: '1.35rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-card)'
              }}
            >
              {/* Note Top Bar */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                    {note.category}
                  </span>
                  {note.pinned && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--accent-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 700
                      }}
                    >
                      <Pin size={11} fill="currentColor" /> Pinned
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    onClick={() => togglePinStudyNote(note.id)}
                    className="btn-icon"
                    style={{ width: '28px', height: '28px' }}
                    title={note.pinned ? 'Unpin Note' : 'Pin Note to Top'}
                  >
                    <Pin size={13} color={note.pinned ? 'var(--accent-blue)' : 'var(--text-muted)'} />
                  </button>

                  <button
                    onClick={() => handleCopyNote(note)}
                    className="btn-icon"
                    style={{ width: '28px', height: '28px' }}
                    title="Copy Note Text"
                  >
                    {copiedId === note.id ? <Check size={13} color="var(--accent-primary)" /> : <Copy size={13} />}
                  </button>

                  <button
                    onClick={() => setNoteToDelete(note.id)}
                    className="btn-icon"
                    style={{ width: '28px', height: '28px', color: '#DC2626' }}
                    title="Delete Note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Title */}
              <h3 style={{ fontSize: '1.08rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {note.title}
              </h3>

              {/* Note Content */}
              <div
                style={{
                  fontSize: '0.84rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  fontFamily: note.content?.includes('```') ? 'var(--font-mono)' : 'inherit',
                  flex: 1
                }}
              >
                {note.content}
              </div>
              
              {note.files && note.files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {note.files.map((file, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleDownloadFile(note.id, file.s3Key, file.originalName)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      <FileText size={16} color="var(--accent-blue)" />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>{file.originalName}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Note Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-default)',
                  paddingTop: '0.65rem',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)'
                }}
              >
                <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                {note.sourcePage && <span>📍 {note.sourcePage}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE NOTE MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '580px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '1.25rem' }}>
              Create New Study Note
            </h3>

            <form onSubmit={handleCreateNote} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Note Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scaled Dot-Product Attention Formula"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Category / Course
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="CS 401 Deep Learning">CS 401 Deep Learning</option>
                  <option value="DS 202 Algorithms">DS 202 Algorithms</option>
                  <option value="Code Lab & Algorithms">Code Lab & Algorithms</option>
                  <option value="CS 330 Systems">CS 330 Systems</option>
                  <option value="Exam Prep">Exam Prep</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Note Content (Supports Markdown, Math & Code)
                </label>
                <textarea
                  rows={6}
                  placeholder="Type notes, algorithms, markdown bullets..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Attachments
                </label>
                {pendingFiles.map((f, i) => (
                   <div key={i} style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-default)' }}>
                      <FileText size={14} /> {f.originalName} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                   </div>
                ))}
                <div>
                  <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                    <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
                    {isUploading ? <Sparkles size={14} className="spin" /> : <Plus size={14} />} 
                    <span style={{ fontWeight: 600 }}>{isUploading ? 'Uploading...' : 'Attach File'}</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                  />
                  <span>Pin this note to top</span>
                </label>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Note
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={() => {
          deleteStudyNote(noteToDelete);
          setNoteToDelete(null);
        }}
        title="Delete Study Note"
        message="Are you sure you want to delete this note? This action cannot be undone and you will lose any attached files."
        confirmText="Delete Note"
      />
    </div>
  );
};
