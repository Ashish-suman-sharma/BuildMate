'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';
import { useTheme } from '@/contexts/ThemeContext';

interface Project {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  status: string;
  progress: {
    completedTasks: number;
    totalTasks: number;
    progressPercent: number;
  };
  createdAt: any;
}

export default function DashboardPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toasts, removeToast, success, error } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; title: string; step: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!user) {
      router.push('/auth');
      return;
    }

    loadProjects();
  }, [user, router, authLoading]);

  const loadProjects = async () => {
    if (!user) return;
    
    try {
      // Try with orderBy first (requires index)
      let q = query(
        collection(db, 'projects'),
        where('ownerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      try {
        const snapshot = await getDocs(q);
        const projectsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Project[];
        
        setProjects(projectsData);
        console.log('✅ Loaded projects:', projectsData.length);
      } catch (indexError: any) {
        // If index error, fall back to simple query without orderBy
        if (indexError.code === 'failed-precondition') {
          console.warn('⚠️ Firestore index needed, loading without sort...');
          const simpleQuery = query(
            collection(db, 'projects'),
            where('ownerId', '==', user.uid)
          );
          const snapshot = await getDocs(simpleQuery);
          const projectsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Project[];
          
          // Sort manually by createdAt on client side
          projectsData.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || new Date(0);
            const bTime = b.createdAt?.toDate?.() || new Date(0);
            return bTime.getTime() - aTime.getTime();
          });
          
          setProjects(projectsData);
          console.log('✅ Loaded projects (without index):', projectsData.length);
        } else {
          throw indexError;
        }
      }
    } catch (error) {
      console.error('❌ Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'active') return p.status === 'active' && p.progress.progressPercent < 100;
    if (filter === 'completed') return p.progress.progressPercent === 100;
    return true;
  });

  const handleDeleteClick = (projectId: string, projectTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to project
    setDeleteConfirmation({ id: projectId, title: projectTitle, step: 1 });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.step === 1) {
      // First confirmation - move to step 2
      setDeleteConfirmation({ ...deleteConfirmation, step: 2 });
    } else {
      // Second confirmation - actually delete
      setDeleting(true);
      try {
        await deleteDoc(doc(db, 'projects', deleteConfirmation.id));
        // Remove from local state
        setProjects(projects.filter(p => p.id !== deleteConfirmation.id));
        console.log('✅ Project deleted successfully');
        success('🗑️ Project deleted successfully');
        setDeleteConfirmation(null);
      } catch (err) {
        console.error('❌ Error deleting project:', err);
        error('Failed to delete project. Please try again.');
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user display name and avatar
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userAvatar = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&bold=true`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Enhanced Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo and Navigation */}
            <div className="flex items-center space-x-8">
              <button 
                onClick={() => router.push('/home')}
                className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                  BuildMate
                </h1>
              </button>
              
              <nav className="hidden md:flex space-x-1">
                <button 
                  onClick={() => router.push('/home')} 
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                >
                  Home
                </button>
                <button 
                  onClick={() => router.push('/dashboard')} 
                  className="px-4 py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold rounded-lg"
                >
                  Dashboard
                </button>
              </nav>
            </div>

            {/* Theme Toggle & User Profile */}
            <div className="flex items-center space-x-4">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5 text-gray-700 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              {/* User Profile */}
              <div className="relative user-menu-container" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group"
                >
                <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {displayName}
                </span>
                <img
                  src={userAvatar}
                  alt={displayName}
                  className="w-10 h-10 rounded-full ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-800"
                />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/profile');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/dashboard');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>My Projects</span>
                  </button>

                  <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        signOut();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-2">
              Your Projects
            </h2>
            <p className="text-gray-600 dark:text-gray-400 flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{projects.length} total project{projects.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <button
            onClick={() => router.push('/home')}
            className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Project</span>
          </button>
        </div>

        {/* Enhanced Filter Tabs */}
        <div className="flex flex-wrap gap-3 mb-10">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-2 border-gray-200 dark:border-gray-700'
            }`}
          >
            <span className="flex items-center space-x-2">
              <span>All</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                filter === 'all' ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                {projects.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 ${
              filter === 'active'
                ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-2 border-gray-200 dark:border-gray-700'
            }`}
          >
            <span className="flex items-center space-x-2">
              <span>Active</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                filter === 'active' ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                {projects.filter(p => p.status === 'active' && p.progress.progressPercent < 100).length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 ${
              filter === 'completed'
                ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-2 border-gray-200 dark:border-gray-700'
            }`}
          >
            <span className="flex items-center space-x-2">
              <span>Completed</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                filter === 'completed' ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                {projects.filter(p => p.progress.progressPercent === 100).length}
              </span>
            </span>
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <div className="text-7xl mb-6 animate-bounce">📦</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {filter === 'all' ? 'No projects yet' : `No ${filter} projects`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              {filter === 'all' 
                ? 'Start your learning journey by creating your first project!'
                : `You don't have any ${filter} projects at the moment.`
              }
            </p>
            {filter === 'all' && (
              <button
                onClick={() => router.push('/home')}
                className="px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Create Your First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/project/${project.id}`)}
                className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 overflow-hidden transform hover:-translate-y-2"
              >
                {/* Enhanced Project Header with gradient */}
                <div className={`relative p-6 ${
                  project.progress.progressPercent === 100
                    ? 'bg-gradient-to-br from-green-500 via-green-600 to-green-700'
                    : 'bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-white/30 backdrop-blur-sm text-white shadow-lg">
                      {project.difficulty}
                    </span>
                    <div className="flex items-center space-x-2">
                      {/* Delete Button - Subtle & Aesthetic */}
                      <button
                        onClick={(e) => handleDeleteClick(project.id, project.title, e)}
                        className="group/delete relative px-3 py-1.5 bg-red-500/90 hover:bg-red-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-1.5"
                        title="Delete this project"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="text-white font-semibold text-xs">Delete</span>
                      </button>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                </div>

                {/* Project Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                    {project.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 line-clamp-3 leading-relaxed">
                    {project.description}
                  </p>

                  {/* Enhanced Progress */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Progress</span>
                      <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                        {project.progress.progressPercent}%
                      </span>
                    </div>
                    <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                          project.progress.progressPercent === 100
                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                            : 'bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700'
                        }`}
                        style={{ width: `${project.progress.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{project.progress.completedTasks} / {project.progress.totalTasks} tasks</span>
                      <span className="flex items-center space-x-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Track Progress</span>
                      </span>
                    </div>
                  </div>

                  {/* Enhanced Status Badge/Button */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                    {project.progress.progressPercent === 100 ? (
                      <div className="flex items-center justify-center space-x-2 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl font-semibold border border-green-200 dark:border-green-800">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Project Completed</span>
                      </div>
                    ) : (
                      <button className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white px-4 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2">
                        <span>Continue Building</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 transform animate-in zoom-in-95 duration-300">
            {/* Warning Icon */}
            <div className="flex justify-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                deleteConfirmation.step === 1 
                  ? 'bg-yellow-100 dark:bg-yellow-900/30' 
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                <svg 
                  className={`w-8 h-8 ${
                    deleteConfirmation.step === 1 
                      ? 'text-yellow-600 dark:text-yellow-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Title and Message */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {deleteConfirmation.step === 1 ? 'Delete Project?' : 'Are You Absolutely Sure?'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {deleteConfirmation.step === 1 
                  ? 'You are about to delete:'
                  : 'This action cannot be undone. You will permanently lose:'
                }
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg mb-4">
                "{deleteConfirmation.title}"
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {deleteConfirmation.step === 1 
                  ? 'All progress, tasks, and data will be permanently deleted.'
                  : '⚠️ This will delete all milestones, tasks, and your entire progress!'
                }
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className={`flex-1 px-6 py-3 font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 ${
                  deleteConfirmation.step === 1
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                }`}
              >
                {deleting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>{deleteConfirmation.step === 1 ? 'Yes, Delete' : 'Permanently Delete'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
