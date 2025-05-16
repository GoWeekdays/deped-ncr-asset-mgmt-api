import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useSchoolDivisionService from "./../services/school-division.service";

export default function useSchoolDivisionController() {
  const {
    createSchoolDivision: _createSchoolDivision,
    getSchoolDivisions: _getSchoolDivisions,
    getSchoolDivisionById: _getSchoolDivisionById,
    updateSchoolDivision: _updateSchoolDivision,
    deleteSchoolDivision: _deleteSchoolDivision,
  } = useSchoolDivisionService();

  async function createSchoolDivision(req: Request, res: Response, next: NextFunction) {
    const name = (req.body.name as string) || "";

    const schema = Joi.object({
      name: Joi.string().required(),
    });

    const { error } = schema.validate({ name });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createSchoolDivision({ name });
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getSchoolDivisions(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate({ page, limit, sort, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const schoolDivisions = await _getSchoolDivisions({ page, limit, sort, search });
      return res.json(schoolDivisions);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getSchoolDivisionById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const data = await _getSchoolDivisionById(id);
      return res.json(data);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateSchoolDivision(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const payload = req.body;

    const schema = Joi.object({
      name: Joi.string().optional().allow("", null),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateSchoolDivision(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function deleteSchoolDivision(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _deleteSchoolDivision(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createSchoolDivision,
    getSchoolDivisions,
    getSchoolDivisionById,
    updateSchoolDivision,
    deleteSchoolDivision,
  };
}
