import { Response } from 'express';
import { projectService } from '../services/project.service';
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendNotFound,
  sendError,
  sendForbidden,
} from '../utils/response';
import { AuthenticatedRequest, UserRole } from '../types';

interface AccessCtx {
  user_id: string;
  role: UserRole;
  team_id?: string;
}

const ctxFromReq = (req: AuthenticatedRequest): AccessCtx => ({
  user_id: req.user!.user_id,
  role: req.user!.role,
  team_id: req.user!.team_id,
});

const canManage = (role: UserRole) => role === 'super_admin' || role === 'admin';

export class ProjectController {
  /** GET /api/projects */
  async listProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const projects = await projectService.listProjects(ctxFromReq(req), status);
    sendSuccess(res, projects);
  }

  /** GET /api/projects/mine — projects the current user's team is in */
  async getMyProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    if (user.role === 'super_admin') {
      // super_admin sees all projects
      const all = await projectService.listProjects(ctxFromReq(req));
      sendSuccess(res, all);
      return;
    }
    const projects = await projectService.getMyProjects(user.team_id);
    sendSuccess(res, projects);
  }

  /** GET /api/projects/:id */
  async getProjectById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const project = await projectService.getProjectById(id, ctxFromReq(req));
    if (!project) {
      sendNotFound(res, 'Project not found');
      return;
    }
    sendSuccess(res, project);
  }

  /** POST /api/projects (super_admin + admin) */
  async createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    if (!canManage(user.role)) {
      sendForbidden(res, 'Only admins and super admins can create projects');
      return;
    }

    // Admins can only create projects that include their own team
    if (user.role === 'admin') {
      const teamIds = req.body.team_ids as string[] | undefined;
      if (!user.team_id) {
        sendError(res, 'Admin must belong to a team to create projects', 400);
        return;
      }
      if (!teamIds || !teamIds.includes(user.team_id)) {
        sendError(res, 'Admins must include their own team in the project', 400);
        return;
      }
    }

    const project = await projectService.createProject(req.body, user.user_id);
    sendCreated(res, project, 'Project created successfully');
  }

  /** PUT /api/projects/:id (super_admin + admin-of-a-team-in-this-project) */
  async updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    const { id } = req.params;

    if (!canManage(user.role)) {
      sendForbidden(res);
      return;
    }

    // Admin: must have access to this project (team membership scope enforces this)
    if (user.role === 'admin') {
      const existing = await projectService.getProjectById(id, ctxFromReq(req));
      if (!existing) {
        sendNotFound(res, 'Project not found');
        return;
      }
    }

    const project = await projectService.updateProject(id, req.body);
    if (!project) {
      sendNotFound(res, 'Project not found');
      return;
    }
    sendSuccess(res, project, 'Project updated successfully');
  }

  /** DELETE /api/projects/:id (super_admin only to keep it safe) */
  async deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    if (user.role !== 'super_admin') {
      sendForbidden(res, 'Only super admin can delete projects');
      return;
    }
    const { id } = req.params;
    const deleted = await projectService.deleteProject(id);
    if (!deleted) {
      sendNotFound(res, 'Project not found');
      return;
    }
    sendNoContent(res);
  }

  /** GET /api/projects/:id/teams */
  async getProjectTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const accessible = await projectService.getProjectById(id, ctxFromReq(req));
    if (!accessible) {
      sendNotFound(res, 'Project not found');
      return;
    }
    const teams = await projectService.getProjectTeams(id);
    sendSuccess(res, teams);
  }

  /** POST /api/projects/:id/teams */
  async assignTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    if (!canManage(user.role)) {
      sendForbidden(res);
      return;
    }
    const { id } = req.params;
    const { team_ids } = req.body as { team_ids: string[] };

    // Check project visibility for admin
    if (user.role === 'admin') {
      const existing = await projectService.getProjectById(id, ctxFromReq(req));
      if (!existing) {
        sendNotFound(res, 'Project not found');
        return;
      }
    }

    await projectService.assignTeams(id, team_ids, user.user_id);
    const teams = await projectService.getProjectTeams(id);
    sendSuccess(res, teams, 'Teams assigned');
  }

  /** DELETE /api/projects/:id/teams/:teamId */
  async removeTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    if (!canManage(user.role)) {
      sendForbidden(res);
      return;
    }
    const { id, teamId } = req.params;

    if (user.role === 'admin') {
      const existing = await projectService.getProjectById(id, ctxFromReq(req));
      if (!existing) {
        sendNotFound(res, 'Project not found');
        return;
      }
      // prevent admin from removing their OWN team (would lock them out)
      if (teamId === user.team_id) {
        sendError(res, 'Admins cannot remove their own team from a project', 400);
        return;
      }
    }

    const ok = await projectService.removeTeam(id, teamId);
    if (!ok) {
      sendNotFound(res, 'Team not assigned to this project');
      return;
    }
    sendNoContent(res);
  }

  /** GET /api/projects/:id/dashboard */
  async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const stats = await projectService.getDashboard(id, ctxFromReq(req));
    if (!stats) {
      sendNotFound(res, 'Project not found');
      return;
    }
    sendSuccess(res, stats);
  }
}

export const projectController = new ProjectController();
