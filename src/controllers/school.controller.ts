import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useSchoolService from "./../services/school.service";

export default function useSchoolController() {
  const {
    createSchool: _createSchool,
    findOrCreateSchool: _findOrCreateSchool,
    getSchools: _getSchools,
    getSchoolById: _getSchoolById,
    updateSchool: _updateSchool,
    deleteSchool: _deleteSchool,
  } = useSchoolService();

  async function createSchool(req: Request, res: Response, next: NextFunction) {
    const name = (req.body.name as string) || "";
    const divisionId = (req.body.divisionId as string) ?? "";

    const schema = Joi.object({
      name: Joi.string().required(),
      divisionId: Joi.string().hex().optional().allow(null, ""),
    });

    const { error } = schema.validate({ name, divisionId });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createSchool({ name, divisionId });
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function findOrCreateSchool(req: Request, res: Response, next: NextFunction) {
    const schoolIdOrName = (req.body.schoolIdOrName as string) || "";
    const divisionId = (req.body.divisionId as string) || "";

    const schema = Joi.object({
      schoolIdOrName: Joi.string().required(),
      divisionId: Joi.string().optional().allow("", null),
    });

    const { error } = schema.validate({ schoolIdOrName });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const data = await _findOrCreateSchool(schoolIdOrName, divisionId);

      return res.json(data);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getSchools(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const divisionId = (req.query.divisionId as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      divisionId: Joi.string().hex().optional().allow(null, ""),
    });

    const { error } = schema.validate({ page, limit, sort, search, divisionId });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const schools = await _getSchools({ page, limit, sort, search, divisionId });
      return res.json(schools);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getSchoolById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const schools = await _getSchoolById(id);
      return res.json(schools);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateSchool(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const payload = req.body;
    const schema = Joi.object({
      name: Joi.string().optional().allow("", null),
      divisionId: Joi.string().hex().optional().allow(null, ""),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateSchool(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function deleteSchool(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _deleteSchool(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createSchool,
    findOrCreateSchool,
    getSchools,
    getSchoolById,
    updateSchool,
    deleteSchool,
  };
}
