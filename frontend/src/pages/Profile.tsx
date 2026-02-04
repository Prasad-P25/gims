import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Phone,
  Mail,
  Lock,
  Save,
  MessageCircle,
  Link,
  Unlink,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { profileService } from '../services/profile';
import type { UpdateProfileData, ChangePasswordData } from '../services/profile';
import { cn } from '../lib/utils';

export default function Profile() {
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [telegramCommand, setTelegramCommand] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [profileData, setProfileData] = useState<UpdateProfileData>({});
  const [passwordData, setPasswordData] = useState<ChangePasswordData & { confirm_password: string }>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Fetch profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: profileService.getProfile,
    onSuccess: (data) => {
      setProfileData({
        name: data.name,
        phone: data.phone,
        email: data.email || '',
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => profileService.updateProfile(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setMessage({ type: 'success', text: response.message });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordData) => profileService.changePassword(data),
    onSuccess: (response) => {
      setMessage({ type: 'success', text: response.message });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to change password' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  // Get Telegram link instructions
  const telegramLinkMutation = useMutation({
    mutationFn: () => profileService.getTelegramLinkInstructions(),
    onSuccess: (response) => {
      setTelegramCommand(response.command);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to get link instructions' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  // Unlink Telegram
  const unlinkTelegramMutation = useMutation({
    mutationFn: () => profileService.unlinkTelegram(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setMessage({ type: 'success', text: response.message });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to unlink Telegram' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }
    if (passwordData.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }
    changePasswordMutation.mutate({
      current_password: passwordData.current_password,
      new_password: passwordData.new_password,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Command copied to clipboard!' });
    setTimeout(() => setMessage(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Message Toast */}
      {message && (
        <div
          className={cn(
            'p-4 rounded-lg flex items-center gap-3',
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          )}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary-600" />
            Profile Information
          </h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={profileData.name || ''}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="input pl-10"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  value={profileData.phone || ''}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="input pl-10"
                  placeholder="Your phone number"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={profileData.email || ''}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="input pl-10"
                  placeholder="Your email (optional)"
                />
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs text-gray-500">
                Role: <span className="font-medium capitalize">{profile?.role}</span>
              </span>
            </div>

            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {updateProfileMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary-600" />
            Change Password
          </h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  className="input pl-10 pr-10"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className="input pl-10 pr-10"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className="input pl-10 pr-10"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">Password must be at least 6 characters long</p>

            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {changePasswordMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Change Password
            </button>
          </form>
        </div>

        {/* Telegram Integration */}
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary-600" />
            Telegram Integration
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center',
                    profile?.telegram_linked ? 'bg-green-100' : 'bg-gray-200'
                  )}
                >
                  <MessageCircle
                    className={cn('h-5 w-5', profile?.telegram_linked ? 'text-green-600' : 'text-gray-400')}
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {profile?.telegram_linked ? 'Telegram Connected' : 'Telegram Not Connected'}
                  </p>
                  {profile?.telegram_linked && profile?.telegram_username && (
                    <p className="text-sm text-gray-500">@{profile.telegram_username}</p>
                  )}
                </div>
              </div>

              {profile?.telegram_linked ? (
                <button
                  onClick={() => unlinkTelegramMutation.mutate()}
                  disabled={unlinkTelegramMutation.isPending}
                  className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {unlinkTelegramMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  ) : (
                    <Unlink className="h-4 w-4" />
                  )}
                  Unlink
                </button>
              ) : (
                <button
                  onClick={() => telegramLinkMutation.mutate()}
                  disabled={telegramLinkMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {telegramLinkMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                  Link Telegram
                </button>
              )}
            </div>

            {telegramCommand && !profile?.telegram_linked && (
              <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                <p className="text-sm text-blue-800 font-medium">To link your Telegram account:</p>
                <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
                  <li>Open Telegram and find the GIMS bot</li>
                  <li>Send this command to the bot:</li>
                </ol>
                <div className="flex items-center gap-2 bg-white p-3 rounded border border-blue-200">
                  <code className="flex-1 text-sm font-mono text-blue-900">{telegramCommand}</code>
                  <button
                    onClick={() => copyToClipboard(telegramCommand)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    title="Copy command"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-blue-600">Your account will be linked automatically after sending the command.</p>
              </div>
            )}

            {profile?.telegram_linked && (
              <p className="text-sm text-gray-600">
                You will receive task notifications and reminders via Telegram.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
