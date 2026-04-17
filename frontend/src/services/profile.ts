import api from './api';

export interface UserProfile {
  user_id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  telegram_linked: boolean;
  telegram_username: string | null;
  created_at: string;
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  email?: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface TelegramLinkResponse {
  message: string;
  command: string;
  instructions: string[];
}

export interface ActiveProjectSummary {
  project_id: string;
  name_english: string;
  name_marathi: string | null;
  status: string;
}

export interface ActiveProjectResponse {
  active_project: ActiveProjectSummary | null;
  message?: string;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const response = await api.get('/profile');
    return response.data;
  },

  async updateProfile(data: UpdateProfileData): Promise<{ message: string; user: UserProfile }> {
    const response = await api.put('/profile', data);
    return response.data;
  },

  async changePassword(data: ChangePasswordData): Promise<{ message: string }> {
    const response = await api.put('/profile/password', data);
    return response.data;
  },

  async getTelegramLinkInstructions(): Promise<TelegramLinkResponse> {
    const response = await api.post('/profile/telegram/link');
    return response.data;
  },

  async unlinkTelegram(): Promise<{ message: string }> {
    const response = await api.delete('/profile/telegram');
    return response.data;
  },

  async getActiveProject(): Promise<ActiveProjectResponse> {
    const response = await api.get('/profile/active-project');
    return response.data;
  },

  async setActiveProject(projectId: string | null): Promise<ActiveProjectResponse> {
    const response = await api.put('/profile/active-project', { project_id: projectId });
    return response.data;
  },
};
