import { ObjectId } from "mongodb";
import { logger, NotFoundError, useAtlas, BadRequestError, getDirectory, compileHandlebar, useMailer } from "@ph-deped-ncr/utils";
import { TLoss } from "./../models/loss.model";
import useLossRepository from "./../repositories/loss.repository";
import useCounterRepository from "./../repositories/counter.repository";
import useStockService from "./stock.service";
import useAssetRepository from "./../repositories/asset.repository";
import { FRONTEND_URL, MAILER_EMAIL, MAILER_PASSWORD, MAILER_TRANSPORT_HOST, MAILER_TRANSPORT_PORT, MAILER_TRANSPORT_SECURE } from "./../config";
import useConfigRepository from "./../repositories/configuration.repository";
import useOfficeRepository from "./../repositories/office.repository";

export default function useLossService() {
  const {
    createLoss: _createLoss,
    getLosses: _getLosses,
    getLossById: _getLossById,
    getLossByIdForStock: _getLossByIdForStock,
    updateLossById: _updateLossById,
  } = useLossRepository();
  const { incrementCounterByType } = useCounterRepository();
  const { getStockById, issueStockByBatch } = useStockService();
  const { getAssetById } = useAssetRepository();
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

  const MailerConfig = {
    host: MAILER_TRANSPORT_HOST,
    port: MAILER_TRANSPORT_PORT,
    secure: MAILER_TRANSPORT_SECURE,
    email: MAILER_EMAIL,
    password: MAILER_PASSWORD,
  };

  const mailer = new useMailer(MailerConfig);

  async function createLoss(value: TLoss) {
    await initializeConfigs();

    let count = 0;

    try {
      if (!entityName || !fundClusterSEP || !fundClusterPPE) {
        throw new BadRequestError("Configurations are not initialized.");
      }

      let fundCluster: string = fundClusterSEP;

      if (value.type === "RLSDDP") {
        fundCluster = fundClusterPPE;
      }

      value.entityName = entityName;
      value.fundCluster = fundCluster;

      const counter = await incrementCounterByType(value.type);
      if (!counter) {
        throw new NotFoundError("Counter not found.");
      }
      count = counter.value as number;

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const _count = count.toString().padStart(2, "0");

      value.lossNo = `${year}-${month}-${day}-${_count}`;

      await Promise.all(
        value.itemStocks.map(async (item) => {
          const stock = await getStockById(item.stockId.toString());
          if (!stock) throw new NotFoundError("Stock not found.");

          const asset = await getAssetById(stock.assetId.toString());
          if (!asset) throw new NotFoundError("Asset not found.");
          if (!stock.officeId) throw new NotFoundError("Office not found.");

          const office = await getOfficeById(stock.officeId.toString());
          if (!office) throw new NotFoundError("Office not found.");

          value.description = asset.description;
          value.officeName = office.name;
        }),
      );

      const loss = await _createLoss(value);

      const dir = __dirname;
      const filePath = getDirectory(dir, "./../public/handlebars/approve-lost-form");
      const emailContent = compileHandlebar({
        context: {
          lossStatus: loss.lossStatus,
          itemName: loss.itemName,
          officer: loss.officerName,
          office: loss.officeName,
          supervisor: loss.supervisorName,
          type: loss.type,
          link: `${FRONTEND_URL}/waste-and-losses/${loss.type.toLowerCase()}/approve/${loss._id.toString()}`,
        },
        filePath,
      });

      mailer.sendMail({ to: loss.supervisorEmail, subject: `Request for ${loss.type} Approval`, html: emailContent }).catch((error) => {
        logger.log({ level: "error", message: `Error sending request for approval: ${error}` });
      });

      return "Successfully created loss.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getLosses({ page = 1, limit = 10, sort = {}, search = "", type = "", userId = "", role = "", status = "" } = {}) {
    try {
      return await _getLosses({ page, limit, sort, search, type, userId, role, status });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getLossById(_id: string | ObjectId) {
    try {
      const loss = await _getLossById(_id);
      if (!loss) {
        throw new NotFoundError("Loss not found.");
      }

      return loss;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateStatusToApproved(_id: string) {
    try {
      const loss = await _getLossById(_id);
      if (!loss) {
        throw new NotFoundError("Loss not found.");
      }

      const supervisorDate = new Date().toISOString();

      await _updateLossById(_id, "approved", supervisorDate);

      return "Successfully updated loss status to approved.";
    } catch (error) {
      logger.log({ level: "error", message: `loss: ${error}` });
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

  async function updateStatusToCompleted(_id: string) {
    const session = atlas.getClient().startSession();

    try {
      session.startTransaction();

      const loss = await _getLossByIdForStock(_id);
      if (!loss) {
        throw new NotFoundError("Loss not found.");
      }

      const { assetId, officeId, lossStatus, itemStocks } = loss;

      // Prepare the batch items
      const batchItems: TBatchItem[] = await Promise.all(
        itemStocks.map(async (item: any) => {
          const stock = await getStockById(item.stockId.toString());
          if (!stock) {
            throw new NotFoundError("Stock not found.");
          }

          const asset = await getAssetById(stock.assetId.toString());
          if (!asset || !asset._id) {
            throw new NotFoundError("Asset not found.");
          }

          return {
            id: assetId.toString(),
            reference: stock.reference,
            serialNo: stock.serialNo,
            qty: 1,
            itemNo: stock.itemNo,
            initialCondition: stock.condition,
            condition: lossStatus,
          };
        }),
      );

      await issueStockByBatch({ officeId: officeId.toString(), items: batchItems }, session);
      await _updateLossById(_id, "completed", session.toString());

      await session.commitTransaction();
      return "Successfully updated loss status to completed.";
    } catch (error) {
      logger.log({ level: "error", message: `loss: ${error}` });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  return {
    createLoss,
    getLosses,
    getLossById,
    updateStatusToApproved,
    updateStatusToCompleted,
  };
}
