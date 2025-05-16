import { Request, Response, NextFunction } from "express";
import { logger } from "@ph-deped-ncr/utils";
import useDashboardService from "./../services/dashboard.service";

export default function useDashboardController() {
  const {
    getAssetsOverview: _getAssetsOverview,
    getAssetTypesOverview: _getAssetTypesOverview,
    getPropertyConditions: _getPropertyConditions,
    getRecentActivities: _getRecentActivities,
  } = useDashboardService();

  async function getAssetsOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const assets = await _getAssetsOverview();
      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetTypesOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const assets = await _getAssetTypesOverview();
      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getPropertyConditions(req: Request, res: Response, next: NextFunction) {
    try {
      const assets = await _getPropertyConditions();
      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getRecentActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const assets = await _getRecentActivities();
      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return { getAssetsOverview, getAssetTypesOverview, getPropertyConditions, getRecentActivities };
}
