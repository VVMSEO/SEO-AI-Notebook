import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Send, 
  Loader2, 
  Calendar, 
  Briefcase, 
  ChevronRight,
  Sparkles,
  History,
  X,
  Copy,
  Download,
  BookmarkPlus,
  LogOut,
  LogIn,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { refineNote, generateReport } from './services/geminiService';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, addDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import Markdown from 'react-markdown';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Note {
  id: string;
  project: string;
  raw: string;
  refined: string;
  timestamp: string;
  uid?: string;
  createdAt?: any;
}

interface Template {
  id: string;
  text: string;
  uid?: string;
  createdAt?: any;
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentProject, setCurrentProject] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('seo-draft-project') || '';
    }
    return '';
  });
  const [newNote, setNewNote] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('seo-draft-note') || '';
    }
    return '';
  });
  const [isRefining, setIsRefining] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatTime = (note: Note) => {
    if (note.createdAt && typeof note.createdAt.toDate === 'function') {
      const date = note.createdAt.toDate();
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    }
    return note.timestamp;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seo-draft-project', currentProject);
    }
  }, [currentProject]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seo-draft-note', newNote);
    }
  }, [newNote]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      setNotes([]);
      setTemplates([]);
      return;
    }

    const notesQuery = query(
      collection(db, 'notes'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      setNotes(fetchedNotes);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes');
    });

    const templatesQuery = query(
      collection(db, 'templates'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
      const fetchedTemplates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Template[];
      setTemplates(fetchedTemplates);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'templates');
    });

    return () => {
      unsubscribeNotes();
      unsubscribeTemplates();
    };
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // User intentionally closed the popup or cancelled the request, ignore
        return;
      }
      console.error("Error signing in: ", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newNote.trim() || !user) return;
    if (templates.some(t => t.text === newNote.trim())) return;
    
    try {
      await addDoc(collection(db, 'templates'), {
        uid: user.uid,
        text: newNote.trim(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'templates');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'templates', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `templates/${id}`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !currentProject.trim() || !user) return;

    setIsRefining(true);
    try {
      const refined = await refineNote(newNote, currentProject);
      await addDoc(collection(db, 'notes'), {
        uid: user.uid,
        project: currentProject,
        raw: newNote,
        refined,
        timestamp: new Date().toLocaleString(),
        createdAt: serverTimestamp()
      });
      setNewNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    } finally {
      setIsRefining(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
    }
  };

  const handleGenerateReport = async () => {
    if (notes.length === 0) return;
    setIsGeneratingReport(true);
    try {
      const result = await generateReport(notes);
      setReport(result);
      setShowReportModal(true);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-report-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const projects = Array.from(new Set(notes.map(n => n.project)));

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-[#E2E8F0]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#EDEDED] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">SEO AI Notebook</h1>
            <p className="text-xs text-[#71717A] font-medium uppercase tracking-wider">Умный помощник для отчетов</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {user.photoURL && (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-[#EDEDED]" referrerPolicy="no-referrer" />
                )}
                <span className="text-sm font-medium hidden sm:block">{user.displayName}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-[#71717A] hover:bg-[#F1F1F1] rounded-lg transition-all"
                title="Выйти"
              >
                <LogOut size={18} />
              </button>
              <div className="w-px h-6 bg-[#EDEDED] mx-2"></div>
              <button 
                onClick={handleGenerateReport}
                disabled={notes.length === 0 || isGeneratingReport}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white rounded-lg text-sm font-medium hover:bg-[#333333] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGeneratingReport ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                Создать отчет
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#EDEDED] text-[#1A1A1A] rounded-lg text-sm font-medium hover:bg-[#F8F9FA] transition-all shadow-sm"
            >
              <LogIn size={16} />
              Войти через Google
            </button>
          )}
        </div>
      </header>

      {!user ? (
        <main className="max-w-5xl mx-auto p-6 flex flex-col items-center justify-center min-h-[70vh] text-center">
          <div className="w-20 h-20 bg-[#1A1A1A] rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl shadow-[#1A1A1A]/20">
            <Sparkles size={40} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-4">Добро пожаловать в SEO AI Notebook</h2>
          <p className="text-[#71717A] max-w-md mx-auto mb-8 leading-relaxed">
            Умный помощник для SEO-специалистов. Записывайте свои действия обычными словами, а ИИ превратит их в профессиональные отчеты.
          </p>
          <button 
            onClick={handleLogin}
            className="flex items-center gap-2 px-8 py-4 bg-[#1A1A1A] text-white rounded-xl text-base font-semibold hover:bg-[#333333] transition-all shadow-xl shadow-[#1A1A1A]/10"
          >
            <LogIn size={20} />
            Начать работу (Войти через Google)
          </button>
        </main>
      ) : (
        <main className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
        {/* Sidebar / Project Selector */}
        <aside className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-[#EDEDED] shadow-sm">
            <h2 className="text-xs font-bold text-[#71717A] uppercase tracking-widest mb-4 flex items-center gap-2">
              <Briefcase size={12} />
              Активные проекты
            </h2>
            <div className="space-y-1">
              <input
                type="text"
                placeholder="Название проекта..."
                value={currentProject}
                onChange={(e) => setCurrentProject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#EDEDED] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all mb-3"
              />
              {projects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {projects.map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentProject(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        currentProject === p 
                        ? 'bg-[#1A1A1A] text-white shadow-md' 
                        : 'bg-[#F1F1F1] text-[#71717A] hover:bg-[#E5E5E5]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#A1A1AA] italic">Проектов пока нет. Начните вводить выше.</p>
              )}
            </div>
          </div>

          <div className="bg-[#1A1A1A] p-5 rounded-2xl text-white shadow-xl overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-sm font-semibold mb-2">Совет</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Просто напишите, что вы сделали, обычными словами. ИИ автоматически превратит это в профессиональный пункт отчета.
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Sparkles size={80} />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="space-y-6 min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-[#EDEDED] shadow-sm w-fit">
            <button
              onClick={() => setActiveTab('input')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'input' 
                ? 'bg-[#1A1A1A] text-white shadow-md' 
                : 'text-[#71717A] hover:text-[#1A1A1A] hover:bg-[#F8F9FA]'
              }`}
            >
              Новая запись
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'history' 
                ? 'bg-[#1A1A1A] text-white shadow-md' 
                : 'text-[#71717A] hover:text-[#1A1A1A] hover:bg-[#F8F9FA]'
              }`}
            >
              История
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'history' ? 'bg-white/20' : 'bg-[#F1F1F1]'
              }`}>
                {notes.length}
              </span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'input' ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Input Form */}
                <form onSubmit={handleAddNote} className="bg-white p-6 rounded-2xl border border-[#EDEDED] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#71717A] uppercase tracking-widest">
                      <Plus size={12} />
                      Добавить активность
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={!newNote.trim()}
                      className="text-[10px] flex items-center gap-1 text-[#A1A1AA] hover:text-[#1A1A1A] disabled:opacity-50 transition-colors uppercase font-bold tracking-wider"
                    >
                      <BookmarkPlus size={12} />
                      Сохранить как шаблон
                    </button>
                  </div>

                  {templates.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {templates.map(t => (
                        <div 
                          key={t.id} 
                          className="group flex items-center gap-1 bg-[#F8F9FA] border border-[#EDEDED] text-[#71717A] pl-3 pr-1 py-1 rounded-lg text-xs font-medium cursor-pointer hover:border-[#1A1A1A]/20 hover:text-[#1A1A1A] transition-all"
                          onClick={() => setNewNote(t.text)}
                          title={t.text}
                        >
                          <span className="truncate max-w-[200px]">{t.text}</span>
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDeleteTemplate(t.id); 
                            }} 
                            className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity rounded-md hover:bg-red-50"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    placeholder="Что вы сделали сегодня? (например, 'поправил мета-теги для блога')"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full min-h-[150px] p-4 text-sm border border-[#EDEDED] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all resize-none bg-[#FAFAFA]"
                  />
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] text-[#A1A1AA] font-mono">
                      {currentProject ? `Проект: ${currentProject}` : 'Выберите или введите название проекта'}
                    </div>
                    <button
                      type="submit"
                      disabled={!newNote.trim() || !currentProject.trim() || isRefining}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#333333] transition-all disabled:opacity-50 shadow-lg shadow-[#1A1A1A]/10"
                    >
                      {isRefining ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                      Уточнить и добавить
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Activity Feed */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-[#71717A] uppercase tracking-widest flex items-center gap-2">
                    <History size={14} />
                    Последние действия
                  </h2>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar" ref={scrollRef}>
                  <AnimatePresence initial={false}>
                    {notes.slice().reverse().map((note) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group bg-white p-5 rounded-2xl border border-[#EDEDED] hover:border-[#1A1A1A]/20 transition-all shadow-sm relative"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 bg-[#F1F1F1] text-[#1A1A1A] text-[10px] font-bold rounded uppercase tracking-wider">
                              {note.project}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#A1A1AA] font-medium">
                              <Clock size={10} />
                              {formatTime(note)}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-[#A1A1AA] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="space-y-2 min-w-0">
                          <div className="prose prose-sm max-w-none text-sm font-medium text-[#1A1A1A] leading-relaxed break-words prose-a:break-all prose-p:leading-relaxed prose-pre:max-w-full prose-pre:overflow-x-auto">
                            <Markdown>{note.refined}</Markdown>
                          </div>
                          <div className="pt-2 border-t border-[#F5F5F5] flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-[#A1A1AA] italic shrink-0">Оригинал:</span>
                            <p className="text-[10px] text-[#A1A1AA] truncate italic flex-1 min-w-0">
                              {note.raw}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {notes.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-[#EDEDED]">
                      <div className="w-12 h-12 bg-[#F8F9FA] rounded-full flex items-center justify-center mx-auto mb-4 text-[#A1A1AA]">
                        <History size={24} />
                      </div>
                      <p className="text-sm text-[#71717A] font-medium">Записей пока нет.</p>
                      <p className="text-xs text-[#A1A1AA]">Ваши умные заметки появятся здесь.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
      )}

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-[#EDEDED] flex items-center justify-between bg-[#FAFAFA]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-white">
                    <FileText size={16} />
                  </div>
                  <h2 className="text-lg font-bold tracking-tight">Сгенерированный SEO отчет</h2>
                </div>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="p-2 hover:bg-[#EDEDED] rounded-full transition-all text-[#71717A]"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 max-h-[70vh] overflow-y-auto prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#333333]">
                  {report}
                </div>
              </div>
              <div className="px-8 py-6 border-t border-[#EDEDED] flex justify-end gap-3 bg-[#FAFAFA]">
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 px-6 py-2 bg-white border border-[#EDEDED] text-[#1A1A1A] rounded-xl text-sm font-semibold hover:bg-[#F8F9FA] transition-all shadow-sm"
                >
                  <Download size={16} />
                  Скачать .md
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(report || '');
                    alert('Отчет скопирован в буфер обмена!');
                  }}
                  className="flex items-center gap-2 px-6 py-2 bg-[#1A1A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#333333] transition-all shadow-lg shadow-[#1A1A1A]/10"
                >
                  <Copy size={16} />
                  Копировать
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #EDEDED;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D1D1;
        }
      `}</style>
    </div>
  );
}
