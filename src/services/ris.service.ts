import { ClientSession, ObjectId } from "mongodb";
import { BadRequestError, logger, NotFoundError, useAtlas } from "@ph-deped-ncr/utils";
import { TItemStocks, TRISlip } from "./../models/ris.model";
import useAssetRepository from "./../repositories/asset.repository";
import useCounterRepository from "./../repositories/counter.repository";
import useRISlipRepository from "./../repositories/ris.repository";
import { useUserRepo } from "./../repositories/user.repository";
import useStockService from "./stock.service";
import useConfigRepository from "./../repositories/configuration.repository";
import useRISlipSerialNoRepo from "./../repositories/ris-serial-no.repository";
import { concatenateName1 } from "../local-utils";

export default function useRISlipService() {
  const {
    createRISlip: _createRISlip,
    getRISlips: _getRISlips,
    getReportRISlips: _getReportRISlips,
    getRISlipById: _getRISlipById,
    getReportRISlipById: _getReportRISlipById,
    updateRISlipById: _updateRISlipById,
    updateRISlipStatusById: _updateRISlipStatusById,
  } = useRISlipRepository();
  const { getAssetById } = useAssetRepository();
  const { incrementCounterByType } = useCounterRepository();
  const { getUserById } = useUserRepo();
  const { issueStockByBatch, getStocksByAssetId } = useStockService();
  const { getConfigByName } = useConfigRepository();
  const { createRISlipSerialNo } = useRISlipSerialNoRepo();

  const atlas = useAtlas.getInstance();

  let entityName: string | null = null;
  let fundClusterConsumable: string | null = null;
  let rcc: string | null = null;

  async function initializeConfigs() {
    try {
      entityName = await getConfigByName("Entity Name");
      fundClusterConsumable = await getConfigByName("Fund Cluster - Consumable");
      rcc = await getConfigByName("Responsibility Center Code");

      if (!entityName || !fundClusterConsumable || !rcc) {
        throw new BadRequestError("Required configuration not found.");
      }
    } catch (error) {
      logger.log({ level: "error", message: `Error initializing configurations: ${error}` });
      throw error;
    }
  }

  async function createRISlip(
    { purpose = "", itemStocks = [], requestedBy = "" } = {} as {
      purpose: string;
      itemStocks: Array<TItemStocks>;
      requestedBy: string;
    },
  ) {
    const session = atlas.getClient().startSession();
    session.startTransaction();

    await initializeConfigs();

    let count = 0;

    try {
      if (!entityName || !fundClusterConsumable || !rcc) {
        throw new BadRequestError("Configurations are not initialized.");
      }

      await Promise.all(
        itemStocks.map(async (item) => {
          const asset = await getAssetById(item.assetId);
          if (!asset) {
            throw new NotFoundError(`Asset with ID "${item.assetId}" not found.`);
          }
        }),
      );

      const counter = await incrementCounterByType("requisition-and-issue-slips", session);
      if (!counter) {
        throw new NotFoundError("Counter not found.");
      }
      count = counter.value as number;

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const _count = count.toString().padStart(2, "0");

      const risNo = `${year}-${month}-${day}-${_count}`;

      const requestee = await getUserById(requestedBy);
      if (!requestee) throw new NotFoundError("Personnel not found.");

      await _createRISlip(
        {
          entityName,
          fundCluster: fundClusterConsumable,
          divisionId: requestee?.divisionId as string,
          officeId: requestee?.officeId as string,
          rcc,
          purpose,
          risNo,
          itemStocks,
          requestedBy,
          requestedByName: concatenateName1(requestee),
        },
        session,
      );

      session.commitTransaction();

      return "Successfully created RIS.";
    } catch (error) {
      logger.log({ level: "error", message: `${(error as Error).message}` });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async function getRISlips({ page = 1, limit = 10, sort = {}, search = "", role = "", user = "" } = {}) {
    try {
      return await _getRISlips({ page, limit, sort, search, role, user });
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching RIS slips: ${(error as Error).message}` });
      throw error;
    }
  }

  async function getReportRISlips({ sort = {}, search = "" } = {}) {
    try {
      return await _getReportRISlips({ sort, search });
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching RIS slips: ${(error as Error).message}` });
      throw error;
    }
  }

  async function getRISlipById({ _id, role }: { _id: string; role?: string }) {
    try {
      const ris = await _getRISlipById({ _id, role });
      if (!ris) {
        throw new NotFoundError("RIS not found.");
      }

      return ris;
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching RIS by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function getReportRISlipById({ _id }: { _id: string }) {
    try {
      const ris = await _getReportRISlipById({ _id });
      if (!ris) {
        throw new NotFoundError(`RIS with ID ${_id} not found.`);
      }

      return ris;
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching RIS by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function updateRISlipById(_id: string, value: TRISlip, session?: ClientSession) {
    const requisitionSlip = await getRISlipById({ _id });
    if (!requisitionSlip) {
      throw new BadRequestError(`RIS with ID ${_id} not found.`);
    }

    try {
      if (value.itemStocks) {
        for (const item of value.itemStocks) {
          const asset = await getAssetById(item.assetId);

          if (!asset) {
            throw new BadRequestError(`Asset with ID ${item.assetId} not found.`);
          }

          value.itemStocks = value.itemStocks.map((item) => {
            const existingItem = requisitionSlip.itemStocks.find((ris) => ris.assetId.toString() === item.assetId.toString());

            if (!existingItem) {
              throw new BadRequestError(`Asset with ID ${item.assetId} not found in the current RIS.`);
            }

            if (item.assetId) {
              try {
                item.assetId = new ObjectId(item.assetId);
              } catch (error) {
                throw new BadRequestError("Invalid asset ID format.");
              }
            }

            // Retain requestQty from the database
            return {
              ...item,
              requestQty: existingItem.requestQty,
            };
          });
        }
      }

      if (value.approvedBy) {
        const approvedBy = await getUserById(value.approvedBy);

        if (!approvedBy) {
          throw new NotFoundError("Personnel not found.");
        }

        try {
          value.approvedBy = new ObjectId(value.approvedBy);
        } catch (error) {
          throw new BadRequestError("Invalid approvedBy ID format.");
        }
      }

      if (value.issuedBy) {
        const issuedBy = await getUserById(value.issuedBy);
        if (!issuedBy) {
          throw new NotFoundError("Personnel not found.");
        }
      }

      if (value.receivedBy) {
        const receivedBy = await getUserById(value.receivedBy);
        if (!receivedBy) {
          throw new NotFoundError("Personnel not found.");
        }
      }

      return await _updateRISlipById(_id, value, session);
    } catch (error) {
      logger.log({ level: "error", message: `Error updating RIS by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function evaluateRISlipById(_id: string, value: TRISlip) {
    try {
      if (value.itemStocks) {
        for (const item of value.itemStocks) {
          const asset = await getAssetById(item.assetId);

          if (asset?.quantity === undefined || asset?.quantity === null) {
            throw new NotFoundError(`The asset with ID "${item.assetId}" does not have a defined stock quantity`);
          }

          if (item.issueQty === undefined || item.issueQty === null) {
            throw new NotFoundError(`The issue quantity for the asset with ID "${item.assetId}" is not specified`);
          }

          // Check if requested quantity is available
          if (item.issueQty > asset.quantity) {
            throw new BadRequestError(
              `The requested quantity (${item.issueQty}) for the asset with ID "${item.assetId}" exceeds the available stock (${asset.quantity}). Please adjust the quantity and try again.`,
            );
          }
        }
      }

      // Proceed to update the RISlip after validation
      return await updateRISlipById(_id, value);
    } catch (error) {
      logger.log({ level: "error", message: `Error evaluating RIS by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  type TBatchItem = {
    id: string | ObjectId;
    reference?: string;
    qty: number;
    condition?: string;
  };

  async function issueRISlipById(_id: string, value: TRISlip) {
    const session = atlas.getClient().startSession();

    try {
      session.startTransaction();

      // Fetch the RISlip using the provided _id (session passed here)
      const ris = await _getRISlipById({ _id }, session);

      // Validate itemStocks
      if (!ris.itemStocks || !Array.isArray(ris.itemStocks)) {
        throw new BadRequestError("itemStocks is required and must be an array.");
      }

      // Prepare the batch items
      const batchItems: TBatchItem[] = await Promise.all(
        ris.itemStocks
          .filter((item) => item.issueQty !== 0)
          .map(async (item) => {
            const asset = await getAssetById(item.assetId);
            if (!asset) {
              throw new NotFoundError(`Asset with ID "${item.assetId}" not found.`);
            }

            const stock = await getStocksByAssetId({ asset: item.assetId.toString() });
            if (!stock || !stock.items || stock.items.length === 0) {
              throw new NotFoundError(`No stock items available for asset ID: ${item.assetId}`);
            }

            if (item.issueQty === undefined || item.issueQty === null) {
              throw new BadRequestError("Missing issue quantity.");
            }

            return {
              id: item.assetId,
              reference: ris.risNo,
              qty: item.issueQty,
              condition: "issued",
            };
          }),
      );

      // Update RISlip by ID, ensure passing session (session passed here)
      await updateRISlipById(_id, value, session);

      // Issue the stock by batch using the session (session passed here)
      await issueStockByBatch(
        {
          officeId: ris.officeId?.toString(),
          items: batchItems,
        },
        session,
      );

      // Commit the transaction after everything is successful
      await session.commitTransaction();
      return "Successfully issued consumable asset.";
    } catch (error) {
      // Handle any errors and abort the transaction
      logger.log({ level: "error", message: `Error issuing RIS by ID: ${(error as Error).message}` });
      await session.abortTransaction();
      throw error;
    } finally {
      // End the session after the transaction is completed
      session.endSession();
    }
  }

  async function updateRISlipStatusById(_id: string, status: string) {
    try {
      return await _updateRISlipStatusById(_id, status);
    } catch (error) {
      logger.log({ level: "error", message: `Error updating RIS status by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function incrementSerialNoCounter(_id: string) {
    const session = atlas.getClient().startSession();
    session.startTransaction();

    let count = 0;

    try {
      const counter = await incrementCounterByType("ris-serial-no", session);
      if (!counter) {
        throw new NotFoundError("Counter not found.");
      }
      count = counter.value as number;

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const _count = count.toString().padStart(2, "0");

      const serialNo = `${year}-${month}-${day}-${_count}`;

      const risSerialNo = createRISlipSerialNo({ risId: _id, serialNo }, session);

      session.commitTransaction();
      return risSerialNo;
    } catch (error) {
      logger.log({ level: "error", message: `Error incrementing RIS Report Serial No.: ${(error as Error).message}` });
      throw error;
    }
  }

  return {
    createRISlip,
    getRISlips,
    getReportRISlips,
    getRISlipById,
    getReportRISlipById,
    updateRISlipById,
    evaluateRISlipById,
    issueRISlipById,
    updateRISlipStatusById,
    incrementSerialNoCounter,
  };
}
