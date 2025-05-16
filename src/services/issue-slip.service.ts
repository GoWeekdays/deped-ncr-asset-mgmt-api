import { ObjectId } from "mongodb";
import { BadRequestError, logger, NotFoundError, useAtlas } from "@ph-deped-ncr/utils";
import { TIssueSlip } from "./../models/issue-slip.model";
import { useUserRepo } from "./../repositories/user.repository";
import useAssetRepository from "./../repositories/asset.repository";
import useIssueSlipRepository from "./../repositories/issue-slip.repository";
import { TUser } from "./../models/user.model";
import useCounterRepository from "./../repositories/counter.repository";
import { TCounter } from "./../models/counter.model";
import useConfigRepository from "./../repositories/configuration.repository";
import useStockRepository from "./../repositories/stock.repository";

export default function useIssueSlipService() {
  const {
    createIssueSlip: _createIssueSlip,
    getIssueSlips: _getIssueSlips,
    getIssueSlipsByReceiver: _getIssueSlipsByReceiver,
    getIssueSlipById: _getIssueSlipById,
    issue,
  } = useIssueSlipRepository();
  const { getAssetById, updateAssetQtyById } = useAssetRepository();
  const { getUserById } = useUserRepo();
  const { createStock } = useStockRepository();
  const { incrementCounterByType } = useCounterRepository();
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

  async function createIssueSlip(
    {
      type = "",
      assetId = "",
      quantity = 0,
      estimatedUsefulLife = 0,
      serialNo = [],
      remarks = "",
      issuedBy = "",
      receivedBy = "",
      receivedAt = "",
    }: TIssueSlip = {} as TIssueSlip,
  ) {
    const session = atlas.getClient().startSession();
    session.startTransaction();

    await initializeConfigs();

    if (!entityName || !fundClusterSEP || !fundClusterPPE) throw new BadRequestError("Configurations are not initialized.");

    const asset = await getAssetById(assetId);
    if (!asset) throw new NotFoundError(`Asset with ID "${assetId}" not found.`);

    const currentBalance = asset.quantity || 0;
    if (currentBalance < quantity)
      throw new BadRequestError(`Insufficient stock for ${asset.name}. Available: ${currentBalance}, Requested: ${quantity}`);

    if (serialNo.length > 0 && serialNo.length > quantity)
      throw new BadRequestError(`Serial numbers provided (${serialNo.length}) exceed the quantity (${quantity}).`);

    const _receivedBy = await getUserById(receivedBy);
    if (!_receivedBy) throw new NotFoundError("Received by user not found.");

    let fundCluster: string = fundClusterSEP;
    let count = 0;
    let counter: TCounter;
    let issueSlipType = "";

    function getIssueSlipTypeByCost(cost: number, type: string): string {
      if (type === "SEP") {
        if (cost >= 5001 && cost <= 50000) {
          return "SPHV";
        }
        if (cost <= 5000) {
          return "SPLV";
        }
      } else if (type === "PPE") {
        if (cost >= 50001) {
          return "PAR";
        }
      }
      return "";
    }

    if (asset?.cost !== undefined) {
      if (asset?.type === "SEP") {
        counter = await incrementCounterByType("inventory-custodian-slips", session);
        count = counter.value as number;

        issueSlipType = getIssueSlipTypeByCost(asset.cost, "SEP");
      }

      if (asset?.type === "PPE") {
        counter = await incrementCounterByType("property-acknowledgement-receipts", session);
        count = counter.value as number;

        issueSlipType = getIssueSlipTypeByCost(asset.cost, "PPE");
      }
    } else {
      throw new BadRequestError("Asset cost is undefined.");
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const _count = count.toString().padStart(2, "0");

    let issueSlipNo = `${issueSlipType}-${year}-${month}-${_count}`;

    if (type === "PAR") {
      issueSlipNo = `${issueSlipType}-${year}-${month}-${day}-${_count}`;
      fundCluster = fundClusterPPE;
    }

    try {
      await _createIssueSlip({
        type,
        entityName,
        fundCluster,
        assetId,
        assetName: asset.name,
        quantity,
        estimatedUsefulLife,
        serialNo,
        remarks,
        issueSlipNo,
        issuedBy,
        receivedBy,
        receivedByName: `${_receivedBy?.title ? `${_receivedBy?.title} ` : ""}${_receivedBy?.firstName} ${_receivedBy?.lastName}${_receivedBy?.suffix ? ` ${_receivedBy?.suffix}` : ""}`,
        receivedAt,
      });

      session.commitTransaction();
      return "Successfully created a new asset issuance record.";
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async function getIssueSlips({ page = 1, limit = 10, sort = {}, search = "", type = "", userId = "", role = "" } = {}) {
    try {
      return await _getIssueSlips({ page, limit, sort, search, type, userId, role });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getIssueSlipsByReceiver({ page = 1, limit = 10, sort = {}, search = "", type = "", receivedBy = "" } = {}) {
    try {
      return await _getIssueSlipsByReceiver({ page, limit, sort, search, type, receivedBy });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getIssueSlipById(_id: string | ObjectId) {
    try {
      const issueSlip = await _getIssueSlipById(_id);
      if (!issueSlip) {
        throw new NotFoundError("Asset issuance record not found.");
      }

      return issueSlip;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateStatusToIssued(_id: string) {
    const session = atlas.getClient().startSession();
    session.startTransaction();

    try {
      const issueSlip = await _getIssueSlipById(_id);
      if (!issueSlip) throw new NotFoundError("Issue slip not found.");

      const { assetId, quantity, issueSlipNo, estimatedUsefulLife, serialNo, remarks, issuedBy, receivedBy } = issueSlip;

      const asset = await getAssetById(assetId);
      if (!asset) throw new NotFoundError(`Asset not found for ID: ${assetId}`);

      let currentBalance = asset.quantity || 0;
      const initialQty = asset.initialQty || currentBalance;
      const totalIssued = Math.max(0, initialQty - currentBalance);

      if (currentBalance < quantity)
        throw new BadRequestError(`Insufficient stock for ${asset.name}. Available: ${currentBalance}, Requested: ${quantity}`);

      if (totalIssued + quantity - 1 > initialQty)
        throw new BadRequestError(`Cannot issue ${quantity} items. Exceeds initial quantity (${initialQty}). Remaining stock: ${currentBalance}.`);

      let _issuedBy: TUser | null = await getUserById(String(issuedBy));
      if (!_issuedBy) throw new NotFoundError("Issued by user not found.");

      let _receivedBy: TUser | null = await getUserById(String(receivedBy));
      if (!_receivedBy) throw new NotFoundError("Received by user not found.");

      for (let i = 0; i < quantity; i++) {
        const itemNo = totalIssued + i + 1;

        // Only check for serialNo if it is provided
        let serialNumber = null;
        if (serialNo && serialNo[i]) {
          serialNumber = serialNo[i];
        }

        currentBalance--;

        await createStock(
          {
            assetId,
            reference: issueSlipNo,
            serialNo: serialNumber ?? "",
            officeId: _receivedBy?.officeId ?? "",
            outs: 1,
            balance: currentBalance,
            numberOfDaysToConsume: estimatedUsefulLife,
            itemNo: itemNo.toString(),
            remarks,
            initialCondition: "good-condition",
            condition: "reissued",
          },
          session,
        );

        await updateAssetQtyById({ _id: assetId, qty: currentBalance });
      }

      const issuedByName = `${_issuedBy?.title ? `${_issuedBy?.title} ` : ""}${_issuedBy?.firstName} ${_issuedBy?.lastName}${_issuedBy?.suffix ? ` ${_issuedBy?.suffix}` : ""}`;

      const startItemNo = totalIssued + 1; // Starting item number for this issue
      const endItemNo = totalIssued + quantity; // Ending item number for this issue
      const issueItemNo = quantity === 1 ? `${startItemNo}` : `${startItemNo}-${endItemNo}`;

      await issue({ _id, issuedBy: String(issuedBy), issuedByName, itemNo: endItemNo.toString(), issueItemNo }, session);

      session.commitTransaction();
      return "Successfully issued asset issuance record.";
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  return {
    createIssueSlip,
    getIssueSlips,
    getIssueSlipsByReceiver,
    getIssueSlipById,
    updateStatusToIssued,
  };
}
