'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';
import { useTheme } from '@/contexts/ThemeContext';

interface UserProfile {
  name: string;
  email: string;
  bio: string;
  skills: string[];
  preferredTech: string[];
  experience: string;
  timeBudget: string;
  photoURL?: string;
}

export default function ProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toasts, removeToast, success, error } = useToast();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    bio: '',
    skills: [],
    preferredTech: [],
    experience: 'beginner',
    timeBudget: 'flexible',
  });
  const [editMode, setEditMode] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newTech, setNewTech] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userAvatar = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&bold=true`;

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/auth');
      return;
    }

    loadProfile();
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!showUserMenu) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          name: user.displayName || data.name || '',
          email: user.email || '',
          bio: data.bio || '',
          skills: data.skills || [],
          preferredTech: data.preferredTech || [],
          experience: data.experience || 'beginner',
          timeBudget: data.timeBudget || 'flexible',
          photoURL: user.photoURL || data.photoURL,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `profile-photos/${user.uid}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      // Update Firebase Auth profile
      await updateProfile(user, { photoURL });

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), { photoURL });

      setProfile(prev => ({ ...prev, photoURL }));
      
      // Reload the page to update the avatar everywhere
      window.location.reload();
    } catch (err) {
      console.error('Error uploading photo:', err);
      error('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: profile.name,
        bio: profile.bio,
        skills: profile.skills,
        preferredTech: profile.preferredTech,
        experience: profile.experience,
        timeBudget: profile.timeBudget,
      });

      // Update Firebase Auth display name if changed
      if (profile.name !== user.displayName) {
        await updateProfile(user, { displayName: profile.name });
      }

      setEditMode(false);
      success('✅ Profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      error('❌ Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile(prev => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setProfile(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  const addTech = () => {
    if (newTech.trim() && !profile.preferredTech.includes(newTech.trim())) {
      setProfile(prev => ({ ...prev, preferredTech: [...prev.preferredTech, newTech.trim()] }));
      setNewTech('');
    }
  };

  const removeTech = (tech: string) => {
    setProfile(prev => ({ ...prev, preferredTech: prev.preferredTech.filter(t => t !== tech) }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
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
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                >
                  Dashboard
                </button>
              </nav>
            </div>

            {/* User Profile */}
            <div className="flex items-center space-x-4">
              <div className="relative" ref={menuRef}>
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

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/profile');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 flex items-center space-x-3"
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

      {/* Profile Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Profile Header with Cover */}
          <div className="relative h-48 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500">
            <div className="absolute inset-0 bg-black/10"></div>
            
            {/* Edit Button */}
            <div className="absolute top-6 right-6">
              {!editMode ? (
                <button
                  onClick={() => setEditMode(true)}
                  className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-900 rounded-xl font-semibold flex items-center space-x-2 transition-all shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setEditMode(false);
                      loadProfile();
                    }}
                    className="px-5 py-2.5 bg-white/90 hover:bg-white text-gray-700 rounded-xl font-semibold transition-all shadow-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-all shadow-lg"
                  >
                    {saving ? '💾 Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {/* Profile Picture */}
            <div className="absolute -bottom-20 left-8">
              <div className="relative group">
                <img
                  src={profile.photoURL || userAvatar}
                  alt={profile.name}
                  className="w-40 h-40 rounded-2xl border-4 border-white dark:border-gray-800 shadow-2xl object-cover"
                />
                {editMode && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {uploadingPhoto ? (
                      <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <div className="text-center text-white">
                        <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-xs font-medium">Change Photo</span>
                      </div>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="pt-24 px-8 pb-8">
            {/* Name and Email */}
            <div className="mb-8">
              {editMode ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                    className="text-3xl font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-lg border-2 border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600 w-full"
                    placeholder="Your Name"
                  />
                </div>
              ) : (
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
                  {profile.name || 'No name set'}
                </h2>
              )}
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mt-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-base">{profile.email}</span>
              </div>
            </div>

            {/* Bio */}
            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span>About Me</span>
              </h3>
              {editMode ? (
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {profile.bio || '📝 No bio added yet. Click "Edit Profile" to add one!'}
                </p>
              )}
            </div>

            {/* Experience & Time Budget */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-primary-50 dark:from-blue-900/20 dark:to-primary-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <span>Experience Level</span>
                </h3>
                {editMode ? (
                  <select
                    value={profile.experience}
                    onChange={(e) => setProfile(prev => ({ ...prev, experience: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-blue-300 dark:border-blue-700 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base font-medium"
                  >
                    <option value="beginner">🌱 Beginner</option>
                    <option value="intermediate">🚀 Intermediate</option>
                    <option value="advanced">⭐ Advanced</option>
                  </select>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl">
                      {profile.experience === 'beginner' ? '🌱' : profile.experience === 'intermediate' ? '🚀' : '⭐'}
                    </span>
                    <span className="text-xl font-bold text-blue-700 dark:text-blue-300 capitalize">
                      {profile.experience}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border-2 border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Time Availability</span>
                </h3>
                {editMode ? (
                  <select
                    value={profile.timeBudget}
                    onChange={(e) => setProfile(prev => ({ ...prev, timeBudget: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-green-300 dark:border-green-700 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base font-medium"
                  >
                    <option value="flexible">⏰ Flexible</option>
                    <option value="1-2 hours/day">📅 1-2 hours/day</option>
                    <option value="3-5 hours/day">📆 3-5 hours/day</option>
                    <option value="5+ hours/day">⏳ 5+ hours/day</option>
                  </select>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl">⏰</span>
                    <span className="text-xl font-bold text-green-700 dark:text-green-300">
                      {profile.timeBudget}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>Skills</span>
              </h3>
              <div className="flex flex-wrap gap-3 mb-4">
                {profile.skills.length === 0 ? (
                  <div className="w-full text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">💡 No skills added yet</p>
                  </div>
                ) : (
                  profile.skills.map(skill => (
                    <span
                      key={skill}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-semibold flex items-center space-x-2 shadow-md hover:shadow-lg transition-shadow"
                    >
                      <span>{skill}</span>
                      {editMode && (
                        <button
                          onClick={() => removeSkill(skill)}
                          className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
              {editMode && (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add a skill (e.g., JavaScript, Python)..."
                  />
                  <button
                    onClick={addSkill}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-md"
                  >
                    ➕ Add
                  </button>
                </div>
              )}
            </div>

            {/* Preferred Technologies */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Preferred Technologies</span>
              </h3>
              <div className="flex flex-wrap gap-3 mb-4">
                {profile.preferredTech.length === 0 ? (
                  <div className="w-full text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">💻 No technologies added yet</p>
                  </div>
                ) : (
                  profile.preferredTech.map(tech => (
                    <span
                      key={tech}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-sm font-semibold flex items-center space-x-2 shadow-md hover:shadow-lg transition-shadow"
                    >
                      <span>{tech}</span>
                      {editMode && (
                        <button
                          onClick={() => removeTech(tech)}
                          className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
              {editMode && (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTech}
                    onChange={(e) => setNewTech(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Add a technology (e.g., React, Node.js)..."
                  />
                  <button
                    onClick={addTech}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors shadow-md"
                  >
                    ➕ Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
