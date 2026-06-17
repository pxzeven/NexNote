import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';

function App() {
  const [notes, setNotes] = useState([]);
  const [trashedNotes, setTrashedNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [viewMode, setViewMode] = useState('notes'); // 'notes' or 'trash'
  const [theme, setTheme] = useState(() => localStorage.getItem('nexnote-theme') || 'system');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    localStorage.setItem('nexnote-theme', theme);
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    loadNotes();
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const update = await check();
      if (update) {
        setUpdateInfo(update);
      }
    } catch (err) {
      console.error("Failed to check for updates", err);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateInfo) return;
    setIsUpdating(true);
    try {
      await updateInfo.downloadAndInstall();
      await relaunch();
    } catch (err) {
      console.error("Failed to install update", err);
      setIsUpdating(false);
    }
  };

  const loadNotes = async () => {
    try {
      const loadedNotes = await invoke('get_notes');
      setNotes(loadedNotes);
      const loadedTrashed = await invoke('get_trashed_notes');
      setTrashedNotes(loadedTrashed);
    } catch (err) {
      console.error("Failed to load notes", err);
    }
  };

  const handleCreateNote = async () => {
    const tempId = `temp-${Date.now()}`;
    const newNote = {
      id: tempId,
      title: 'Untitled Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setNotes([newNote, ...notes]);
    setActiveNoteId(tempId);
  };

  const handleSaveNote = async (id, title, content) => {
    if (viewMode === 'trash') return;
    const isTemp = id.startsWith('temp-');
    
    // Don't save to disk if it's a completely blank new note
    if (isTemp && !content.trim() && title === 'Untitled Note') {
      return;
    }

    try {
      const saveId = isTemp ? '' : id;
      const updatedNote = await invoke('save_note', { id: saveId, title, content });
      
      // Update the notes list. If ID changed (temp -> real), replace it properly
      setNotes(prevNotes => prevNotes.map(n => n.id === id ? updatedNote : n));
      
      if (isTemp) {
         setActiveNoteId(prevId => prevId === id ? updatedNote.id : prevId);
      }
    } catch (err) {
      console.error("Failed to save note", err);
      // browser fallback
      const newId = isTemp ? Date.now().toString() : id;
      setNotes(prevNotes => prevNotes.map(n => n.id === id ? { ...n, id: newId, title, content, updatedAt: Date.now() } : n));
      if (isTemp) setActiveNoteId(newId);
    }
  };

  const handleDeleteNote = async (id) => {
    if (id.startsWith('temp-')) {
      setNotes(notes.filter(n => n.id !== id));
      if (activeNoteId === id) setActiveNoteId(null);
      return;
    }
    
    try {
      const success = await invoke('delete_note', { id });
      if (success) {
        loadNotes();
        if (activeNoteId === id) setActiveNoteId(null);
      }
    } catch (err) {
       console.error("Failed to delete note", err);
       setNotes(notes.filter(n => n.id !== id));
       if (activeNoteId === id) setActiveNoteId(null);
    }
  };

  const handleDuplicateNote = async (id) => {
    const noteToDuplicate = notes.find(n => n.id === id);
    if (!noteToDuplicate) return;

    const newTitle = `${noteToDuplicate.title} - Copy`;

    try {
      const savedNote = await invoke('save_note', { id: '', title: newTitle, content: noteToDuplicate.content });
      setNotes([savedNote, ...notes]);
      setActiveNoteId(savedNote.id);
    } catch (err) {
      console.error("Failed to duplicate note", err);
      const fakeNote = { id: Date.now().toString(), title: newTitle, content: noteToDuplicate.content, updatedAt: Date.now() };
      setNotes([fakeNote, ...notes]);
      setActiveNoteId(fakeNote.id);
    }
  };

  const handleRestoreNote = async (id) => {
    try {
      const success = await invoke('restore_note', { id });
      if (success) {
        loadNotes();
        if (activeNoteId === id) setActiveNoteId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermanentlyDeleteNote = async (id) => {
    try {
      const success = await invoke('permanently_delete_note', { id });
      if (success) {
        loadNotes();
        if (activeNoteId === id) setActiveNoteId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const success = await invoke('empty_trash');
      if (success) {
        loadNotes();
        // Clear active note if it was in the trash
        if (viewMode === 'trash' && activeNoteId) {
          setActiveNoteId(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameNote = async (id, newTitle) => {
    const note = notes.find(n => n.id === id);
    if (!note || !newTitle.trim() || newTitle === note.title) return;

    if (id.startsWith('temp-')) {
      await handleSaveNote(id, newTitle.trim(), note.content);
      return;
    }

    try {
      const newId = await invoke('rename_note', { id, newTitle: newTitle.trim() });
      if (newId) {
        loadNotes();
        if (activeNoteId === id) setActiveNoteId(newId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeNote = viewMode === 'notes' 
    ? notes.find(n => n.id === activeNoteId)
    : trashedNotes.find(n => n.id === activeNoteId);

  return (
    <div className="app-container">
      <Sidebar 
        notes={notes} 
        trashedNotes={trashedNotes}
        viewMode={viewMode}
        setViewMode={setViewMode}
        theme={theme}
        setTheme={setTheme}
        activeNoteId={activeNoteId} 
        onSelectNote={setActiveNoteId} 
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        onDuplicateNote={handleDuplicateNote}
        onRenameNote={handleRenameNote}
        onRestoreNote={handleRestoreNote}
        onPermanentlyDeleteNote={handlePermanentlyDeleteNote}
        onEmptyTrash={handleEmptyTrash}
        updateInfo={updateInfo}
        isUpdating={isUpdating}
        onInstallUpdate={handleInstallUpdate}
      />
      {activeNote ? (
        <Editor 
          note={activeNote} 
          isReadOnly={viewMode === 'trash'}
          theme={theme}
          onSave={handleSaveNote}
          onDelete={() => handleDeleteNote(activeNote.id)}
        />
      ) : (
        <div className="empty-state" data-tauri-drag-region>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <p>Select a note or create a new one</p>
        </div>
      )}
      {updateInfo && (
        <button 
          onClick={handleInstallUpdate}
          disabled={isUpdating}
          className="update-btn"
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            fontSize: '12px',
            padding: '8px 16px',
            borderRadius: '24px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            cursor: isUpdating ? 'wait' : 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          title={`Update to v${updateInfo.version}`}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; }}
        >
          {isUpdating ? 'Updating...' : `✨ Update Available (v${updateInfo.version})`}
        </button>
      )}
    </div>
  );
}

export default App;
