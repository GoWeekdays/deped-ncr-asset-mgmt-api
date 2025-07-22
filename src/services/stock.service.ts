import { ClientSession, ObjectId } from "mongodb";
import { BadRequestError, logger, NotFoundError, useAtlas } from "@ph-deped-ncr/utils";
import { TAsset } from "./../models/asset.model";
import { TStock } from "./../models/stock.model";
import useAssetRepository from "./../repositories/asset.repository";
import useOfficeRepository from "./../repositories/office.repository";
import useStockRepository from "./../repositories/stock.repository";

export default function useStockService() {
  const atlas = useAtlas.getInstance();
  const {
    createStock: _createStock,
    getStocks: _getStocks,
    getStockById: _getStockById,
    getStocksByAssetId: _getStocksByAssetId,
    getStocksByCondition: _getStocksByCondition,
    getReissuedStocksForLoss: _getReissuedStocksForLoss,
    getReissuedStocksForReturn: _getReissuedStocksForReturn,
    getStocksByWasteCondition: _getStocksByWasteCondition,
    getReissuedStocksForMaintenance: _getReissuedStocksForMaintenance,
    getPropertyByOfficeId: _getPropertyByOfficeId,
    getPersonnelStockCardById: _getPersonnelStockCardById,
  } = useStockRepository();
  const { getAssetById, updateAssetQtyById } = useAssetRepository();
  const { getOfficeById } = useOfficeRepository();

  type TBatchItem = {
    id: string | ObjectId;
    reference?: string;
    serialNo?: string;
    qty: number;
    balance?: number;
    numberOfDaysToConsume?: number;
    itemNo?: string;
    initialCondition?: string;
    condition?: string;
  };

  async function createStock(
    {
      createdAt = "",
      assetId = "",
      reference = "",
      serialNo = "",
      attachment = "",
      officeId = "",
      officeName = "",
      ins = 0,
      outs = 0,
      balance = 0,
      numberOfDaysToConsume = 0,
      itemNo = "",
      remarks = "",
      initialCondition = "",
      condition = "good-condition",
    } = {} as TStock,
    session?: ClientSession,
  ) {
    let ownsSession = false;

    if (!session) {
      session = atlas.getClient().startSession();
      ownsSession = true;
      session.startTransaction();
    }

    try {
      if (!assetId) throw new BadRequestError("Asset ID is required.");

      const asset = await getAssetById(assetId);
      if (!asset) throw new NotFoundError(`Asset not found with ID: ${assetId}`);

      let newBalance = asset.quantity ?? 0;

      switch (condition) {
        case "good-condition":
        case "returned":
          newBalance = newBalance + ins;
          break;
        case "reissued":
          newBalance = newBalance - outs;
          break;
      }

      if (condition === "transferred") {
        // For transferred stocks, use the balance calculated in the transfer logic
        // This applies to both good-condition and reissued stocks
        if (initialCondition === "good-condition" && newBalance < outs) {
          throw new BadRequestError(`Insufficient stock for ${asset.name}. Available: ${asset.quantity ?? 0}, Requested: ${outs}`);
        }

        newBalance = balance;
      }

      logger.log({
        level: "info",
        message: `Final Asset Update - assetId: ${assetId}, itemNo: ${itemNo}, ins: ${ins}, outs: ${outs}, new balance: ${newBalance}`,
      });

      if (officeId) {
        const office = await getOfficeById(officeId);
        if (!office) throw new NotFoundError(`Office not found with ID: ${officeId}`);
      }

      await _createStock(
        {
          createdAt,
          assetId,
          assetName: asset.name,
          reference,
          serialNo,
          attachment,
          officeId,
          officeName,
          ins,
          outs,
          balance: newBalance,
          numberOfDaysToConsume,
          itemNo,
          remarks,
          condition,
        },
        session,
      );

      await updateAssetQtyById({ _id: assetId, qty: newBalance }, session);

      if (ownsSession) {
        await session.commitTransaction();
      }

      return "Successfully created a new stock.";
    } catch (error) {
      if (ownsSession) {
        await session.abortTransaction();
      }
      logger.log({ level: "error", message: `Error in createStock: ${error}` });
      throw error;
    } finally {
      if (ownsSession) {
        session.endSession();
      }
    }
  }

  async function createStockByBatch(
    { createdAt = "", reference = "", attachment = "", officeId = "", items = [] } = {} as {
      createdAt?: string;
      reference: string;
      attachment: string;
      officeId?: string;
      items: Array<TBatchItem>;
    },
    session?: ClientSession,
  ) {
    session = atlas.getClient().startSession();

    try {
      session.startTransaction();

      const assetMap = new Map<string, TAsset>();
      const stockOperations = [];

      for (const item of items) {
        const assetId = item.id.toString();

        // Fetch asset data if not already stored in map
        if (!assetMap.has(assetId)) {
          const asset = await getAssetById(assetId);
          if (!asset) {
            throw new NotFoundError(`Asset not found for ID: ${assetId}`);
          }
          assetMap.set(assetId, asset);
        }

        // Prepare bulk stock creation operation
        stockOperations.push(
          createStock(
            {
              createdAt,
              assetId,
              reference,
              attachment,
              officeId,
              numberOfDaysToConsume: item.numberOfDaysToConsume,
              ins: item.qty,
            },
            session,
          ),
        );
      }

      await Promise.all(stockOperations);

      await session.commitTransaction();
      return "Successfully stocks ins transactions.";
    } catch (error) {
      await session.abortTransaction();
      logger.log({ level: "error", message: `Error in createStockByBatch: ${error}` });
      throw error;
    } finally {
      session.endSession();
    }
  }

  async function issueStockByBatch(
    {
      createdAt = "",
      officeId = "",
      officeName = "",
      items = [],
    }: { createdAt?: string; officeId?: string; officeName?: string; items: Array<TBatchItem> },
    session?: ClientSession,
  ): Promise<string> {
    session = atlas.getClient().startSession();

    try {
      session.startTransaction();

      const assetMap = new Map<string, TAsset>();

      // Process items sequentially to maintain order and proper balance calculations
      for (const item of items) {
        const assetId = item.id.toString();

        // Fetch asset data if not already stored in map
        if (!assetMap.has(assetId)) {
          const asset = await getAssetById(assetId, session);
          if (!asset) {
            throw new NotFoundError(`Asset not found for ID: ${assetId}`);
          }
          assetMap.set(assetId, asset);
        }

        let ins = 0;
        let outs = item.qty;

        if (item.condition === "returned") {
          ins = item.qty;
          outs = 0;
        }

        // Process each stock creation sequentially to maintain order
        await createStock(
          {
            createdAt,
            assetId,
            reference: item.reference,
            serialNo: item.serialNo,
            officeId,
            officeName,
            ins,
            outs,
            balance: item.balance,
            itemNo: item.itemNo,
            initialCondition: item.initialCondition,
            condition: item.condition,
          },
          session,
        );
      }

      await session.commitTransaction();
      return "Successfully processed stock outs transactions.";
    } catch (error) {
      await session.abortTransaction();
      logger.log({ level: "error", message: `Error in issueStockByBatch: ${error}` });
      throw error;
    } finally {
      session.endSession();
    }
  }

  async function getStockById(id: string) {
    try {
      const stock = await _getStockById(id);
      if (!stock) {
        throw new NotFoundError(`Stock with ID ${id} not found.`);
      }

      return stock;
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching stock by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function getStocksByAssetId({ page = 1, limit = 10, sort = {}, search = "", asset = "" } = {}) {
    try {
      const assetData = await getAssetById(asset);
      if (!assetData) {
        throw new NotFoundError("Asset ID not found.");
      }

      return await _getStocksByAssetId({ page, limit, sort, search, asset });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getStocksByCondition({ page = 1, limit = 10, sort = {}, search = "", asset = "", condition = "" } = {}) {
    try {
      return await _getStocksByCondition({ page, limit, sort, search, asset, condition });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getReissuedStocksForLoss({ page = 1, limit = 10, sort = {}, search = "", issueSlipId = "" } = {}) {
    try {
      return await _getReissuedStocksForLoss({ page, limit, sort, search, issueSlipId });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getReissuedStocksForReturn({ page = 1, limit = 10, sort = {}, search = "", assetId = "" } = {}) {
    try {
      return await _getReissuedStocksForReturn({ page, limit, sort, search, assetId });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }
  async function getStocksByWasteCondition({ page = 1, limit = 10, sort = {}, search = "", assetId = "", condition = "" } = {}) {
    try {
      return await _getStocksByWasteCondition({ page, limit, sort, search, assetId, condition });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getReissuedStocksForMaintenance({ page = 1, limit = 10, sort = {}, search = "", assetId = "", role = "", userId = "" } = {}) {
    try {
      return await _getReissuedStocksForMaintenance({ page, limit, sort, search, assetId, role, userId });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getPropertyByOfficeId({
    officeId,
    page = 1,
    limit = 10,
    search = "",
  }: {
    officeId: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    try {
      return await _getPropertyByOfficeId({ officeId, page, limit, search });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getPersonnelStockCardById({
    userId,
    page = 1,
    limit = 10,
    search = "",
  }: {
    userId: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    try {
      return await _getPersonnelStockCardById({ userId, page, limit, search });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createStock,
    createStockByBatch,
    issueStockByBatch,
    getStockById,
    getStocksByAssetId,
    getStocksByCondition,
    getReissuedStocksForLoss,
    getReissuedStocksForReturn,
    getStocksByWasteCondition,
    getReissuedStocksForMaintenance,
    getPropertyByOfficeId,
    getPersonnelStockCardById,
  };
}
