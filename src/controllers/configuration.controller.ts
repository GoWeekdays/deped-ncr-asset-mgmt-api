import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useConfigService from "./../services/configuration.service";

export default function useConfigController() {
  const { createConfig: _createConfig, getConfigs: _getConfigs, updateConfig: _updateConfig, deleteConfig: _deleteConfig } = useConfigService();

  async function createConfig(req: Request, res: Response, next: NextFunction) {
    const name = (req.body.name as string) || "";
    const value = (req.body.value as string) || "";

    const schema = Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required(),
    });

    const payload = { name, value };

    const { error } = schema.validate(payload);
    if (error) {
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createConfig(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getConfigs(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional().allow("", null),
      limit: Joi.number().optional().allow("", null),
      sort: Joi.object().optional().allow("", null),
      search: Joi.string().allow("").optional().allow("", null),
    });

    const { error } = schema.validate({ page, limit, sort, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const configs = await _getConfigs({ page, limit, sort, search });
      return res.json(configs);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateConfig(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const name = (req.body.name as string) || "";
    const value = (req.body.name as string) || "";

    const schema = Joi.object({
      id: Joi.string().hex().required(),
      name: Joi.string().optional().allow("", null),
      value: Joi.string().optional().allow("", null),
    });

    const { error } = schema.validate({ id, name, value });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateConfig({ _id: id, value: { name, value } });
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function deleteConfig(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _deleteConfig(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createConfig,
    getConfigs,
    updateConfig,
    deleteConfig,
  };
}
