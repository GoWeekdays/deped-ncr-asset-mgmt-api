import { logger, NotFoundError, useAtlas, BadRequestError } from "@ph-deped-ncr/utils";
import { TAsset, TUpdatePropertyOptions } from "./../models/asset.model";
import useAssetRepository from "./../repositories/asset.repository";
import useCounterRepository from "./../repositories/counter.repository";
import useOfficeService from "./office.service";
import { useUserRepo } from "./../repositories/user.repository";
import useConfigRepository from "./../repositories/configuration.repository";
import useStockRepository from "./../repositories/stock.repository";

export default function useAssetService() {
  const {
    createAsset: _createAsset,
    getAssets: _getAssets,
    getAssetsForTransfer: _getAssetsForTransfer,
    getAssetsForReturn: _getAssetsForReturn,
    getAssetsForWaste: _getAssetsForWaste,
    getAssetById: _getAssetById,
    getAssetsForMaintenance: _getAssetsForMaintenance,
    getAssetsForDisposalReport: _getAssetsForDisposalReport,
    updateAssetById: _updateAssetById,
    updateAssetQtyById,
    deleteAssetById: _deleteAssetById,
    updatePropertyById: _updatePropertyById,
    updatePropertyConditionById: _updatePropertyConditionById,
    getAssetConsumables: _getAssetConsumables,
    getAssetSEPPPE: _getAssetSEPPPE,
  } = useAssetRepository();
  const { incrementCounterByType } = useCounterRepository();
  const { createStock } = useStockRepository();
  const { getOfficeById } = useOfficeService();
  const { getUserById } = useUserRepo();
  const { getConfigByName } = useConfigRepository();
  const { updateStockAssetNameByAssetId: _updateStockAssetNameByAssetId } = useStockRepository();

  const atlas = useAtlas.getInstance();

  let entityName: string | null = null;
  let fundClusterConsumable: string | null = null;
  let fundClusterSEP: string | null = null;
  let fundClusterPPE: string | null = null;

  async function initializeConfigs() {
    try {
      entityName = await getConfigByName("Entity Name");
      fundClusterConsumable = await getConfigByName("Fund Cluster - Consumable");
      fundClusterSEP = await getConfigByName("Fund Cluster - SEP");
      fundClusterPPE = await getConfigByName("Fund Cluster - PPE");

      if (!entityName || !fundClusterConsumable || !fundClusterSEP || !fundClusterPPE) {
        throw new BadRequestError("Required configuration not found.");
      }
    } catch (error) {
      logger.log({ level: "error", message: `Error initializing configurations: ${error}` });
      throw error;
    }
  }

  async function createConsumable(value: TAsset) {
    const session = atlas.getClient().startSession();
    session.startTransaction();

    await initializeConfigs();

    let count = 0;

    try {
      if (!entityName || !fundClusterConsumable) {
        throw new BadRequestError("Configurations are not initialized.");
      }

      const counter = await incrementCounterByType("consumable", session);
      if (!counter) {
        throw new NotFoundError("Counter not found.");
      }
      count = counter.value as number;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      await session.abortTransaction();
      throw error;
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const _count = count.toString().padStart(2, "0");

    value.stockNumber = `${year}-${month}-${day}-${_count}`;
    value.entityName = entityName;
    value.fundCluster = fundClusterConsumable;

    try {
      await _createAsset(value, session);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      await session.abortTransaction();
      throw error;
    }

    try {
      await session.commitTransaction();
      return "Successfully created consumable asset.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async function createProperty({
    createdAt = "",
    type = "",
    name = "",
    description = "",
    unitOfMeasurement = "",
    year = "",
    propertyCode = "",
    serialCode = "",
    locationCode = "",
    reference = "",
    attachment = "",
    quantity = 0,
    cost = 0,
    modeOfAcquisition = "",
    procurementType = "",
    supplier = "",
    officeId = "",
    article = "",
  } = {}) {
    const session = atlas.getClient().startSession();
    session.startTransaction();

    await initializeConfigs();

    let count = 0;

    try {
      if (!entityName || !fundClusterSEP || !fundClusterPPE) {
        throw new BadRequestError("Configurations are not initialized.");
      }

      if (officeId) {
        const office = await getOfficeById(officeId.toString());
        if (!office) {
          throw new NotFoundError("Office not found.");
        }
      }

      const counterName = type === "SEP" ? "semi-expendable-property" : type === "PPE" ? "property-plant-equipment" : "";
      const counter = await incrementCounterByType(counterName, session);
      if (!counter) {
        throw new NotFoundError("Counter not found.");
      }
      count = counter.value as number;
    } catch (error) {
      logger.log({
        level: "error",
        message: `Error initializing property: ${error}`,
      });
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

    let assetId: string;
    let initialQty = quantity;
    let condition = "good-condition";
    let fundCluster = type === "PPE" ? fundClusterPPE : fundClusterSEP;

    try {
      assetId = await _createAsset(
        {
          createdAt,
          type,
          entityName,
          fundCluster,
          name,
          description,
          unitOfMeasurement,
          cost,
          initialQty,
          quantity,
          propNumAttrib: {
            year,
            propertyCode,
            serialNumber: serialCode,
            location: locationCode,
            quantity: quantity.toString(),
            counter: count.toString(),
          },
          modeOfAcquisition,
          procurementType,
          supplier,
          condition,
          article: article.toString(),
        },
        session,
      );

      if (!assetId) {
        throw new Error("Failed to create asset, assetId is undefined.");
      }

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      logger.log({ level: "error", message: `Error creating asset: ${error}` });
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

    try {
      let itemNo = initialQty === 1 ? "1" : `1-${initialQty}`;
      await createStock({
        createdAt,
        assetId,
        assetName: name,
        reference,
        attachment,
        officeId,
        ins: initialQty,
        balance: initialQty,
        itemNo,
        condition,
      });

      await updateAssetQtyById({ _id: assetId, qty: initialQty });
    } catch (error) {
      logger.log({ level: "error", message: `Error creating stock: ${error}` });
      throw error;
    }

    return `Successfully created ${type} asset.`;
  }

  async function getAssets({ page = 1, limit = 10, sort = {}, search = "", type = "", role = "" } = {}) {
    try {
      return await _getAssets({ page, limit, sort, search, type, role });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForTransfer({ page = 1, limit = 10, sort = {}, search = "", type = "", role = "" } = {}) {
    try {
      return await _getAssetsForTransfer({ page, limit, sort, search, type, role });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForReturn({ page = 1, limit = 10, sort = {}, search = "", type = "", role = "", userId = "" } = {}) {
    try {
      return await _getAssetsForReturn({ page, limit, sort, search, type, role, userId });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForWaste({ sort = {}, search = "", role = "" } = {}) {
    try {
      return await _getAssetsForWaste({ sort, search, role });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForMaintenance({ sort = {}, search = "", role = "", userId = "" } = {}) {
    try {
      const user = await getUserById(userId);
      if (!user) {
        throw new NotFoundError("User not found.");
      }

      const officeId = user.officeId?.toString() ?? "";

      const office = await getOfficeById(officeId);
      if (!office) {
        throw new NotFoundError("Office not found.");
      }

      return await _getAssetsForMaintenance({ sort, search, role, userId });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForDisposalReport({ sort = {}, type = "" } = {}) {
    try {
      return await _getAssetsForDisposalReport({ sort, type });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetById(_id: string) {
    try {
      const asset = await _getAssetById(_id);
      if (!asset) {
        throw new NotFoundError("Asset not found.");
      }

      return asset;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateAssetById(_id: string, value: TAsset) {
    try {
      const asset = await getAssetById(_id);
      if (!asset) {
        throw new NotFoundError("Asset not found.");
      }

      return await _updateAssetById(_id, value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updatePropertyById(_id: string, value: TUpdatePropertyOptions) {
    try {
      const asset = await getAssetById(_id);
      if (!asset) {
        throw new NotFoundError("Asset not found.");
      }

      return await _updatePropertyById(_id, value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updatePropertyConditionById(_id: string, condition: string) {
    try {
      const asset = await _getAssetById(_id);
      if (!asset) {
        throw new NotFoundError("Asset not found.");
      }

      await _updatePropertyConditionById(_id, condition);
      return "Successfully updated asset condition.";
    } catch (error) {
      logger.log({ level: "error", message: `Error updating asset condition by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function deleteAssetById(_id: string) {
    try {
      const asset = await _getAssetById(_id);
      if (!asset) throw new NotFoundError("Asset not found.");

      if ((asset.type === "SEP" || asset.type === "PPE") && asset.initialQty !== asset.quantity)
        throw new BadRequestError("Cannot delete asset because it has associated stock.");

      if (!asset.type) throw new NotFoundError("Asset type not found.");

      return await _deleteAssetById(_id, asset.type);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetConsumables() {
    try {
      return await _getAssetConsumables();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetSEPPPE(type: string, search: string, condition: string) {
    try {
      const items = await _getAssetSEPPPE(type, search, condition);
      return items;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createConsumable,
    createProperty,
    getAssets,
    getAssetsForTransfer,
    getAssetsForReturn,
    getAssetsForWaste,
    getAssetById,
    getAssetsForMaintenance,
    getAssetsForDisposalReport,
    getAssetConsumables,
    getAssetSEPPPE,
    updateAssetById,
    updatePropertyById,
    updatePropertyConditionById,
    deleteAssetById,
  };
}
