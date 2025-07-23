import { ClientSession, ObjectId } from "mongodb";
import { BadRequestError, logger, NotFoundError, useAtlas } from "@ph-deped-ncr/utils";
import { TItemStocks, TTransfer } from "./../models/transfer.model";
import useAssetRepository from "./../repositories/asset.repository";
import useCounterRepository from "./../repositories/counter.repository";
import useTransferRepository from "./../repositories/transfer.repository";
import useStockRepository from "./../repositories/stock.repository";
import { useUserRepo } from "./../repositories/user.repository";
import useStockService from "./stock.service";
import useSchoolDivisionRepository from "./../repositories/school-division.repository";
import useSchoolService from "./school.service";
import useConfigRepository from "./../repositories/configuration.repository";

export default function useTransferService() {
  const {
    createTransfer: _createTransfer,
    getTransfers: _getTransfers,
    getTransferById: _getTransferById,
    updateTransferById: _updateTransferById,
  } = useTransferRepository();
  const { getAssetById, updateAssetQtyById } = useAssetRepository();
  const { incrementCounterByType } = useCounterRepository();
  const { getUserById } = useUserRepo();
  const { getStockById } = useStockRepository();
  const { issueStockByBatch } = useStockService();
  const { getSchoolDivisionById } = useSchoolDivisionRepository();
  const { findOrCreateSchool } = useSchoolService();
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

  async function createTransfer(
    { type = "", from = "", divisionId = "", school = "", transferReason = "", transferType = "", itemStocks = [] } = {} as {
      type: string;
      from: string;
      divisionId: string;
      school?: string;
      transferReason: string;
      transferType: string;
      itemStocks: Array<TItemStocks>;
    },
  ) {
    const session = atlas.getClient().startSession();
    session.startTransaction();

    await initializeConfigs();

    let count = 0;

    try {
      if (!entityName || !fundClusterSEP || !fundClusterPPE) {
        throw new BadRequestError("Configurations are not initialized.");
      }

      let fundCluster: string = fundClusterSEP;

      if (type === "property-transfer-report") {
        fundCluster = fundClusterPPE;
      }

      const division = await getSchoolDivisionById(divisionId);
      if (!division) {
        throw new NotFoundError("Division not found.");
      }
      const divisionName = division?.name ? String(division.name) : "";

      let _school;
      if (school) {
        _school = await findOrCreateSchool(school, divisionId);
      }
      const schoolName = _school?.name ? String(_school.name) : null;

      const to = schoolName ? `${schoolName} - ${divisionName}` : divisionName;

      const counter = await incrementCounterByType(type, session);
      if (!counter) {
        throw new NotFoundError("Counter not found.");
      }
      count = counter.value as number;

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const _count = count.toString().padStart(2, "0");

      const transferNo = `${year}-${month}-${day}-${_count}`;

      for (const item of itemStocks) {
        const stock = await getStockById(item.stockId);
        if (!stock) {
          throw new NotFoundError(`Stock ID ${item.stockId} not found.`);
        }

        const asset = await getAssetById(stock.assetId, session);
        if (!asset) {
          throw new NotFoundError(`Asset not found for ID: ${item.stockId}`);
        }

        const currentBalance = asset.quantity || 0;
        const qty = 1;

        if (stock.condition === "good-condition") {
          if (currentBalance < qty) {
            throw new BadRequestError(`Insufficient stock for ${asset.name}. Available: ${currentBalance}, Requested: ${qty}`);
          }
        }
      }

      await _createTransfer(
        {
          type,
          entityName,
          fundCluster,
          from,
          to,
          divisionId,
          schoolId: _school?._id,
          transferNo,
          transferReason,
          transferType,
          itemStocks,
        },
        session,
      );

      session.commitTransaction();
      return "Successfully created transfer.";
    } catch (error) {
      logger.log({ level: "error", message: `Error creating ${type}: ${(error as Error).message}` });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async function getTransfers({ page = 1, limit = 10, sort = {}, search = "", type = "" } = {}) {
    try {
      return await _getTransfers({ page, limit, sort, search, type });
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching ${type}: ${(error as Error).message}` });
      throw error;
    }
  }

  async function getTransferById({ _id }: { _id: string }) {
    try {
      const transfer = await _getTransferById({ _id });
      if (!transfer) throw new NotFoundError("Transfer not found.");

      return transfer;
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching transfer by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function fetchStockDetails(itemStocks: TTransfer["itemStocks"]) {
    return Promise.all(
      itemStocks.map(async (item) => {
        const stock = await getStockById(item.stockId);
        if (!stock) throw new NotFoundError(`Stock ID ${item.stockId} not found.`);

        const asset = await getAssetById(stock.assetId);
        if (!asset) throw new NotFoundError(`Asset with ID ${stock.assetId} not found.`);

        return { ...item };
      }),
    );
  }

  async function updateTransferById(_id: string, value: TTransfer, session?: ClientSession) {
    const transferReport = await _getTransferById({ _id });
    if (!transferReport) throw new BadRequestError("Transfer not found.");

    try {
      if (value.itemStocks) {
        const stockDetails = await fetchStockDetails(value.itemStocks);
        if (!stockDetails.every((item) => transferReport.itemStocks.some((transfer) => transfer.stockId.toString() === item.stockId.toString()))) {
          throw new NotFoundError("One or more stocks not found in the current transfer.");
        }

        value.itemStocks = stockDetails;
      }

      const date = new Date().toISOString();

      if (value.approvedBy) {
        const approvedBy = await getUserById(value.approvedBy);
        if (!approvedBy) throw new NotFoundError("Approved by user not found.");

        value.approvedAt = date;
      }

      if (value.issuedBy && value.receivedByName && value.receivedByDesignation) {
        const issuedBy = await getUserById(value.issuedBy);
        if (!issuedBy) throw new NotFoundError("Issued by user not found.");

        value.completedAt = date;
      }

      return await _updateTransferById(_id, value, session);
    } catch (error) {
      logger.log({ level: "error", message: `Error updating transfer by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  type TBatchItem = {
    id: string | ObjectId;
    reference?: string;
    serialNo?: string;
    qty: number;
    itemNo?: string;
    initialCondition?: string;
    condition?: string;
    balance: number;
  };

  async function fetchBatchItems(transfer: TTransfer, session?: ClientSession): Promise<TBatchItem[]> {
    const items: Array<TBatchItem> = [];
    const assetBalanceMap = new Map<string, number>(); // Track running balance per asset

    for (let index = 0; index < transfer.itemStocks.length; index++) {
      const _stock = transfer.itemStocks[index];

      const stockId = _stock.stockId;

      const stock = await getStockById(stockId.toString());
      if (!stock) throw new NotFoundError(`Stock ID ${stockId} not found.`);

      const asset = await getAssetById(stock.assetId.toString());
      if (!asset) throw new NotFoundError(`Asset ID ${stock.assetId} not found.`);
      if (!asset._id) throw new BadRequestError("Asset ID is required.");

      const assetId = asset._id.toString();
      let currentBalance = asset.quantity || 0;

      // Use tracked balance if we've processed this asset before
      if (assetBalanceMap.has(assetId)) {
        currentBalance = assetBalanceMap.get(assetId)!;
      }

      const initialQty = asset.initialQty || asset.quantity || 0;
      const totalOuts = Math.max(0, initialQty - currentBalance);
      const transferItemNo = totalOuts + 1;
      let itemNo = stock.itemNo;
      let qty = 1;
      let balanceForItem = currentBalance;
      let newRunningBalance = currentBalance;

      if (stock.condition === "good-condition") {
        itemNo = transferItemNo.toString();
        // For good-condition stocks, deduct from current balance
        balanceForItem = currentBalance - qty;
        newRunningBalance = balanceForItem; // Update running balance for subsequent items
      } else {
        // For reissued stocks, use current balance but don't deduct
        // since it was already deducted when first issued
        balanceForItem = currentBalance;
        newRunningBalance = currentBalance; // Keep the same balance for subsequent items
      }

      // Update the running balance for this asset
      assetBalanceMap.set(assetId, newRunningBalance);

      const data: TBatchItem = {
        id: assetId,
        reference: stock.reference || "",
        serialNo: stock.serialNo || "",
        qty,
        balance: balanceForItem,
        itemNo,
        initialCondition: stock.condition || "",
        condition: "transferred",
      };

      items.push(data);
    }

    return items;
  }

  async function updateStatusToCompleted(_id: string, value: TTransfer) {
    const session = atlas.getClient().startSession();

    try {
      session.startTransaction();

      const transfer = await _getTransferById({ _id });
      if (!transfer) throw new NotFoundError("Transfer not found.");

      const batchItems = await fetchBatchItems(transfer, session);

      await updateTransferById(_id, value, session);
      await issueStockByBatch({ officeName: transfer.to, items: batchItems }, session);

      try {
        await session.commitTransaction();
        return "Successfully transferred stock.";
      } catch (commitError) {
        logger.log({ level: "error", message: `Transaction commit failed: ${(commitError as Error).message}` });
        throw commitError;
      }
    } catch (error) {
      logger.log({ level: "error", message: `Error transferring stock by ID: ${(error as Error).message}` });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  return {
    createTransfer,
    getTransfers,
    getTransferById,
    updateTransferById,
    updateStatusToCompleted,
  };
}
