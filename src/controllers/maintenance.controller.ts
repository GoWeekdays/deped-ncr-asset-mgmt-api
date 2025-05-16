import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useMaintenanceService from "./../services/maintenance.service";
import { TKeyValuePair } from "./../local";

export default function useMaintenanceController() {
  const {
    createMaintenance: _createMaintenance,
    getMaintenances: _getMaintenances,
    getMaintenanceById: _getMaintenanceById,
    updateMaintenanceById: _updateMaintenanceById,
  } = useMaintenanceService();

  async function createMaintenance(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;
    const schema = Joi.object({
      stockId: Joi.string().hex().required(),
      issue: Joi.string().required(),
      assigneeId: Joi.string().hex().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createMaintenance(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getMaintenances(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().min(10).max(50).optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate({ page, limit, sort, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    const _user = req.headers.user as TKeyValuePair;

    try {
      const maintenance = await _getMaintenances({ page, limit, sort, search, role: _user.role, userId: _user.user });
      return res.json(maintenance);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getMaintenanceById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const maintenances = await _getMaintenanceById(id);
      return res.json(maintenances);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateMaintenanceById(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const payload = req.body;
    const schema = Joi.object({
      id: Joi.string().hex().required(),
      type: Joi.string().optional().allow("", null),
      scheduledAt: Joi.string().optional().allow("", null),
      attachment: Joi.string().optional().allow("", null),
      remarks: Joi.string().optional().allow("", null),
    });

    const { error } = schema.validate(id, payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const maintenance = await _updateMaintenanceById(id, payload);
      return res.json(maintenance);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function cancelStatus(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "cancelled";
      await _updateMaintenanceById(id, payload);
      return res.json({ message: "Successfully cancelled maintenance." });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function scheduleStatus(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;

    const schema = Joi.object({
      type: Joi.string().required(),
      scheduledAt: Joi.string().required(),
      attachment: Joi.string().optional().allow("", null),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "scheduled";
      await _updateMaintenanceById(id, payload);
      return res.json({ message: "Successfully scheduled maintenance." });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function rescheduleStatus(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;

    const schema = Joi.object({
      scheduledAt: Joi.string().required(),
      rescheduleReason: Joi.string().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "rescheduled";
      await _updateMaintenanceById(id, payload);
      return res.json({ message: "Successfully rescheduled maintenance." });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function completeStatus(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;

    const schema = Joi.object({
      completedBy: Joi.string().hex().required(),
      remarks: Joi.string().optional().allow("", null),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "completed";
      await _updateMaintenanceById(id, payload);
      return res.json({ message: "Successfully completed maintenance." });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createMaintenance,
    getMaintenances,
    getMaintenanceById,
    updateMaintenanceById,
    cancelStatus,
    scheduleStatus,
    rescheduleStatus,
    completeStatus,
  };
}
