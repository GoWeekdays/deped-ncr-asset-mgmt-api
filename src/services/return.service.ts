import { ClientSession, ObjectId } from "mongodb";
import { BadRequestError, logger, NotFoundError, useAtlas } from "@ph-deped-ncr/utils";
import { TItemStocks, TReturn } from "./../models/return.model";
import useAssetRepository from "./../repositories/asset.repository";
import useCounterRepository from "./../repositories/counter.repository";
import useReturnRepository from "./../repositories/return.repository";
import useStockRepository from "./../repositories/stock.repository";
import { useUserRepo } from "./../repositories/user.repository";
import useStockService from "./stock.service";
import useConfigRepository from "./../repositories/configuration.repository";
import { concatenateName, concatenateName1 } from "./../local-utils";
import useOfficeRepository from "./../repositories/office.repository";

export default function useReturnService() {
  const {
    createReturn: _createReturn,
    getReturns: _getReturns,
    getReturnById: _getReturnById,
    updateReturnById: _updateReturnById,
  } = useReturnRepository();
  const { getAssetById } = useAssetRepository();
  const { incrementCounterByType } = useCounterRepository();
  const { getUserById } = useUserRepo();
  const { getStockById } = useStockRepository();
  const { issueStockByBatch } = useStockService();
  const { getConfigByName } = useConfigRepository();
  const { getOfficeById } = useOfficeRepository();

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

  async function createReturn(
    { type = "", itemStocks = [], returnedBy = "" } = {} as {
      type: string;
      itemStocks: Array<TItemStocks>;
      returnedBy: string;
    },
  ) {
    await initializeConfigs();

    let count = 0;

    try {
      const returnee = await getUserById(returnedBy);
      if (!returnee) throw new NotFoundError("Personnel not found.");

      const office = await getOfficeById(returnee.officeId?.toString() || "");
      if (!office) throw new NotFoundError("Office not found.");

      if (!entityName || !fundClusterSEP || !fundClusterPPE) {
        throw new BadRequestError("Configurations are not initialized.");
      }

      let counter;
      let fundCluster: string = fundClusterSEP;

      counter = await incrementCounterByType("return-SEP");

      if (type === "PPE") {
        fundCluster = fundClusterPPE;
        counter = await incrementCounterByType("return-PPE");
      }

      if (!counter) {
        throw new NotFoundError("Counter not found.");
      }

      count = counter.value as number;

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const _count = count.toString().padStart(2, "0");

      const returnNo = `${year}-${month}-${day}-${_count}`;

      for (let index = 0; index < itemStocks.length; index++) {
        const item = itemStocks[index];

        const stock = await getStockById(item.stockId);
        if (!stock) {
          throw new NotFoundError(`Stock ID ${item.stockId} not found.`);
        }
      }

      return await _createReturn({
        type,
        entityName,
        fundCluster,
        returnNo,
        itemStocks,
        returnedBy,
        returnedByName: concatenateName1(returnee),
        officeName: office?.name,
      });
    } catch (error) {
      logger.log({ level: "error", message: `Create return error: ${error}` });
      throw error;
    }
  }

  async function getReturns({ page = 1, limit = 10, sort = {}, search = "", type = "", userId = "", role = "" } = {}) {
    try {
      return await _getReturns({ page, limit, sort, search, type, userId, role });
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching ${type}: ${(error as Error).message}` });
      throw error;
    }
  }

  async function getReturnById({ _id }: { _id: string }) {
    try {
      const returnSlip = await _getReturnById({ _id });
      if (!returnSlip) {
        throw new NotFoundError("Return record not found.");
      }

      return returnSlip;
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching return by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function updateReturnById(_id: string, value: TReturn, session?: ClientSession) {
    const returnSlip = await _getReturnById({ _id });
    if (!returnSlip) {
      throw new NotFoundError("Return record not found.");
    }

    try {
      if (value.itemStocks) {
        for (const item of value.itemStocks) {
          const stock = await getStockById(item.stockId);
          if (!stock) {
            throw new NotFoundError(`Stock ID ${item.stockId} not found.`);
          }

          const asset = await getAssetById(stock.assetId);
          if (!asset) {
            throw new NotFoundError(`Asset with ID ${stock.assetId} not found.`);
          }

          value.itemStocks = value.itemStocks.map((item) => {
            const existingItem = returnSlip.itemStocks.find((returnSlip: any) => returnSlip.stockId.toString() === item.stockId.toString());
            if (!existingItem) {
              throw new NotFoundError(`Stock with ID ${item.stockId} not found in the current return.`);
            }

            if (item.stockId) {
              try {
                item.stockId = new ObjectId(item.stockId);
              } catch (error) {
                throw new BadRequestError("Invalid stock ID format.");
              }
            }

            return {
              ...item,
            };
          });
        }
      }

      if (value.approvedBy) {
        const approvedBy = await getUserById(value.approvedBy);
        if (!approvedBy) {
          throw new NotFoundError("Personnel not found.");
        }

        value.approvedAt = new Date().toISOString();
      }

      if (value.receivedBy) {
        const receivedBy = await getUserById(value.receivedBy);
        if (!receivedBy) {
          throw new NotFoundError("Personnel not found.");
        }

        value.completedAt = new Date().toISOString();
      }

      return await _updateReturnById(_id, value, session);
    } catch (error) {
      logger.log({ level: "error", message: `Error updating return by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function updateStatusToApproved(_id: string, value: TReturn) {
    try {
      await updateReturnById(_id, value);
      return "Successfully approved return stock.";
    } catch (error) {
      logger.log({ level: "error", message: `Error approving return stock by ID: ${(error as Error).message}` });
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
  };

  async function updateStatusToCompleted(_id: string, value: TReturn) {
    const session = atlas.getClient().startSession();

    try {
      session.startTransaction();

      const returnSlip = await _getReturnById({ _id }, session);

      // Prepare the batch items
      const batchItems: TBatchItem[] = await Promise.all(
        returnSlip.itemStocks.map(async (item: any) => {
          const stock = await getStockById(item.stockId.toString());
          if (!stock) {
            throw new NotFoundError("Stock not found.");
          }

          const asset = await getAssetById(stock.assetId.toString());
          if (!asset || !asset._id) {
            throw new NotFoundError("Asset not found.");
          }

          let stockRemarks = item.stockRemarks;

          if (item.stockRemarks === "for-reissue") {
            stockRemarks = "returned";
          }

          return {
            id: asset._id.toString(),
            reference: stock?.reference?.toString(),
            serialNo: stock?.serialNo?.toString(),
            qty: 1,
            itemNo: stock.itemNo?.toString(),
            initialCondition: stock.condition?.toString(),
            condition: stockRemarks,
          };
        }),
      );

      const receivedBy = await getUserById(value.receivedBy?.toString() || "");
      if (!receivedBy || !receivedBy.officeId) {
        throw new BadRequestError("Received by or office ID is invalid.");
      }

      await updateReturnById(_id, value, session);
      await issueStockByBatch(
        {
          officeId: receivedBy.officeId.toString(),
          items: batchItems,
        },
        session,
      );

      await session.commitTransaction();
      return "Successfully completed returned stock.";
    } catch (error) {
      logger.log({ level: "error", message: `Error completing return stock by ID: ${(error as Error).message}` });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  return {
    createReturn,
    getReturns,
    getReturnById,
    updateReturnById,
    updateStatusToApproved,
    updateStatusToCompleted,
  };
}
