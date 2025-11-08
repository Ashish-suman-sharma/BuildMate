'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Project {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: string;
}

export default function HomePage() {
  const { user, userProfile, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedProjects, setSuggestedProjects] = useState<Project[]>([]);
  const [generatedProjects, setGeneratedProjects] = useState<Project[]>([]);
  const [userProjects, setUserProjects] = useState<any[]>([]);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!user) {
      router.push('/auth');
      return;
    }

    if (userProfile && !userProfile.completedOnboarding) {
      router.push('/onboarding');
      return;
    }

    // Load suggested projects and user's existing projects
    loadSuggestedProjects();
    loadUserProjects();
  }, [user, userProfile, router, authLoading]);

  const loadSuggestedProjects = async () => {
    if (!user) return;
    
    try {
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      const profile = profileDoc.data();
      
      if (profile?.suggestedProjects) {
        setSuggestedProjects(profile.suggestedProjects);
      } else {
        // Generate initial suggestions
        const response = await fetch('/api/suggest-projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, profile }),
        });
        const data = await response.json();
        setSuggestedProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error loading suggested projects:', error);
    }
  };

  const loadUserProjects = async () => {
    if (!user) return;
    
    try {
      const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
      const snapshot = await getDocs(q);
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserProjects(projects);
    } catch (error) {
      console.error('Error loading user projects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    setLoading(true);
    setGeneratedProjects([]);

    try {
      // Determine if input is a skill or project idea
      const response = await fetch('/api/generate-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: input.trim(),
          uid: user.uid,
          profile: userProfile
        }),
      });

      const data = await response.json();
      setGeneratedProjects(data.projects || []);
    } catch (error) {
      console.error('Error generating projects:', error);
      alert('Failed to generate projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = async (project: Project) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          project,
          uid: user.uid,
          profile: userProfile
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate project roadmap');
      }

      const data = await response.json();
      
      // Save project to Firestore on client side
      const projectRef = await addDoc(collection(db, 'projects'), data.projectData);
      
      router.push(`/project/${projectRef.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
              <button onClick={() => router.push('/dashboard')} className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium">
                Dashboard
              </button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{userProfile?.email}</span>
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
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            What do you want to build today?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Enter a skill you want to learn or describe a project idea
          </p>
        </div>

        {/* Main Input */}
        <div className="max-w-3xl mx-auto mb-12">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., 'React hooks' or 'A task management app'"
              className="w-full px-6 py-5 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:text-white shadow-lg"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '...' : 'Generate'}
            </button>
          </form>
        </div>

        {/* Suggested Projects */}
        {suggestedProjects.length > 0 && !generatedProjects.length && (
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Suggested for you
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {suggestedProjects.map((project, index) => (
                <ProjectCard key={index} project={project} onSelect={handleSelectProject} />
              ))}
            </div>
          </div>
        )}

        {/* Generated Projects */}
        {generatedProjects.length > 0 && (
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Generated project ideas
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {generatedProjects.map((project, index) => (
                <ProjectCard key={index} project={project} onSelect={handleSelectProject} />
              ))}
            </div>
          </div>
        )}

        {/* Recent Projects */}
        {userProjects.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Your recent projects
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {userProjects.slice(0, 3).map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-shadow cursor-pointer p-6 border border-gray-200 dark:border-gray-700"
                >
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {project.title}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {project.progress?.completedTasks || 0} / {project.progress?.totalTasks || 0} tasks
                    </span>
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${project.progress?.progressPercent || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project, onSelect }: { project: Project; onSelect: (p: Project) => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500">
      <div className="mb-4">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
          project.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          project.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}>
          {project.difficulty}
        </span>
      </div>
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {project.title}
      </h4>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
        {project.description}
      </p>
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
        <span>⏱️ {project.estimatedTime}</span>
      </div>
      <button
        onClick={() => onSelect(project)}
        className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
      >
        Start Building
      </button>
    </div>
  );
}
