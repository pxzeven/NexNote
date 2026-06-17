import { useState, useEffect, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { SquarePen, Trash2, Search, Pin, ArchiveRestore, FileText, PinOff, Edit2, Copy, Monitor, Sun, Moon, Palette } from 'lucide-react';

function Sidebar({ notes, trashedNotes, viewMode, setViewMode, theme, setTheme, activeNoteId, onSelectNote, onCreateNote, onDeleteNote, onDuplicateNote, onRenameNote, onRestoreNote, onPermanentlyDeleteNote, onEmptyTrash }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [pinnedNotes, setPinnedNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('nexnote-pinned');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('nexnote-sidebar-width');
      return saved ? parseInt(saved, 10) : 230;
    } catch {
      return 230;
    }
  });

  useEffect(() => {
    localStorage.setItem('nexnote-pinned', JSON.stringify(pinnedNotes));
  }, [pinnedNotes]);

  useEffect(() => {
    localStorage.setItem('nexnote-sidebar-width', width);
  }, [width]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    let newWidth = e.clientX;
    if (newWidth < 180) newWidth = 180;
    if (newWidth > 500) newWidth = 500;
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getPreview = (content) => {
    if (!content) return 'No additional text';
    const preview = content.replace(/[\r\n]+/g, ' ').replace(/[#*`_~>\[\]]/g, '').trim();
    return preview ? preview.substring(0, 40) : 'No additional text';
  };

  const currentNotes = viewMode === 'notes' ? notes : (trashedNotes || []);
  
  const filteredNotes = useMemo(() => {
    return currentNotes.filter(note => {
      const titleMatch = (note.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      const contentMatch = (note.content || '').toLowerCase().includes(searchQuery.toLowerCase());
      return titleMatch || contentMatch;
    });
  }, [currentNotes, searchQuery]);

  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => {
      const aPinned = pinnedNotes.includes(a.id);
      const bPinned = pinnedNotes.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0; // maintain relative order for both pinned/unpinned
    });
  }, [filteredNotes, pinnedNotes]);

  const handleContextMenu = (e, noteId) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, noteId });
  };

  return (
    <div className="sidebar" style={{ width: `${width}px` }}>
      <div data-tauri-drag-region style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '38px', zIndex: 0 }} />
      <div className="sidebar-resizer" onMouseDown={handleMouseDown} />
      <div className="sidebar-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Nex Note</h2>
          <div style={{ position: 'relative', width: '26px', height: '26px' }}>
            <button 
              className="icon-btn" 
              onClick={onCreateNote} 
              data-tooltip="New Note"
              style={{ position: 'absolute', top: 0, left: 0, opacity: viewMode === 'notes' ? 1 : 0, pointerEvents: viewMode === 'notes' ? 'auto' : 'none' }}
            >
              <SquarePen size={18} />
            </button>
            <button 
              className="icon-btn" 
              onClick={() => {
                if(window.confirm('Are you sure you want to permanently delete all notes in the trash?')) {
                  onEmptyTrash();
                }
              }} 
              data-tooltip="Empty Trash"
              style={{ position: 'absolute', top: 0, left: 0, opacity: viewMode === 'trash' ? 1 : 0, pointerEvents: viewMode === 'trash' && trashedNotes && trashedNotes.length > 0 ? 'auto' : 'none', color: trashedNotes && trashedNotes.length > 0 ? 'var(--accent-color, #f44336)' : 'var(--text-muted)' }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="search-container">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="tab-container-wrapper">
        <div className="tab-container">
          <div 
            className={`tab-item ${viewMode === 'notes' ? 'active' : ''}`}
            onClick={() => { setViewMode('notes'); onSelectNote(null); }}
          >
             <FileText size={14} />
             <span>Notes</span>
          </div>
          <div 
            className={`tab-item ${viewMode === 'trash' ? 'active' : ''}`}
            onClick={() => { setViewMode('trash'); onSelectNote(null); }}
          >
             <Trash2 size={14} />
             <span>Trash</span>
          </div>
        </div>
      </div>
      <div className="notes-list">
        {sortedNotes.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            {searchQuery ? 'No matching notes found.' : 'No notes yet. Click the + icon to create one.'}
          </div>
        ) : (
          sortedNotes.map(note => (
            <div 
              key={note.id} 
              className={`note-item ${activeNoteId === note.id ? 'active' : ''}`}
              onClick={() => onSelectNote(note.id)}
              onContextMenu={(e) => handleContextMenu(e, note.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="note-item-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {pinnedNotes.includes(note.id) && <Pin size={12} fill="currentColor" style={{ flexShrink: 0, transform: 'rotate(45deg)', opacity: 0.8 }} />}
                    {editingNoteId === note.id ? (
                      <input 
                        type="text" 
                        value={editTitle}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/[<>:"/\\|?*]/.test(val)) {
                            alert('Note names cannot contain any of the following characters: < > : " / \\ | ? *');
                            return;
                          }
                          setEditTitle(val);
                        }}
                        onBlur={() => {
                          if (onRenameNote) onRenameNote(note.id, editTitle);
                          setEditingNoteId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (onRenameNote) onRenameNote(note.id, editTitle);
                            setEditingNoteId(null);
                          } else if (e.key === 'Escape') {
                            setEditingNoteId(null);
                          }
                        }}
                        autoFocus
                        style={{ width: '100%', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', outline: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span 
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'none' }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (viewMode === 'notes') {
                            setEditingNoteId(note.id);
                            setEditTitle(note.title || 'Untitled Note');
                          }
                        }}
                        data-tooltip="Double-click to rename"
                      >
                        {note.title || 'Untitled Note'}
                      </span>
                    )}
                  </div>
                  <div className="note-item-preview-row">
                    <span className="note-item-date">{formatDate(note.updatedAt)}</span>
                    <span className="note-item-preview">{getPreview(note.content)}</span>
                  </div>
                </div>
                {activeNoteId === note.id && viewMode === 'notes' && (
                  <button 
                    className="icon-btn" 
                    style={{ padding: '4px', marginLeft: '8px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNote(note.id);
                    }}
                    data-tooltip="Delete Note"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {activeNoteId === note.id && viewMode === 'trash' && (
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                    <button 
                      className="icon-btn" 
                      style={{ padding: '4px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreNote(note.id);
                      }}
                      data-tooltip="Restore Note"
                    >
                      <ArchiveRestore size={14} />
                    </button>
                    <button 
                      className="icon-btn" 
                      style={{ padding: '4px', color: 'var(--accent-color)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPermanentlyDeleteNote(note.id);
                      }}
                      data-tooltip="Permanently Delete Note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="sidebar-footer" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--border)', padding: '2px', borderRadius: '6px' }}>
          <button 
            className="icon-btn"
            style={{ padding: '4px 12px', backgroundColor: theme === 'system' ? 'var(--bg-color)' : 'transparent', boxShadow: theme === 'system' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', color: theme === 'system' ? 'var(--text-main)' : 'var(--text-muted)' }}
            onClick={() => setTheme('system')}
            data-tooltip="System Theme"
          >
            <Monitor size={14} />
          </button>
          <button 
            className="icon-btn"
            style={{ padding: '4px 12px', backgroundColor: theme === 'light' ? 'var(--bg-color)' : 'transparent', boxShadow: theme === 'light' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', color: theme === 'light' ? 'var(--text-main)' : 'var(--text-muted)' }}
            onClick={() => setTheme('light')}
            data-tooltip="Light Theme"
          >
            <Sun size={14} />
          </button>
          <button 
            className="icon-btn"
            style={{ padding: '4px 12px', backgroundColor: theme === 'dark' ? 'var(--bg-color)' : 'transparent', boxShadow: theme === 'dark' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', color: theme === 'dark' ? 'var(--text-main)' : 'var(--text-muted)' }}
            onClick={() => setTheme('dark')}
            data-tooltip="Dark Theme"
          >
            <Moon size={14} />
          </button>
          <button 
            className="icon-btn"
            style={{ 
              padding: '4px 12px', 
              backgroundColor: ['glossy', 'ocean', 'sunset', 'forest'].includes(theme) ? 'var(--bg-color)' : 'transparent', 
              boxShadow: ['glossy', 'ocean', 'sunset', 'forest'].includes(theme) ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', 
              color: ['glossy', 'ocean', 'sunset', 'forest'].includes(theme) ? 'var(--text-main)' : 'var(--text-muted)' 
            }}
            onClick={() => {
              const themes = ['glossy', 'ocean', 'sunset', 'forest'];
              const idx = themes.indexOf(theme);
              if (idx === -1) {
                setTheme('glossy');
              } else {
                setTheme(themes[(idx + 1) % themes.length]);
              }
            }}
            data-tooltip={['glossy', 'ocean', 'sunset', 'forest'].includes(theme) ? `Colorful: ${theme.charAt(0).toUpperCase() + theme.slice(1)}` : "Colorful Themes"}
          >
            <Palette size={14} />
          </button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Created by <span 
            style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold' }}
            onClick={async () => {
              try {
                await open('https://t.me/pxzeven');
              } catch (e) {
                console.error(e);
              }
            }}
            data-tooltip="Visit ZEVEN's Telegram"
          >
            ZEVEN
          </span>
        </div>
      </div>

      {contextMenu && (
        <div 
          className="custom-context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {viewMode === 'trash' ? (
            <>
              <div className="menu-item" onClick={() => { if (onRestoreNote) onRestoreNote(contextMenu.noteId); setContextMenu(null); }}>
                <ArchiveRestore size={14} /> Restore Note
              </div>
              <div className="menu-separator"></div>
              <div className="menu-item danger" onClick={() => { if (onPermanentlyDeleteNote) onPermanentlyDeleteNote(contextMenu.noteId); setContextMenu(null); }}>
                <Trash2 size={14} /> Permanently Delete
              </div>
            </>
          ) : (
            <>
              <div className="menu-item" onClick={() => {
                const isPinned = pinnedNotes.includes(contextMenu.noteId);
                if (isPinned) setPinnedNotes(pinnedNotes.filter(id => id !== contextMenu.noteId));
                else setPinnedNotes([...pinnedNotes, contextMenu.noteId]);
                setContextMenu(null);
              }}>
                {pinnedNotes.includes(contextMenu.noteId) ? <PinOff size={14} /> : <Pin size={14} />} 
                {pinnedNotes.includes(contextMenu.noteId) ? 'Unpin Note' : 'Pin Note'}
              </div>
              <div className="menu-item" onClick={() => {
                const noteToRename = notes.find(n => n.id === contextMenu.noteId);
                if (noteToRename) {
                  setEditingNoteId(contextMenu.noteId);
                  setEditTitle(noteToRename.title || 'Untitled Note');
                }
                setContextMenu(null);
              }}>
                <Edit2 size={14} /> Rename
              </div>
              <div className="menu-item" onClick={() => {
                if (onDuplicateNote) onDuplicateNote(contextMenu.noteId);
                setContextMenu(null);
              }}>
                <Copy size={14} /> Duplicate Note
              </div>
              <div className="menu-separator"></div>
              <div className="menu-item danger" onClick={() => {
                onDeleteNote(contextMenu.noteId);
                setContextMenu(null);
              }}>
                <Trash2 size={14} /> Delete Note
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
