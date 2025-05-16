import { logger } from "@ph-deped-ncr/utils";
import useDashboardRepo from "./../repositories/dashboard.repository";

export default function useDashboardService() {
  const {
    getAssetsOverview: _getAssetsOverview,
    getAssetTypesOverview: _getAssetTypesOverview,
    getPropertyConditions: _getPropertyConditions,
    getRecentActivities: _getRecentActivities,
  } = useDashboardRepo();

  async function getAssetsOverview() {
    try {
      return await _getAssetsOverview();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetTypesOverview() {
    try {
      return await _getAssetTypesOverview();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getPropertyConditions() {
    try {
      return await _getPropertyConditions();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getRecentActivities() {
    try {
      return await _getRecentActivities();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return { getAssetsOverview, getAssetTypesOverview, getPropertyConditions, getRecentActivities };
}
