'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

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
      const q = query(
        collection(db, 'projects'),
        where('ownerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">BuildMate</h1>
            <nav className="hidden md:flex space-x-6">
              <button onClick={() => router.push('/home')} className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium">
                Home
              </button>
              <button onClick={() => router.push('/dashboard')} className="text-primary-600 dark:text-primary-400 font-medium">
                Dashboard
              </button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Your Projects</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {projects.length} total project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => router.push('/home')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            + New Project
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 mb-8 bg-white dark:bg-gray-800 rounded-lg p-1 w-fit shadow-sm">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-600 text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All ({projects.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              filter === 'active'
                ? 'bg-primary-600 text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Active ({projects.filter(p => p.status === 'active' && p.progress.progressPercent < 100).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-primary-600 text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Completed ({projects.filter(p => p.progress.progressPercent === 100).length})
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No projects yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start building something amazing!
            </p>
            <button
              onClick={() => router.push('/home')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/project/${project.id}`)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 overflow-hidden"
              >
                {/* Project Header */}
                <div className={`p-4 ${
                  project.progress.progressPercent === 100
                    ? 'bg-gradient-to-r from-green-500 to-green-600'
                    : 'bg-gradient-to-r from-primary-500 to-primary-600'
                }`}>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    project.difficulty === 'beginner' ? 'bg-white/20 text-white' :
                    project.difficulty === 'intermediate' ? 'bg-white/20 text-white' :
                    'bg-white/20 text-white'
                  }`}>
                    {project.difficulty}
                  </span>
                </div>

                {/* Project Content */}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {project.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                        {project.progress.progressPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-primary-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${project.progress.progressPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {project.progress.completedTasks} / {project.progress.totalTasks} tasks completed
                    </p>
                  </div>

                  {/* Status Badge */}
                  {project.progress.progressPercent === 100 ? (
                    <div className="flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-2 rounded-lg text-sm font-medium">
                      ✓ Completed
                    </div>
                  ) : (
                    <button className="w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      Continue Building →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
