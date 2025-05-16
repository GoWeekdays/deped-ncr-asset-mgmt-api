import { BadRequestError, logger, NotFoundError, useAtlas } from "@ph-deped-ncr/utils";
import { TWaste } from "./../models/waste.model";
import useWasteRepository from "./../repositories/waste.repository";
import useAssetRepository from "./../repositories/asset.repository";
import useStockRepository from "./../repositories/stock.repository";
import useConfigRepository from "./../repositories/configuration.repository";

export default function useWasteService() {
  const { createWaste: _createWaste, getWastes: _getWastes, getWasteById: _getWasteById, updateWasteById: _updateWasteById } = useWasteRepository();
  const { getAssetById } = useAssetRepository();
  const { getStockById } = useStockRepository();
  const { getConfigByName } = useConfigRepository();

  const atlas = useAtlas.getInstance();

  let entityName: string | null = null;
  let fundClusterSEP: string | null = null;
  let fundClusterPPE: string | null = null;

  async function initializeConfigs() {
    try {
      entityName = await getConfigByName("Entity Name");
      fundClusterSEP = await getConfigByName("Fund Cluster - SEP");
      fundClusterPPE = await getConfigByName("Fund Cluster - PPE");

      if (!entityName || !fundClusterSEP || !fundClusterPPE) {
        throw new BadRequestError("Required configuration not found.");
      }
    } catch (error) {
      logger.log({ level: "error", message: `Error initializing configurations: ${error}` });
      throw error;
    }
  }

  async function createWaste(value: TWaste) {
    await initializeConfigs();

    try {
      if (!entityName || !fundClusterSEP || !fundClusterPPE) {
        throw new BadRequestError("Configurations are not initialized.");
      }

      let fundCluster: string = fundClusterSEP;

      for (const item of value.itemStocks) {
        const stock = await getStockById(item.stockId);
        if (!stock) {
          throw new NotFoundError(`Stock ID ${item.stockId} not found.`);
        }

        const asset = await getAssetById(stock.assetId);
        if (!asset) {
          throw new NotFoundError(`Asset not found for ID: ${item.stockId}`);
        }

        if (asset.type === "PPE") {
          fundCluster = fundClusterPPE;
        }

        value.entityName = entityName;
        value.fundCluster = fundCluster;
      }

      return await _createWaste(value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getWastes({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    try {
      return await _getWastes({ page, limit, sort, search });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getWasteById(id: string) {
    try {
      const waste = await _getWasteById(id);
      if (!waste) throw new NotFoundError("Waste not found.");

      return waste;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateWasteById(_id: string, value: TWaste) {
    const waste = await _getWasteById(_id);
    if (!waste) throw new NotFoundError("Waste not found.");

    try {
      if (value.disposalApprovedBy) {
        value.status = "completed";
      }

      return await _updateWasteById(_id, value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createWaste,
    getWastes,
    getWasteById,
    updateWasteById,
  };
}
