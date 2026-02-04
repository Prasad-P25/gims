import { Response } from 'express';
import { teamService } from '../services/team.service';
import { sendSuccess, sendCreated, sendNoContent, sendNotFound, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';

export class TeamController {
  /**
   * Get all teams (super_admin only)
   */
  async getAllTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user?.role !== 'super_admin') {
      sendError(res, 'Access denied', 403);
      return;
    }

    const teams = await teamService.getAllTeams();
    sendSuccess(res, teams);
  }

  /**
   * Get team by ID
   */
  async getTeamById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const user = req.user!;

    // Check access
    if (user.role !== 'super_admin') {
      const userTeam = await teamService.getTeamByAdminId(user.user_id);
      if (!userTeam || userTeam.team_id !== id) {
        sendError(res, 'Access denied', 403);
        return;
      }
    }

    const team = await teamService.getTeamById(id);
    if (!team) {
      sendNotFound(res, 'Team not found');
      return;
    }

    sendSuccess(res, team);
  }

  /**
   * Create new team (super_admin only)
   */
  async createTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user?.role !== 'super_admin') {
      sendError(res, 'Access denied', 403);
      return;
    }

    const team = await teamService.createTeam(req.body);
    sendCreated(res, team, 'Team created successfully');
  }

  /**
   * Update team (super_admin only)
   */
  async updateTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user?.role !== 'super_admin') {
      sendError(res, 'Access denied', 403);
      return;
    }

    const { id } = req.params;
    const team = await teamService.updateTeam(id, req.body);

    if (!team) {
      sendNotFound(res, 'Team not found');
      return;
    }

    sendSuccess(res, team, 'Team updated successfully');
  }

  /**
   * Delete team (super_admin only)
   */
  async deleteTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user?.role !== 'super_admin') {
      sendError(res, 'Access denied', 403);
      return;
    }

    const { id } = req.params;
    const deleted = await teamService.deleteTeam(id);

    if (!deleted) {
      sendNotFound(res, 'Team not found');
      return;
    }

    sendNoContent(res);
  }

  /**
   * Get team members
   * - super_admin: any team
   * - admin: only their team
   */
  async getTeamMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const user = req.user!;

    // Check access
    if (user.role !== 'super_admin') {
      const isAdmin = await teamService.isTeamAdmin(user.user_id, id);
      if (!isAdmin) {
        sendError(res, 'Access denied', 403);
        return;
      }
    }

    const members = await teamService.getTeamMembers(id);
    sendSuccess(res, members);
  }

  /**
   * Add user to team
   * - super_admin: any team
   * - admin: only their team
   */
  async addUserToTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id: teamId } = req.params;
    const { user_id: targetUserId, role = 'member' } = req.body;
    const user = req.user!;

    // Check access
    if (user.role !== 'super_admin') {
      const isAdmin = await teamService.isTeamAdmin(user.user_id, teamId);
      if (!isAdmin) {
        sendError(res, 'Access denied', 403);
        return;
      }
      // Admin can only add members, not other admins
      if (role === 'admin') {
        sendError(res, 'Cannot assign admin role', 403);
        return;
      }
    }

    const added = await teamService.addUserToTeam(teamId, targetUserId, role);
    if (!added) {
      sendNotFound(res, 'User not found');
      return;
    }

    sendSuccess(res, null, 'User added to team');
  }

  /**
   * Remove user from team
   * - super_admin: any user
   * - admin: only their team members
   */
  async removeUserFromTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id: teamId, userId: targetUserId } = req.params;
    const user = req.user!;

    // Check access
    if (user.role !== 'super_admin') {
      const isAdmin = await teamService.isTeamAdmin(user.user_id, teamId);
      if (!isAdmin) {
        sendError(res, 'Access denied', 403);
        return;
      }
    }

    const removed = await teamService.removeUserFromTeam(targetUserId);
    if (!removed) {
      sendNotFound(res, 'User not found');
      return;
    }

    sendSuccess(res, null, 'User removed from team');
  }

  /**
   * Get unassigned users (super_admin only)
   */
  async getUnassignedUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.user?.role !== 'super_admin') {
      sendError(res, 'Access denied', 403);
      return;
    }

    const users = await teamService.getUnassignedUsers();
    sendSuccess(res, users);
  }

  /**
   * Get current user's team (for admin/member)
   */
  async getMyTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;

    if (user.role === 'super_admin') {
      sendError(res, 'Super admin does not belong to a team', 400);
      return;
    }

    // Get user's team from their team_id
    const result = await teamService.getTeamByAdminId(user.user_id);

    // If user is admin, get their team
    if (user.role === 'admin' && result) {
      sendSuccess(res, result);
      return;
    }

    // For members, we need to fetch team by user's team_id
    // This requires checking the user record
    sendError(res, 'Team not found', 404);
  }
}

export const teamController = new TeamController();
