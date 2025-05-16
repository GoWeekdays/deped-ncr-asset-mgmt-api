import { logger } from "@ph-deped-ncr/utils";
import { TAssetCode } from "./../models/asset-code.model";
import useAssetCodeRepository from "./../repositories/asset-code.repository";

export default function useAssetCodeService() {
  const {
    createAssetCode: _createAssetCode,
    getAssetCodesByType: _getAssetCodesByType,
    updateAssetCodeById: _updateAssetCodeById,
    deleteAssetCode: _deleteAssetCode,
  } = useAssetCodeRepository();

  async function createAssetCode(value: TAssetCode) {
    try {
      return await _createAssetCode(value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetCodesByType({ page = 1, limit = 10, sort = {}, search = "", type = "" } = {}) {
    try {
      return await _getAssetCodesByType({ page, limit, sort, search, type });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateAssetCodeById({ _id, value } = {} as { _id: string; value: TAssetCode }) {
    try {
      return await _updateAssetCodeById({ _id, value });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function deleteAssetCode(id: string) {
    try {
      return await _deleteAssetCode(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createAssetCode,
    getAssetCodesByType,
    updateAssetCodeById,
    deleteAssetCode,
  };
}
