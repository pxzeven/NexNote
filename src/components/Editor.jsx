import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Columns, LayoutPanelLeft, Trash2, Copy, Check, Palette, Menu, X, Info, Settings2, ChevronDown, ChevronRight, Type, PenTool, RotateCcw } from 'lucide-react';

function Editor({ note, isReadOnly, theme: appTheme, onSave, onDelete }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [showPreview, setShowPreview] = useState(false);
  const [showEdited, setShowEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const [texture, setTexture] = useState(() => localStorage.getItem('nexnote-texture') || 'none');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTextSettingsOpen, setIsTextSettingsOpen] = useState(false);
  const [typography, setTypography] = useState(() => {
    const saved = localStorage.getItem('nexnote-typography');
    return saved ? JSON.parse(saved) : {
      fontFamily: 'var(--font-sans), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '14',
      fontStyle: 'normal',
      lineHeight: '26',
      optimalLineLength: false
    };
  });
  const [writingSettings, setWritingSettings] = useState(() => {
    const saved = localStorage.getItem('nexnote-writing');
    return saved ? JSON.parse(saved) : {
      writingDirection: 'ltr',
      spellcheck: false,
      tabIndentation: false,
      breakReminders: false
    };
  });
  const [isWritingSettingsOpen, setIsWritingSettingsOpen] = useState(false);
  const textareaRef = useRef(null);
  const previousNoteId = useRef(note.id);

  useEffect(() => {
    localStorage.setItem('nexnote-typography', JSON.stringify(typography));
  }, [typography]);

  const updateTypography = (key, value) => {
    setTypography(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    localStorage.setItem('nexnote-writing', JSON.stringify(writingSettings));
  }, [writingSettings]);

  const updateWritingSettings = (key, value) => {
    setWritingSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPreferences = () => {
    setTypography({
      fontFamily: 'var(--font-sans), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '14',
      fontStyle: 'normal',
      lineHeight: '26',
      optimalLineLength: false
    });
    setWritingSettings({
      writingDirection: 'ltr',
      spellcheck: false,
      tabIndentation: false,
      breakReminders: false
    });
  };

  // Break reminders logic
  useEffect(() => {
    let interval;
    if (writingSettings.breakReminders) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
      
      interval = setInterval(() => {
        if (Notification.permission === "granted") {
          new Notification("Time for a break!", {
            body: "You've been writing for 30 minutes. Rest your eyes for a bit."
          });
        } else {
          alert("Time for a break! You've been writing for 30 minutes.");
        }
      }, 30 * 60 * 1000); // 30 mins
    }
    return () => clearInterval(interval);
  }, [writingSettings.breakReminders]);

  useEffect(() => {
    localStorage.setItem('nexnote-texture', texture);
  }, [texture]);

  const cycleTexture = () => {
    const textures = ['none', 'paper', 'grid', 'dots'];
    const currentIndex = textures.indexOf(texture);
    const nextIndex = (currentIndex + 1) % textures.length;
    setTexture(textures[nextIndex]);
  };

  // Sync with app theme
  useEffect(() => {
    const updateTheme = () => {
      if (appTheme === 'system') {
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(isDark ? 'dark' : 'light');
      } else if (appTheme === 'glossy') {
        setResolvedTheme('dark');
      } else {
        setResolvedTheme(appTheme);
      }
    };
    
    updateTheme();

    if (appTheme === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => setResolvedTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [appTheme]);

  // Update local state when note prop changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    
    if (note.id !== previousNoteId.current) {
      const isTempSaving = previousNoteId.current?.startsWith('temp-') && !note.id.startsWith('temp-');
      if (!isTempSaving && textareaRef.current) {
        textareaRef.current.scrollTop = 0;
      }
      previousNoteId.current = note.id;
    }
  }, [note.id]);

  // Debounced auto-save
  useEffect(() => {
    if (isReadOnly) return;
    const timer = setTimeout(() => {
      if (title !== note.title || content !== note.content) {
        onSave(note.id, title, content);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [title, content, note.id, isReadOnly]);

  // Check if it's a markdown file (or no extension) for preview functionality
  const isMarkdown = !title.includes('.') || title.toLowerCase().endsWith('.md');

  const handleContentChange = (e) => {
    const newContent = e.target.value || '';
    setContent(newContent);
  };

  const handleKeyDown = (e) => {
    if (isReadOnly) return;
    
    if (e.key === 'Tab' && writingSettings.tabIndentation) {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
      return;
    }

    if (e.key === 'Enter') {
      const textarea = e.target;
      const cursorPosition = textarea.selectionStart;
      const currentValue = textarea.value;
      const textBeforeCursor = currentValue.substring(0, cursorPosition);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];

      const ulMatch = currentLine.match(/^(\s*)([-*])\s+(.*)$/);
      const olMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);

      if (ulMatch || olMatch) {
        e.preventDefault();
        
        let insertText = '';
        let shouldRemoveLine = false;

        if (ulMatch) {
          const [, indent, bullet, text] = ulMatch;
          if (!text.trim()) {
            shouldRemoveLine = true;
          } else {
            insertText = `\n${indent}${bullet} `;
          }
        } else if (olMatch) {
          const [, indent, numStr, text] = olMatch;
          if (!text.trim()) {
            shouldRemoveLine = true;
          } else {
            const num = parseInt(numStr, 10);
            insertText = `\n${indent}${num + 1}. `;
          }
        }

        if (shouldRemoveLine) {
          textarea.setSelectionRange(cursorPosition - currentLine.length, cursorPosition);
          document.execCommand('insertText', false, '\n');
        } else {
          document.execCommand('insertText', false, insertText);
        }
      }
    }
  };

  const formatHeaderDate = (timestamp, isEditedMode) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const prefix = isEditedMode ? 'Edited' : 'Created';
    return `${prefix}: ${month} ${day}, ${year} at ${time}`;
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="editor-container" data-color-mode={resolvedTheme}>
      <div className="editor-header" data-tauri-drag-region style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
          {wordCount} words &bull; {charCount} characters
        </div>
        <div className="editor-actions">
          <button 
            className="icon-btn" 
            onClick={cycleTexture}
            data-tooltip={`Texture: ${texture}`}
          >
            <Palette size={16} />
          </button>
          <button 
            className="icon-btn" 
            onClick={handleCopy}
            data-tooltip="Copy Note Content"
          >
            {copied ? <Check size={16} color="var(--accent)" /> : <Copy size={16} />}
          </button>
          
          {isMarkdown && (
            <button 
              className="icon-btn" 
              onClick={() => setShowPreview(!showPreview)}
              data-tooltip={showPreview ? "Hide Preview" : "Show Split Preview"}
            >
              {showPreview ? <LayoutPanelLeft size={16} /> : <Columns size={16} />}
            </button>
          )}

          {!isReadOnly && (
            <button 
              className="icon-btn" 
              onClick={onDelete}
              data-tooltip="Move to Trash"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button 
            className="icon-btn" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            data-tooltip="Settings"
            style={{ marginLeft: '4px' }}
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>
      
      {isReadOnly && (
        <div style={{ backgroundColor: 'var(--text-muted)', color: 'var(--bg-color)', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 500 }}>
          This note is in the Trash and is read-only. Restore it to edit.
        </div>
      )}
      
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <div className="editor-content" style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', opacity: isReadOnly ? 0.7 : 1 }}>
        <div className={`texture-${texture}`} data-tauri-drag-region dir={writingSettings.writingDirection} style={{ flex: 1, width: showPreview && isMarkdown ? '50%' : '100%', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: 'var(--bg-color)' }}>
          <div 
            style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '16px 0 8px', fontWeight: 500, opacity: 0.8, cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 10 }}
            onClick={() => setShowEdited(!showEdited)}
            data-tooltip="Click to toggle Created/Edited time"
          >
            {showEdited 
              ? formatHeaderDate(note.updatedAt || note.createdAt, true) 
              : formatHeaderDate(note.createdAt || note.updatedAt, false)}
          </div>
          <textarea
            ref={textareaRef}
            className="textarea"
            value={content}
            placeholder="Start typing..."
            onChange={isReadOnly ? undefined : handleContentChange}
            onKeyDown={handleKeyDown}
            disabled={isReadOnly}
            spellCheck={writingSettings.spellcheck}
            dir="auto"
            style={{
              flex: 1,
              fontFamily: typography.fontFamily,
              fontSize: `${typography.fontSize}px`,
              fontStyle: typography.fontStyle,
              lineHeight: `${typography.lineHeight}px`,
              width: '100%',
              maxWidth: typography.optimalLineLength ? '700px' : 'none',
              margin: typography.optimalLineLength ? '0 auto' : '0',
              textAlign: writingSettings.writingDirection === 'rtl' ? 'right' : 'left'
            }}
          />
        </div>
        
        {showPreview && isMarkdown && (
          <div className="markdown-preview" dir="auto" style={{ 
            flex: 1, 
            overflowY: 'auto',
            fontFamily: typography.fontFamily,
            fontSize: `${typography.fontSize}px`,
            fontStyle: typography.fontStyle,
            lineHeight: `${typography.lineHeight}px`,
            textAlign: writingSettings.writingDirection === 'rtl' ? 'right' : 'left'
          }}>
            <div style={{
              maxWidth: typography.optimalLineLength ? '700px' : 'none',
              margin: typography.optimalLineLength ? '0 auto' : '0'
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <div className={`right-sidebar ${isMenuOpen ? 'open' : ''}`}>
        <div className="right-sidebar-header">
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings2 size={14} /> Settings
          </h3>
          <button className="icon-btn" onClick={() => setIsMenuOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <div className="right-sidebar-content">
          <div className="settings-group">
            <div className="settings-header" onClick={() => setIsTextSettingsOpen(!isTextSettingsOpen)}>
              <div className="settings-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Type size={16} /> Text
              </div>
              {isTextSettingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            
            {isTextSettingsOpen && (
              <div className="settings-content">
                <div className="settings-item">
                  <div className="settings-label">Font</div>
                  <select 
                    className="settings-select"
                    value={typography.fontFamily}
                    onChange={(e) => updateTypography('fontFamily', e.target.value)}
                  >
                    <option value="var(--font-sans), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">Default (System Font)</option>
                    <option value="'Inter', sans-serif">Inter (Sans-serif)</option>
                    <option value="Georgia, 'Times New Roman', serif">Georgia (Serif)</option>
                    <option value="'Fira Code', 'Courier New', monospace">Fira Code (Monospace)</option>
                  </select>
                </div>
                
                <div className="settings-item">
                  <div className="settings-label">Font size</div>
                  <select 
                    className="settings-select"
                    value={typography.fontSize}
                    onChange={(e) => updateTypography('fontSize', e.target.value)}
                  >
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                    <option value="20">20</option>
                    <option value="24">24</option>
                  </select>
                </div>
                
                <div className="settings-item">
                  <div className="settings-label">Font style</div>
                  <select 
                    className="settings-select"
                    value={typography.fontStyle}
                    onChange={(e) => updateTypography('fontStyle', e.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>
                
                <div className="settings-item">
                  <div className="settings-label">
                    Line height
                    <span data-tooltip="Adjust the vertical spacing between lines of text" style={{ display: 'inline-flex' }}>
                      <Info size={12} color="var(--text-muted)" style={{ marginLeft: '4px', cursor: 'help' }} />
                    </span>
                  </div>
                  <select 
                    className="settings-select"
                    value={typography.lineHeight}
                    onChange={(e) => updateTypography('lineHeight', e.target.value)}
                  >
                    <option value="20">20</option>
                    <option value="24">24</option>
                    <option value="26">26</option>
                    <option value="28">28</option>
                    <option value="32">32</option>
                  </select>
                </div>
                
                <div className="settings-item" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', display: 'flex' }}>
                  <div className="settings-label" style={{ marginBottom: 0 }}>
                    Optimal line length
                    <span data-tooltip="Limit the line width for a better reading experience" style={{ display: 'inline-flex' }}>
                      <Info size={12} color="var(--text-muted)" style={{ marginLeft: '4px', cursor: 'help' }} />
                    </span>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={typography.optimalLineLength}
                      onChange={(e) => updateTypography('optimalLineLength', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            )}
          </div>
          
          {/* Writing Settings Group */}
          <div className="settings-group">
            <div className="settings-header" onClick={() => setIsWritingSettingsOpen(!isWritingSettingsOpen)}>
              <div className="settings-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PenTool size={16} /> Writing
              </div>
              {isWritingSettingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            
            {isWritingSettingsOpen && (
              <div className="settings-content">
                <div className="settings-item">
                  <div className="settings-label">Writing direction</div>
                  <select 
                    className="settings-select"
                    value={writingSettings.writingDirection}
                    onChange={(e) => updateWritingSettings('writingDirection', e.target.value)}
                  >
                    <option value="ltr">Left to right</option>
                    <option value="rtl">Right to left</option>
                  </select>
                </div>
                
                <div className="settings-item" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', display: 'flex' }}>
                  <div className="settings-label" style={{ marginBottom: 0 }}>
                    Spellcheck
                    <span data-tooltip="Enable browser's native spell checker" style={{ display: 'inline-flex' }}>
                      <Info size={12} color="var(--text-muted)" style={{ marginLeft: '4px', cursor: 'help' }} />
                    </span>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={writingSettings.spellcheck}
                      onChange={(e) => updateWritingSettings('spellcheck', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                
                <div className="settings-item" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', display: 'flex' }}>
                  <div className="settings-label" style={{ marginBottom: 0 }}>
                    Tab Indentation
                    <span data-tooltip="Pressing Tab key inserts spaces instead of changing focus" style={{ display: 'inline-flex' }}>
                      <Info size={12} color="var(--text-muted)" style={{ marginLeft: '4px', cursor: 'help' }} />
                    </span>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={writingSettings.tabIndentation}
                      onChange={(e) => updateWritingSettings('tabIndentation', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                
                <div className="settings-item" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', display: 'flex' }}>
                  <div className="settings-label" style={{ marginBottom: 0 }}>
                    Break Reminders
                    <span data-tooltip="Receive a system notification to rest every 30 minutes" style={{ display: 'inline-flex' }}>
                      <Info size={12} color="var(--text-muted)" style={{ marginLeft: '4px', cursor: 'help' }} />
                    </span>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={writingSettings.breakReminders}
                      onChange={(e) => updateWritingSettings('breakReminders', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={resetPreferences}
            className="reset-preferences-btn"
          >
            <RotateCcw size={14} />
            Reset preferences
          </button>
        </div>
      </div>

      </div>
    </div>
  );
}

export default Editor;
