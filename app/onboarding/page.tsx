'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function OnboardingPage() {
  const [skillText, setSkillText] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !skillText.trim()) return;

    setLoading(true);

    try {
      // Call API to parse skills using Gemini AI
      const response = await fetch('/api/parse-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: skillText, uid: user.uid }),
      });

      const data = await response.json();

      // Update user profile in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        skills: data.skills || [],
        preferredTech: data.preferredTech || [],
        experience: data.experience || 'beginner',
        timeBudget: data.timeBudget || 'flexible',
        completedOnboarding: true,
      });

      router.push('/home');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        completedOnboarding: true,
      });
      router.push('/home');
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to BuildMate! 🚀
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Tell us about your skills and goals in your own words
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="skills" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Describe your skills, experience, and project goals
            </label>
            <textarea
              id="skills"
              rows={8}
              value={skillText}
              onChange={(e) => setSkillText(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              placeholder="Example: I'm a beginner web developer with basic HTML, CSS, and JavaScript knowledge. I've completed a few online courses on React. I want to build a full-stack project using modern technologies. I have about 10 hours per week to dedicate to learning and building."
              required
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              💡 Include: your experience level, technologies you know, time available, and what you want to learn
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || !skillText.trim()}
              className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Why we ask:
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <span className="text-primary-500 mr-2">✓</span>
              <span>Get personalized project suggestions that match your skill level</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-500 mr-2">✓</span>
              <span>Receive realistic timelines based on your availability</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-500 mr-2">✓</span>
              <span>Get AI mentor guidance tailored to your learning pace</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
