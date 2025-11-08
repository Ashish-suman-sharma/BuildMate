'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Task {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  difficulty: string;
  requiredSkills: string[];
  resources: Array<{ title: string; url: string; type: string }>;
  done: boolean;
  locked: boolean;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  tasks: Task[];
}

interface ProjectData {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  roadmap: { milestones: Milestone[] };
  progress: { completedTasks: number; totalTasks: number; progressPercent: number };
}

export default function ProjectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!user || !projectId) {
      router.push('/auth');
      return;
    }

    // Subscribe to project updates
    const unsubscribe = onSnapshot(doc(db, 'projects', projectId), (doc) => {
      if (doc.exists()) {
        setProject({ id: doc.id, ...doc.data() } as ProjectData);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, projectId, router, authLoading]);

  const toggleTaskDone = async (milestoneId: string, taskId: string) => {
    if (!project) return;

    // Find the current task to check if we're marking it as done
    let currentTask: Task | null = null;
    for (const milestone of project.roadmap.milestones) {
      for (const task of milestone.tasks) {
        if (milestone.id === milestoneId && task.id === taskId) {
          currentTask = task;
          break;
        }
      }
      if (currentTask) break;
    }

    if (!currentTask || currentTask.locked) return;

    const isMarkingAsDone = !currentTask.done; // Will be true if currently unchecked

    const updatedMilestones = project.roadmap.milestones.map(milestone => {
      if (milestone.id === milestoneId) {
        return {
          ...milestone,
          tasks: milestone.tasks.map(task => {
            if (task.id === taskId) {
              return { ...task, done: !task.done };
            }
            return task;
          })
        };
      }
      return milestone;
    });

    // Find next task to unlock ONLY if we're marking current task as done
    if (isMarkingAsDone) {
      let foundCurrent = false;
      let nextTask: { milestoneId: string; taskId: string } | null = null;
      
      for (const milestone of updatedMilestones) {
        for (const task of milestone.tasks) {
          if (foundCurrent && task.locked && !task.done) {
            nextTask = { milestoneId: milestone.id, taskId: task.id };
            break;
          }
          if (milestone.id === milestoneId && task.id === taskId) {
            foundCurrent = true;
          }
        }
        if (nextTask) break;
      }

      // Unlock next task
      if (nextTask) {
        updatedMilestones.forEach(milestone => {
          if (milestone.id === nextTask!.milestoneId) {
            milestone.tasks.forEach(task => {
              if (task.id === nextTask!.taskId) {
                task.locked = false;
              }
            });
          }
        });
      }
    }

    // Calculate progress
    let completedTasks = 0;
    let totalTasks = 0;
    updatedMilestones.forEach(m => {
      m.tasks.forEach(t => {
        totalTasks++;
        if (t.done) completedTasks++;
      });
    });

    const progressPercent = Math.round((completedTasks / totalTasks) * 100);

    // Update Firestore
    await updateDoc(doc(db, 'projects', projectId), {
      'roadmap.milestones': updatedMilestones,
      'progress.completedTasks': completedTasks,
      'progress.totalTasks': totalTasks,
      'progress.progressPercent': progressPercent,
      updatedAt: new Date(),
    });
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !project || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    // Add user message to chat
    const newUserMsg = {
      sender: 'user',
      text: userMessage,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newUserMsg]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          message: userMessage,
          context: {
            projectTitle: project.title,
            currentMilestone: getCurrentMilestone(),
          },
        }),
      });

      const data = await response.json();

      // Add AI response to chat
      const aiMsg = {
        sender: 'ai',
        text: data.response,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMsg]);

      // Save to Firestore
      await addDoc(collection(db, 'projects', projectId, 'chat'), newUserMsg);
      await addDoc(collection(db, 'projects', projectId, 'chat'), aiMsg);
    } catch (error) {
      console.error('Error sending chat message:', error);
    } finally {
      setChatLoading(false);
    }
  };

  const getCurrentMilestone = () => {
    if (!project) return null;
    for (const milestone of project.roadmap.milestones) {
      const hasIncompleteTasks = milestone.tasks.some(t => !t.done);
      if (hasIncompleteTasks) return milestone;
    }
    return project.roadmap.milestones[project.roadmap.milestones.length - 1];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-primary-600 dark:text-primary-400 hover:underline mb-2"
          >
            ← Back to Dashboard
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">{project.description}</p>
              <div className="flex gap-3 mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  project.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  project.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {project.difficulty}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowChat(!showChat)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
            >
              {showChat ? 'Hide' : 'AI Mentor'} 💬
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overall Progress</h2>
            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {project.progress.progressPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${project.progress.progressPercent}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {project.progress.completedTasks} of {project.progress.totalTasks} tasks completed
          </p>
        </div>

        {/* Milestones */}
        <div className="space-y-6">
          {project.roadmap.milestones.map((milestone, mIndex) => (
            <div key={milestone.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full text-sm">
                    {mIndex + 1}
                  </span>
                  {milestone.title}
                </h3>
                <p className="text-primary-50 mt-1">{milestone.description}</p>
                <p className="text-primary-100 text-sm mt-2">
                  ⏱️ Estimated: {milestone.estimatedHours} hours
                </p>
              </div>

              <div className="p-6 space-y-4">
                {milestone.tasks.map((task, tIndex) => (
                  <div
                    key={task.id}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      task.locked
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 opacity-60'
                        : task.done
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                        : 'border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={task.done}
                        disabled={task.locked}
                        onChange={() => toggleTaskDone(milestone.id, task.id)}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className={`font-semibold ${task.done ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {task.title}
                          </h4>
                          {task.locked && <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">🔒 Locked</span>}
                          <span className={`text-xs px-2 py-1 rounded ${
                            task.difficulty === 'easy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            task.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {task.difficulty}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{task.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                          ⏱️ ~{task.estimatedHours}h | 🎯 Skills: {task.requiredSkills.join(', ')}
                        </p>

                        {/* Resources */}
                        {task.resources && task.resources.length > 0 && !task.locked && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">📚 Learning Resources:</p>
                            {task.resources.map((resource, rIndex) => (
                              <a
                                key={rIndex}
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                {resource.type === 'video' ? '🎥' : resource.type === 'article' ? '📝' : '📖'} {resource.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* AI Chat Modal */}
      {showChat && (
        <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3 rounded-t-2xl flex justify-between items-center">
            <h3 className="text-white font-semibold">AI Mentor</h3>
            <button onClick={() => setShowChat(false)} className="text-white hover:text-gray-200">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-8">
                Ask me anything about your project! 💡
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  msg.sender === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
