import { logger } from "@ph-deped-ncr/utils";
import { TConfig } from "./../models/configuration.model";
import useConfigRepository from "./../repositories/configuration.repository";

export default function useConfigService() {
  const { createConfig: _createConfig, getConfigs: _getConfigs, updateConfig: _updateConfig, deleteConfig: _deleteConfig } = useConfigRepository();

  async function createConfig(value: TConfig) {
    try {
      return await _createConfig(value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getConfigs({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    try {
      return await _getConfigs({ page, limit, sort, search });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateConfig({ _id, value } = {} as { _id: string; value: TConfig }) {
    try {
      return await _updateConfig({ _id, value });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function deleteConfig(id: string) {
    try {
      return await _deleteConfig(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createConfig,
    getConfigs,
    updateConfig,
    deleteConfig,
  };
}
